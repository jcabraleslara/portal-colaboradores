/**
 * Servicio de Generación Automática de Contrarreferencias
 * Utiliza endpoint serverless seguro (/api/generar-contrarreferencia)
 * para generar contrarreferencias médicas sin exponer API keys
 * 
 * FEATURES:
 * - Retry automático con exponential backoff
 * - Caching de respuestas generadas
 * - Manejo robusto de rate limits (429)
 */

import { supabase } from '@/config/supabase.config'
import { ragService } from './rag.service'
import type { ContrarreferenciaResult } from '@/types/back.types'
import { criticalErrorService } from './criticalError.service'

interface CachedContrarreferencia {
    texto: string
    generadaEn: string
    especialidad: string
}

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
 * Obtener contrarreferencia desde caché (metadata de pdf_embeddings)
 */
async function obtenerContrarreferenciaCacheada(radicado: string): Promise<CachedContrarreferencia | null> {
    try {
        const { data, error } = await supabase
            .from('pdf_embeddings')
            .select('metadata')
            .eq('radicado', radicado)
            .limit(1)
            .single()

        if (error || !data) return null

        const metadata = data.metadata as any
        if (metadata?.contrarreferencia) {
            console.log('[Contrarreferencia] ✅ Encontrada en caché')
            return metadata.contrarreferencia as CachedContrarreferencia
        }

        return null
    } catch (error) {
        console.warn('[Contrarreferencia] Error leyendo caché:', error)
        return null
    }
}

/**
 * Guardar contrarreferencia en caché (metadata de primer chunk)
 */
async function guardarContrarreferenciaCacheada(
    radicado: string,
    texto: string,
    especialidad: string
): Promise<void> {
    try {
        // Obtener el primer chunk
        const { data: chunks } = await supabase
            .from('pdf_embeddings')
            .select('id, metadata')
            .eq('radicado', radicado)
            .order('chunk_index', { ascending: true })
            .limit(1)

        if (!chunks || chunks.length === 0) {
            console.warn('[Contrarreferencia] No hay chunks para guardar caché')
            return
        }

        const primerChunk = chunks[0]
        const metadataActual = (primerChunk.metadata as any) || {}

        // Actualizar metadata con contrarreferencia
        const { error } = await supabase
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

        if (error) {
            console.error('[Contrarreferencia] Error guardando en caché:', error)
        } else {
            console.log('[Contrarreferencia] ✅ Guardada en caché')
        }
    } catch (error) {
        console.warn('[Contrarreferencia] Error en guardado de caché:', error)
    }
}

/**
 * Esperar tiempo especificado (para retry)
 */
