/**
 * Servicio RAG (Retrieval Augmented Generation)
 * Maneja la vectorización de PDFs y búsqueda semántica
 */
import { supabase } from '@/config/supabase.config'
import { generateEmbedding, splitTextIntoChunks } from './embedding.service'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

interface VectorizacionResult {
    success: boolean
    chunksProcessed: number
    error?: string
}

interface BusquedaResult {
    radicado: string
    content: string
    similarity: number
    metadata?: Record<string, unknown>
}

/**
 * Extrae texto de un PDF (usando pdf.js en el navegador)
 */
async function extractTextFromPdf(pdfUrl: string): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist')

    // Configurar worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl)
        const pdf = await loadingTask.promise

        let fullText = ''

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            const pageText = textContent.items
                .filter((item): item is TextItem => 'str' in item)
                .map((item) => item.str)
                .join(' ')
            fullText += pageText + '\n\n'
        }

        return fullText.trim()
    } catch (error) {
        console.error('Error extrayendo texto del PDF:', error)
        throw new Error(`No se pudo extraer texto del PDF: ${error}`)
    }
}

/**
 * Vectoriza un PDF y guarda los embeddings en la BD
 * @param radicado - Código del radicado
 * @param pdfUrl - URL del PDF en Supabase Storage
 */
export async function vectorizarPdf(radicado: string, pdfUrl: string): Promise<VectorizacionResult> {
    try {
        console.log(`[RAG] Iniciando vectorización de ${radicado}...`)

        // 1. Verificar si ya está vectorizado
        const { data: existing } = await supabase
            .from('pdf_embeddings')
            .select('id')
            .eq('radicado', radicado)
            .limit(1)

        if (existing && existing.length > 0) {
            console.log(`[RAG] ${radicado} ya está vectorizado`)
            return { success: true, chunksProcessed: 0 }
        }

        // 2. Extraer texto del PDF
        console.log(`[RAG] Extrayendo texto...`)
        const texto = await extractTextFromPdf(pdfUrl)

        if (!texto || texto.length < 50) {
            console.warn(`[RAG] PDF sin texto suficiente: ${radicado}`)
            return { success: false, chunksProcessed: 0, error: 'PDF sin texto extraíble' }
        }

        // 3. Dividir en chunks
        const chunks = splitTextIntoChunks(texto, 2000)
        console.log(`[RAG] ${chunks.length} chunks generados`)

        // 4. Generar embeddings y guardar
        let chunksProcessed = 0

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]

            try {
                const { embedding } = await generateEmbedding(chunk)

                const { error } = await supabase
                    .from('pdf_embeddings')
                    .insert({
                        radicado,
                        pdf_url: pdfUrl,
                        chunk_index: i,
                        content: chunk,
                        embedding,
                        metadata: {
                            total_chunks: chunks.length,
                            char_count: chunk.length
                        }
                    })

                if (error) {
                    console.error(`[RAG] Error guardando chunk ${i}:`, error)
                } else {
                    chunksProcessed++
                }

                // Rate limiting: 50ms entre llamadas
                await new Promise(resolve => setTimeout(resolve, 50))

            } catch (embedError) {
                console.error(`[RAG] Error generando embedding chunk ${i}:`, embedError)
            }
        }

        console.log(`[RAG] Vectorización completada: ${chunksProcessed}/${chunks.length} chunks`)

        return { success: true, chunksProcessed }

    } catch (error) {
        console.error(`[RAG] Error en vectorización:`, error)
        return {
            success: false,
            chunksProcessed: 0,
            error: error instanceof Error ? error.message : 'Error desconocido'
        }
    }
}

/**
 * Busca documentos similares a una consulta
 * @param query - Texto de búsqueda
 * @param limit - Número máximo de resultados
 * @param threshold - Umbral de similitud (0-1)
 */
export async function buscarDocumentosSimilares(
    query: string,
    limit: number = 10,
    threshold: number = 0.5
): Promise<BusquedaResult[]> {
    try {
        // 1. Generar embedding de la consulta
        const { embedding } = await generateEmbedding(query)

        // 2. Buscar por similitud usando RPC
        const { data, error } = await supabase.rpc('search_pdf_embeddings', {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: limit
        })

        if (error) {
            console.error('[RAG] Error en búsqueda:', error)
            return []
        }

        return data as BusquedaResult[]

    } catch (error) {
        console.error('[RAG] Error en buscarDocumentosSimilares:', error)
        return []
    }
}

/**
 * Elimina los embeddings de un radicado
 * Útil si se actualiza el PDF
 */
export async function eliminarEmbeddings(radicado: string): Promise<boolean> {
    const { error } = await supabase
        .from('pdf_embeddings')
        .delete()
        .eq('radicado', radicado)

    return !error
}

export const ragService = {
    vectorizarPdf,
    buscarDocumentosSimilares,
    eliminarEmbeddings,
    extractTextFromPdf
}
