/**
 * Servicio de Generacion Automatica de Contrarreferencias
 *
 * Flujo simplificado (multimodal directo):
 * 1. Cache check en tabla 'back' → retorno inmediato (~200ms)
 * 2. Si no hay cache → Edge Function multimodal (Gemini lee PDF directo, ~10-15s)
 * 3. Cache save fire-and-forget en tabla 'back'
 *
 * Se elimino la vectorizacion eager de PDFs porque:
 * - Solo el 3.4% de los radicados necesitan contrarreferencia
 * - La vectorizacion tenia 99% de tasa de fallo (rate limits, OCR fallido)
 * - El modo multimodal de Gemini funciona bien sin pre-extraccion de texto
 */

import { supabase } from '@/config/supabase.config'
import type { ContrarreferenciaResult } from '@/types/back.types'
import { criticalErrorService } from './criticalError.service'
import { EDGE_FUNCTIONS, getEdgeFunctionHeaders } from '@/config/api.config'

interface CachedContrarreferencia {
    texto: string
    generadaEn: string
    especialidad: string
}

/**
 * Obtener contrarreferencia desde cache (columna de tabla 'back')
 */
async function obtenerContrarreferenciaCacheada(radicado: string): Promise<CachedContrarreferencia | null> {
    try {
        const { data, error } = await supabase
            .from('back')
            .select('contrarreferencia_cache')
            .eq('radicado', radicado)
            .single()

        if (error || !data?.contrarreferencia_cache) return null

        return data.contrarreferencia_cache as CachedContrarreferencia
    } catch {
        return null
    }
}

/**
 * Guardar contrarreferencia en cache (columna de tabla 'back') - fire-and-forget
 */
function guardarContrarreferenciaCacheada(
    radicado: string,
    texto: string,
    especialidad: string
): void {
    (async () => {
        try {
            await supabase
                .from('back')
                .update({
                    contrarreferencia_cache: {
                        texto,
                        generadaEn: new Date().toISOString(),
                        especialidad
                    }
                })
                .eq('radicado', radicado)

            console.log('[Contrarreferencia] Cache guardada')
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
 * Llama al Edge Function en modo multimodal con retry automatico
 */
async function llamarEdgeFunction(
    payload: { pdfUrl: string; especialidad: string },
    maxRetries: number = 3
): Promise<{ success: boolean; texto?: string; error?: string; retryAfter?: number }> {
    console.log('[Contrarreferencia] Llamando Edge Function (modo: multimodal)...')

    for (let intento = 0; intento <= maxRetries; intento++) {
        try {
            const response = await fetch(EDGE_FUNCTIONS.generarContrarreferencia, {
                method: 'POST',
                headers: await getEdgeFunctionHeaders(),
                body: JSON.stringify(payload)
            })

            // Exito
            if (response.ok) {
                const data = await response.json()
                if (data.success && data.texto) {
                    console.log(`[Contrarreferencia] Generada OK (${data.texto.length} chars, modelo: ${data.model})`)
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
 * Flujo:
 * 1. Cache check en tabla 'back' → retorno inmediato
 * 2. Multimodal directo → Gemini lee PDF (~10-15s)
 * 3. Fire-and-forget: cache save
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

        // Paso 1: Cache check
        if (!forceRegenerate) {
            const cacheada = await obtenerContrarreferenciaCacheada(radicado)
            if (cacheada?.texto) {
                console.log(`[Contrarreferencia] Cache hit (${Date.now() - inicio}ms)`)
                return {
                    success: true,
                    texto: cacheada.texto,
                    metodo: 'cache',
                    tiempoMs: Date.now() - inicio
                }
            }
        }

        // Paso 2: Multimodal directo (Gemini lee PDF)
        const resultado = await llamarEdgeFunction({
            pdfUrl,
            especialidad: especialidadNormalizada
        })

        // Paso 3: Fire-and-forget cache save
        if (resultado.success && resultado.texto) {
            guardarContrarreferenciaCacheada(radicado, resultado.texto, especialidadNormalizada)
        }

        const tiempoMs = Date.now() - inicio
        console.log(`[Contrarreferencia] === Completado en ${tiempoMs}ms (multimodal) ===`)

        return {
            success: resultado.success,
            texto: resultado.texto,
            error: resultado.error,
            metodo: 'multimodal',
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