function esperar(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Genera contrarreferencia usando endpoint serverless con retry automático
 * Maneja error 429 con exponential backoff
 */
async function generarContrarreferenciaConIA_ConRetry(
    textoSoporte: string,
    especialidad: string = 'No especificada',
    maxRetries: number = 3
): Promise<{ success: boolean; texto?: string; error?: string; retryAfter?: number }> {
    console.log('[Contrarreferencia] Llamando a endpoint serverless...')

    for (let intento = 0; intento <= maxRetries; intento++) {
        try {
            // Llamar al endpoint serverless de Vercel
            const response = await fetch('/api/generar-contrarreferencia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    textoSoporte,
                    especialidad
                })
            })

            // CASO 1: Éxito
            if (response.ok) {
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
            }

            // CASO 2: Error 429 (Rate Limit)
            if (response.status === 429) {
                const errorData = await response.json().catch(() => ({}))

                // Intentar extraer retryDelay del error de Gemini
                let retryDelaySeconds = 0

                if (errorData.details) {
                    try {
                        const geminiError = JSON.parse(errorData.details)
                        const retryDelayStr = geminiError?.error?.details?.[0]?.retryDelay
                        if (retryDelayStr) {
                            // Parsear "39s" => 39
                            retryDelaySeconds = parseInt(retryDelayStr.replace('s', ''))
                        }
                    } catch (e) {
                        // Ignorar error de parseo
                    }
                }

                // Si no hay retryDelay, usar exponential backoff
                if (retryDelaySeconds === 0) {
                    retryDelaySeconds = Math.pow(2, intento) * 5 // 5s, 10s, 20s
                }

                console.warn(
                    `[Contrarreferencia] ⚠️ Error 429 (intento ${intento + 1}/${maxRetries + 1}). ` +
                    `Reintentando en ${retryDelaySeconds}s...`
                )

                // Si no es el último intento, esperar y reintentar
                if (intento < maxRetries) {
                    await esperar(retryDelaySeconds * 1000)
                    continue
                }

                // Último intento fallido
                return {
                    success: false,
                    error: `Rate limit excedido. Espera ${retryDelaySeconds}s antes de reintentar.`,
                    retryAfter: retryDelaySeconds
                }
            }

            // CASO 3: Otros errores HTTP
            const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }))
            console.error('[Contrarreferencia] Endpoint error:', response.status, errorData)

            // Si es error 401/403, probablemente sea API key inválida
            if (response.status === 401 || response.status === 403) {
                await criticalErrorService.reportApiKeyFailure(
                    'Gemini API',
                    'Generación de Contrarreferencias',
                    response.status
                )
            } else if (response.status === 503) {
                await criticalErrorService.reportServiceUnavailable(
                    'Gemini API',
                    'Generación de Contrarreferencias',
                    response.status
                )
            }

            return {
                success: false,
                error: errorData.error || `Error del servidor: ${response.status}`
            }

        } catch (error) {
            console.error('[Contrarreferencia] Error en llamada:', error)

            // Si no es el último intento, esperar y reintentar
            if (intento < maxRetries) {
                const delayMs = Math.pow(2, intento) * 1000 // 1s, 2s, 4s
                console.log(`[Contrarreferencia] Reintentando en ${delayMs / 1000}s...`)
                await esperar(delayMs)
                continue
            }

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error de conexión con el servidor'
            }
        }
    }

    return {
        success: false,
        error: 'Número máximo de reintentos alcanzado'
    }
}

/**
 * Función principal: genera contrarreferencia automática
 * 
 * Flujo:
 * 1. Verifica si existe en caché
 * 2. Intenta obtener texto desde chunks vectorizados
 * 3. Si no existe, vectoriza el PDF on-the-fly
 * 4. Genera contrarreferencia con Gemini 3 Flash (con retry automático)
 * 5. Guarda en caché para futuras consultas
 * 
 * @param radicado - Número de radicado del caso
 * @param pdfUrl - URL del PDF soporte
 * @param especialidad - Especialidad a la que se remite (opcional)
 * @param forceRegenerate - Forzar regeneración ignorando caché
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
        console.log(`[Contrarreferencia] === Iniciando generación para ${radicado} ===`)

        // 0. Verificar si existe en caché (a menos que se fuerce regeneración)
        if (!forceRegenerate) {
            const cacheada = await obtenerContrarreferenciaCacheada(radicado)
            if (cacheada && cacheada.texto) {
                console.log('[Contrarreferencia] ✅ Usando respuesta cacheada')
                return {
                    success: true,
                    texto: cacheada.texto,
                    metodo: 'cache',
                    tiempoMs: Date.now() - inicio
                }
            }
        }

        // 1. Intentar obtener texto desde vectorización existente
        let textoSoporte = await obtenerTextoCompleto(radicado)
        let metodo: 'vectorizado' | 'vectorizado-on-fly' | 'cache' = 'vectorizado'

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

        // 3. Generar contrarreferencia con IA (con retry automático)
        const resultado = await generarContrarreferenciaConIA_ConRetry(textoSoporte, especialidadNormalizada)

        // 4. Si fue exitoso, guardar en caché
        if (resultado.success && resultado.texto) {
            await guardarContrarreferenciaCacheada(radicado, resultado.texto, especialidadNormalizada)
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
