/**
 * Servicio de Generacion Automatica de Contrarreferencias
 *
 * Flujo optimizado:
 * 1. Cache check + text check en paralelo
 * 2a. Si cache → retorno inmediato (~200ms)
 * 2b. Si texto cacheado → enviar texto al Edge Function (~3-5s)
 * 2c. Si nada → enviar pdfUrl al Edge Function (Gemini multimodal, ~5-8s)
 * 3. Cache save + vectorizacion en background (fire-and-forget)
 */

import { supabase } from '@/config/supabase.config'
import { ragService } from './rag.service'
import type { ContrarreferenciaResult } from '@/types/back.types'
import { criticalErrorService } from './criticalError.service'
import { EDGE_FUNCTIONS, getEdgeFunctionHeaders } from '@/config/api.config'

interface CachedContrarreferencia {
    texto: string
    generadaEn: string
    especialidad: string
}

/**
 * Obtiene el texto completo de un documento desde sus chunks vectorizados
 */
async function obtenerTextoCompleto(radicado: string): Promise<string> {
    const { data: chunks, error } = await supabase
        .from('pdf_embeddings')
        .select('content, chunk_index')
        .eq('radicado', radicado)
        .order('chunk_index', { ascending: true })

    if (error || !chunks || chunks.length === 0) return ''

    return chunks.map(chunk => chunk.content).join('\n\n')
}

/**
 * Obtener contrarreferencia desde cache (metadata de pdf_embeddings)
 */
async function obtenerContrarreferenciaCacheada(radicado: string): Promise<CachedContrarreferencia | null> {
    try {
        const { data, error } = await supabase
            .from('pdf_embeddings')
            .select('metadata')
            .eq('radicado', radicado)
            .limit(1)
            .maybeSingle()

        if (error || !data) return null

        const metadata = data.metadata as Record<string, unknown>
        if (metadata?.contrarreferencia) {
            return metadata.contrarreferencia as CachedContrarreferencia
        }

        return null
    } catch {
        return null
    }
}

/**
 * Guardar contrarreferencia en cache (metadata de primer chunk) - fire-and-forget
 */
function guardarContrarreferenciaCacheada(
    radicado: string,
    texto: string,
    especialidad: string
): void {
    // Fire-and-forget: no bloquea la respuesta al usuario
    (async () => {
        try {
            const { data: chunks } = await supabase
                .from('pdf_embeddings')
                .select('id, metadata')
                .eq('radicado', radicado)
                .order('chunk_index', { ascending: true })
                .limit(1)

            if (!chunks || chunks.length === 0) return

            const primerChunk = chunks[0]
            const metadataActual = (primerChunk.metadata as Record<string, unknown>) || {}

            await supabase
                .from('pdf_embeddings')
                .update({
                    metadata: {
                        ...metadataActual,
                        contrarreferencia: {
                            texto,
                            generadaEn: new Date().toISOString(),
                            especialidad
                        }
                    }
                })
                .eq('id', primerChunk.id)

            console.log('[Contrarreferencia] Cache guardada en background')
        } catch (err) {
            console.warn('[Contrarreferencia] Error guardando cache:', err)
        }
    })()
}

/**
 * Esperar tiempo especificado (para retry)
 */
