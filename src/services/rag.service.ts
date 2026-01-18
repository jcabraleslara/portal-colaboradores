/**
 * Servicio RAG (Retrieval Augmented Generation)
 * Maneja la vectorización de PDFs y búsqueda semántica
 * 
 * Soporta PDFs escaneados mediante:
 * - Document AI OCR (producción, más rápido)
 * - Gemini 3 Flash (fallback)
 */
import { supabase } from '@/config/supabase.config'
import { generateEmbedding, splitTextIntoChunks } from './embedding.service'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

interface VectorizacionResult {
    success: boolean
    chunksProcessed: number
    error?: string
    method?: 'native' | 'document-ai' | 'gemini-ocr'
}

interface BusquedaResult {
    radicado: string
    content: string
    similarity: number
    metadata?: Record<string, unknown>
}

/**
 * Extrae texto de un PDF nativo (usando pdf.js en el navegador)
 * Solo funciona para PDFs con texto embebido (no escaneados)
 */
async function extractTextNative(pdfUrl: string): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist')
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
        console.error('[RAG] Error extracción nativa:', error)
        return ''
    }
}

/**
 * Extrae texto de PDF usando Document AI OCR (vía Vercel serverless)
 * Más rápido y preciso para documentos escaneados
 */
async function extractTextWithDocumentAI(pdfUrl: string): Promise<string> {
    console.log('[RAG] Iniciando OCR con Document AI...')

    try {
        // Descargar el PDF
        const response = await fetch(pdfUrl)
        if (!response.ok) {
            throw new Error(`Error descargando PDF: ${response.status}`)
        }

        const pdfBuffer = await response.arrayBuffer()
        const base64Pdf = btoa(
            new Uint8Array(pdfBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )

        // Llamar al endpoint serverless
        const ocrResponse = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfBase64: base64Pdf })
        })

        if (!ocrResponse.ok) {
            const error = await ocrResponse.json()
            throw new Error(error.details || 'Document AI OCR failed')
        }

        const result = await ocrResponse.json()

        if (result.success && result.text) {
            console.log(`[RAG] Document AI OCR exitoso: ${result.text.length} caracteres, ${result.pages} páginas`)
            return result.text
        }

        return ''
    } catch (error) {
        console.error('[RAG] Error en Document AI OCR:', error)
        throw error
    }
}

/**
 * Extrae texto usando Gemini Vision como fallback
 */
async function extractTextWithGemini(pdfUrl: string): Promise<string> {
    if (!GEMINI_API_KEY) {
        throw new Error('VITE_GEMINI_API_KEY no configurada')
    }

    console.log('[RAG] Usando Gemini 3 Flash como fallback...')

    const response = await fetch(pdfUrl)
    const pdfBuffer = await response.arrayBuffer()
    const base64Pdf = btoa(
        new Uint8Array(pdfBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`

    const geminiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { inlineData: { mimeType: 'application/pdf', data: base64Pdf } },
                    { text: 'Extrae TODO el texto de este documento PDF. Devuelve ÚNICAMENTE el texto extraído. Si no hay texto, responde "SIN_TEXTO".' }
                ]
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 8192 }
        })
    })

    if (!geminiResponse.ok) {
        throw new Error(`Gemini error: ${geminiResponse.status}`)
    }

    const data = await geminiResponse.json()

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const text = data.candidates[0].content.parts[0].text
        return text === 'SIN_TEXTO' ? '' : text
    }

    return ''
}

/**
 * Vectoriza un PDF y guarda los embeddings en la BD
 * Estrategia de extracción:
 * 1. Intenta extracción nativa (más rápido)
 * 2. Si hay poco texto, usa Document AI (producción)
 * 3. Si Document AI falla, usa Gemini como fallback
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

        // 2. Intentar extracción nativa primero
        console.log(`[RAG] Intentando extracción nativa...`)
        let texto = await extractTextNative(pdfUrl)
        let method: 'native' | 'document-ai' | 'gemini-ocr' = 'native'

        // 3. Si no hay texto suficiente, usar OCR
        if (!texto || texto.length < 100) {
            console.log(`[RAG] Texto insuficiente (${texto.length} chars), usando OCR...`)

            try {
                // Intentar Document AI primero (más rápido)
                texto = await extractTextWithDocumentAI(pdfUrl)
                method = 'document-ai'
            } catch (docAiError) {
                console.warn('[RAG] Document AI falló, usando Gemini fallback:', docAiError)
                // Fallback a Gemini
                try {
                    texto = await extractTextWithGemini(pdfUrl)
                    method = 'gemini-ocr'
                } catch (geminiError) {
                    console.error('[RAG] Gemini también falló:', geminiError)
                    return {
                        success: false,
                        chunksProcessed: 0,
                        error: 'Todos los métodos de OCR fallaron'
                    }
                }
            }
        }

        if (!texto || texto.length < 50) {
            console.warn(`[RAG] PDF sin texto extraíble: ${radicado}`)
            return { success: false, chunksProcessed: 0, error: 'PDF sin texto extraíble' }
        }

        // 4. Dividir en chunks
        const chunks = splitTextIntoChunks(texto, 2000)
        console.log(`[RAG] ${chunks.length} chunks generados (método: ${method})`)

        // 5. Generar embeddings y guardar
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
                            char_count: chunk.length,
                            extraction_method: method
                        }
                    })

                if (error) {
                    console.error(`[RAG] Error guardando chunk ${i}:`, error)
                } else {
                    chunksProcessed++
                }

                await new Promise(resolve => setTimeout(resolve, 100))

            } catch (embedError) {
                console.error(`[RAG] Error generando embedding chunk ${i}:`, embedError)
            }
        }

        console.log(`[RAG] ✅ Vectorización completada: ${chunksProcessed}/${chunks.length} chunks (${method})`)

        return { success: true, chunksProcessed, method }

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
 */
export async function buscarDocumentosSimilares(
    query: string,
    limit: number = 10,
    threshold: number = 0.5
): Promise<BusquedaResult[]> {
    try {
        const { embedding } = await generateEmbedding(query)

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
    extractTextNative,
    extractTextWithDocumentAI,
    extractTextWithGemini
}
