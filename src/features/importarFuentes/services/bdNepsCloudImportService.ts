/**
 * Servicio de importacion BD NEPS desde la nube
 * Invoca el Edge Function import-bd-neps que descarga y procesa
 * los archivos ZIP desde el correo de coordinacion medica.
 */

import { supabase } from '@/config/supabase.config'
import type { ImportProgressCallback, ImportResult } from '../types/import.types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

/**
 * Parsea texto NDJSON completo y extrae resultado + reporta progreso.
 * Lanza error si encuentra phase='error'.
 */
function parseNdjsonText(
    text: string,
    onProgress: ImportProgressCallback,
): ImportResult | null {
    let result: ImportResult | null = null

    for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
            const data = JSON.parse(trimmed)

            if (data.phase === 'heartbeat') continue

            if (data.phase === 'error') {
                throw new Error(data.error || 'Error desconocido en la importacion')
            }

            if (data.pct !== undefined && data.status) {
                onProgress(data.status, data.pct)
            }

            if (data.result) {
                result = data.result as ImportResult
            }
        } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue
            throw parseErr
        }
    }

    return result
}

/**
 * Lee la respuesta como stream NDJSON para progreso en tiempo real.
 * Retorna el resultado o null si no se encontro.
 */
async function readStreamingResponse(
    response: Response,
    onProgress: ImportProgressCallback,
): Promise<ImportResult | null> {
    if (!response.body) return null

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let result: ImportResult | null = null
    let buffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        // Procesar lineas NDJSON completas
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            try {
                const data = JSON.parse(trimmed)

                if (data.phase === 'heartbeat') continue

                if (data.phase === 'error') {
                    throw new Error(data.error || 'Error desconocido en la importacion')
                }

                if (data.pct !== undefined && data.status) {
                    onProgress(data.status, data.pct)
                }

                if (data.result) {
                    result = data.result as ImportResult
                }
            } catch (parseErr) {
                if (parseErr instanceof SyntaxError) continue
                throw parseErr
            }
        }
    }

    // Flush TextDecoder + buffer restante
    const finalChunk = decoder.decode()
    if (finalChunk) buffer += finalChunk

    if (buffer.trim()) {
        try {
            const data = JSON.parse(buffer.trim())
            if (data.phase === 'error') {
                throw new Error(data.error || 'Error desconocido en la importacion')
            }
            if (data.result) result = data.result as ImportResult
        } catch (e) {
            if (!(e instanceof SyntaxError)) throw e
        }
    }

    return result
}

/**
 * Ejecuta la sincronizacion cloud de BD NEPS
 * Intenta leer streaming para progreso en tiempo real.
 * Si el streaming no produce resultado, hace fallback a lectura completa.
 */
export async function processBdNepsCloud(
    onProgress: ImportProgressCallback
): Promise<ImportResult> {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
        throw new Error('No hay sesion activa. Inicia sesion nuevamente.')
    }

    onProgress('Conectando con el servidor...', 0)

    // Clonar respuesta para fallback si streaming falla
    const response = await fetch(`${SUPABASE_URL}/functions/v1/import-bd-neps`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Error del servidor (${response.status}): ${errorText}`)
    }

    // Clonar ANTES de consumir el body (para fallback)
    const fallbackResponse = response.clone()

    // Intentar lectura streaming (progreso en tiempo real)
    try {
        const streamResult = await readStreamingResponse(response, onProgress)
        if (streamResult) return streamResult
    } catch (streamErr) {
        // Si es un error de negocio (phase=error), re-lanzar
        if (streamErr instanceof Error && !streamErr.message.includes('stream')) {
            throw streamErr
        }
        console.warn('[BD_NEPS] Error en lectura streaming, intentando fallback:', streamErr)
    }

    // Fallback: leer respuesta completa como texto
    console.warn('[BD_NEPS] Streaming no produjo resultado, usando fallback text()')
    const text = await fallbackResponse.text()
    const fallbackResult = parseNdjsonText(text, onProgress)

    if (!fallbackResult) {
        console.error('[BD_NEPS] Respuesta del servidor:', text.substring(0, 500))
        throw new Error('No se recibio resultado de la importacion')
    }

    return fallbackResult
}