function esperar(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Llama al Edge Function con retry automatico
 * Acepta textoSoporte (modo texto) o pdfUrl (modo multimodal)
 */
async function llamarEdgeFunction(
    payload: { textoSoporte?: string; pdfUrl?: string; especialidad: string },
    maxRetries: number = 3
): Promise<{ success: boolean; texto?: string; error?: string; retryAfter?: number }> {
    const mode = payload.textoSoporte ? 'texto' : 'multimodal'
    console.log(`[Contrarreferencia] Llamando Edge Function (modo: ${mode})...`)

    for (let intento = 0; intento <= maxRetries; intento++) {
        try {
            const response = await fetch(EDGE_FUNCTIONS.generarContrarreferencia, {
                method: 'POST',
                headers: getEdgeFunctionHeaders(),
                body: JSON.stringify(payload)
            })

            // Exito
            if (response.ok) {
                const data = await response.json()
                if (data.success && data.texto) {
                    console.log(`[Contrarreferencia] Generada OK (${data.texto.length} chars, modelo: ${data.model}, modo: ${data.mode})`)
                    return { success: true, texto: data.texto }
                }
                return { success: false, error: data.error || 'Respuesta sin contenido valido' }
            }

            // Rate limit
            if (response.status === 429) {
                const errorData = await response.json().catch(() => ({}))
                let retryDelaySeconds = 0

                if (errorData.details) {
                    try {
                        const geminiError = JSON.parse(errorData.details)
                        const retryDelayStr = geminiError?.error?.details?.[0]?.retryDelay
                        if (retryDelayStr) {
                            retryDelaySeconds = parseInt(retryDelayStr.replace('s', ''))
                        }
                    } catch { /* ignorar */ }
                }

                if (retryDelaySeconds === 0) {
                    retryDelaySeconds = Math.pow(2, intento) * 5
                }

                console.warn(`[Contrarreferencia] 429 (intento ${intento + 1}/${maxRetries + 1}). Retry en ${retryDelaySeconds}s...`)

                if (intento < maxRetries) {
                    await esperar(retryDelaySeconds * 1000)
                    continue
                }

                return {
                    success: false,
                    error: `Rate limit excedido. Espera ${retryDelaySeconds}s antes de reintentar.`,
                    retryAfter: retryDelaySeconds
                }
            }

            // Otros errores HTTP
            const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }))
            console.error('[Contrarreferencia] Error:', response.status, errorData)

            if (response.status === 401 || response.status === 403) {
                await criticalErrorService.reportApiKeyFailure('Gemini API', 'Generacion de Contrarreferencias', response.status)
            } else if (response.status === 503) {
                await criticalErrorService.reportServiceUnavailable('Gemini API', 'Generacion de Contrarreferencias', response.status)
            }

            return { success: false, error: errorData.error || `Error del servidor: ${response.status}` }

        } catch (error) {
            console.error('[Contrarreferencia] Error en llamada:', error)

            if (intento < maxRetries) {
                const delayMs = Math.pow(2, intento) * 1000
                await esperar(delayMs)
                continue
            }

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error de conexion con el servidor'
            }
        }
    }

    return { success: false, error: 'Numero maximo de reintentos alcanzado' }
}

/**
 * Funcion principal: genera contrarreferencia automatica
 *
 * Flujo optimizado:
 * 1. Promise.all([cache check, text check]) - paralelo
 * 2a. Cache hit → retorno inmediato
 * 2b. Texto disponible → Edge Function modo texto (rapido)
 * 2c. Sin texto → Edge Function modo multimodal (Gemini lee PDF directo)
 * 3. Fire-and-forget: cache save + vectorizacion background
 */
export async function generarContrarreferenciaAutomatica(
    radicado: string,
    pdfUrl: string,
    especialidad?: string,
    forceRegenerate: boolean = false
): Promise<ContrarreferenciaResult> {
    const inicio = Date.now()
    const especialidadNormalizada = especialidad || 'No especificada'

    try {
        console.log(`[Contrarreferencia] === Inicio ${radicado} ===`)

        // Paso 1: Cache check + text check EN PARALELO
        const [cacheada, textoExistente] = await Promise.all([
            forceRegenerate ? Promise.resolve(null) : obtenerContrarreferenciaCacheada(radicado),
            obtenerTextoCompleto(radicado)
        ])

        // Paso 2a: Cache hit → retorno inmediato
        if (cacheada?.texto) {
            console.log(`[Contrarreferencia] Cache hit (${Date.now() - inicio}ms)`)
            return {
                success: true,
                texto: cacheada.texto,
                metodo: 'cache',
                tiempoMs: Date.now() - inicio
            }
        }

        // Paso 2b: Texto cacheado → enviar al EF en modo texto (mas rapido)
        let resultado: { success: boolean; texto?: string; error?: string; retryAfter?: number }
        let metodo: 'vectorizado' | 'multimodal'

        if (textoExistente && textoExistente.length >= 100) {
            console.log(`[Contrarreferencia] Texto disponible (${textoExistente.length} chars) → modo texto`)
            resultado = await llamarEdgeFunction({
                textoSoporte: textoExistente,
                especialidad: especialidadNormalizada
            })
            metodo = 'vectorizado'
        } else {
            // Paso 2c: Sin texto → enviar pdfUrl al EF (Gemini multimodal, skip OCR)
            console.log('[Contrarreferencia] Sin texto → modo multimodal (Gemini lee PDF directo)')
            resultado = await llamarEdgeFunction({
                pdfUrl,
                especialidad: especialidadNormalizada
            })
            metodo = 'multimodal'

            // Fire-and-forget: vectorizar en background para futuras consultas
            if (resultado.success) {
                ragService.vectorizarPdf(radicado, pdfUrl).catch(err =>
                    console.warn('[Contrarreferencia] Vectorizacion background falló:', err)
                )
            }
        }

        // Paso 3: Fire-and-forget cache save
        if (resultado.success && resultado.texto) {
            guardarContrarreferenciaCacheada(radicado, resultado.texto, especialidadNormalizada)
        }

        const tiempoMs = Date.now() - inicio
        console.log(`[Contrarreferencia] === Completado en ${tiempoMs}ms (${metodo}) ===`)

        return {
            success: resultado.success,
            texto: resultado.texto,
            error: resultado.error,
            metodo,
            tiempoMs,
            retryAfter: resultado.retryAfter
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
