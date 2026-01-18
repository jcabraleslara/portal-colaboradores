/**
 * Servicio de Generación Automática de Contrarreferencias
 * Utiliza endpoint serverless seguro (/api/generar-contrarreferencia)
 * para generar contrarreferencias médicas sin exponer API keys
 */

import { supabase } from '@/config/supabase.config'
import { ragService } from './rag.service'
import type { ContrarreferenciaResult } from '@/types/back.types'

/**
 * Obtiene el texto completo de un documento desde sus chunks vectorizados
 */
async function obtenerTextoCompleto(radicado: string): Promise<string> {
    console.log(`[Contrarreferencia] Obteniendo chunks de ${radicado}...`)

    const { data: chunks, error } = await supabase
        .from('pdf_embeddings')
        .select('content, chunk_index')
        .eq('radicado', radicado)
        .order('chunk_index', { ascending: true })

    if (error) {
        console.error('[Contrarreferencia] Error obteniendo chunks:', error)
        throw new Error('Error obteniendo texto vectorizado')
    }

    if (!chunks || chunks.length === 0) {
        return ''
    }

    // Reconstruir texto completo concatenando chunks ordenados
    const textoCompleto = chunks.map(chunk => chunk.content).join('\n\n')
    console.log(`[Contrarreferencia] ${chunks.length} chunks reconstruidos (${textoCompleto.length} caracteres)`)

    return textoCompleto
}

/**
 * Genera contrarreferencia usando endpoint serverless seguro
 * La API key NO se expone al frontend
 */
async function generarContrarreferenciaConIA(
    textoSoporte: string,
    especialidad: string = 'No especificada'
): Promise<{ success: boolean; texto?: string; error?: string }> {
    console.log('[Contrarreferencia] Llamando a endpoint serverless...')

    try {
        // Llamar al endpoint serverless de Vercel (API key segura en backend)
        const response = await fetch('/api/generar-contrarreferencia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                textoSoporte,
                especialidad
            })
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }))
            console.error('[Contrarreferencia] Endpoint error:', response.status, errorData)
            return {
                success: false,
                error: errorData.error || `Error del servidor: ${response.status}`
            }
        }

        const data = await response.json()

        if (data.success && data.texto) {
            console.log(`[Contrarreferencia] ✅ Generación exitosa (${data.texto.length} caracteres)`)
            return {
                success: true,
                texto: data.texto
            }
        }

        return {
            success: false,
            error: data.error || 'Respuesta del servidor sin contenido válido'
        }

    } catch (error) {
        console.error('[Contrarreferencia] Error en llamada al endpoint:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error de conexión con el servidor'
        }
    }
}

/**
 * Función principal: genera contrarreferencia automática
 * 
 * Flujo:
 * 1. Intenta obtener texto desde chunks vectorizados
 * 2. Si no existe, vectoriza el PDF on-the-fly
 * 3. Genera contrarreferencia con Gemini 3 Flash
 * 
 * @param radicado - Número de radicado del caso
 * @param pdfUrl - URL del PDF soporte
 * @param especialidad - Especialidad a la que se remite (opcional)
 */
export async function generarContrarreferenciaAutomatica(
    radicado: string,
    pdfUrl: string,
    especialidad?: string
): Promise<ContrarreferenciaResult> {
    const inicio = Date.now()

    try {
        console.log(`[Contrarreferencia] === Iniciando generación para ${radicado} ===`)

        // 1. Intentar obtener texto desde vectorización existente
        let textoSoporte = await obtenerTextoCompleto(radicado)
        let metodo: 'vectorizado' | 'vectorizado-on-fly' = 'vectorizado'

        // 2. Si no existe, vectorizar on-the-fly
        if (!textoSoporte || textoSoporte.length < 100) {
            console.log('[Contrarreferencia] No hay vectorización, vectorizando on-the-fly...')

            const resultadoVectorizacion = await ragService.vectorizarPdf(radicado, pdfUrl)

            if (!resultadoVectorizacion.success) {
                return {
                    success: false,
                    error: `Error en vectorización: ${resultadoVectorizacion.error}`,
                    tiempoMs: Date.now() - inicio
                }
            }

            // Obtener texto recién vectorizado
            textoSoporte = await obtenerTextoCompleto(radicado)
            metodo = 'vectorizado-on-fly'

            if (!textoSoporte || textoSoporte.length < 100) {
                return {
                    success: false,
                    error: 'No se pudo extraer texto del PDF',
                    tiempoMs: Date.now() - inicio
                }
            }
        }

        // 3. Generar contrarreferencia con IA
        const resultado = await generarContrarreferenciaConIA(textoSoporte, especialidad)

        const tiempoMs = Date.now() - inicio
        console.log(`[Contrarreferencia] === Completado en ${tiempoMs}ms (${metodo}) ===`)

        return {
            success: resultado.success,
            texto: resultado.texto,
            error: resultado.error,
            metodo,
            tiempoMs
        }

    } catch (error) {
        console.error('[Contrarreferencia] Error general:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido',
            tiempoMs: Date.now() - inicio
        }
    }
}

export default {
    generarContrarreferenciaAutomatica
}
