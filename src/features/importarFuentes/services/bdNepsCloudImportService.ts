/**
 * Servicio de importacion BD NEPS desde la nube
 * Invoca el Edge Function import-bd-neps que descarga y procesa
 * los archivos ZIP desde el correo de coordinacion medica.
 */

import { supabase } from '@/config/supabase.config'
import type { ImportProgressCallback, ImportResult } from '../types/import.types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

/**
 * Parsea todas las lineas NDJSON pendientes en el buffer.
 * Retorna el buffer restante (linea incompleta al final).
 */
function processNdjsonBuffer(
    buffer: string,
    onProgress: ImportProgressCallback,
    resultRef: { value: ImportResult | null },
) {
    const lines = buffer.split('\n')
    const remaining = lines.pop() || ''

    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
            const data = JSON.parse(trimmed)

            if (data.phase === 'error') {
                throw new Error(data.error || 'Error desconocido en la importacion')
            }

            if (data.pct !== undefined && data.status) {
                onProgress(data.status, data.pct)
            }

            if (data.result) {
                resultRef.value = data.result as ImportResult
            }
        } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue
            throw parseErr
        }
    }

    return remaining
}

/**
 * Ejecuta la sincronizacion cloud de BD NEPS
 * Lee la respuesta streaming (NDJSON) para reportar progreso en tiempo real
 */
export async function processBdNepsCloud(
    onProgress: ImportProgressCallback
): Promise<ImportResult> {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
        throw new Error('No hay sesion activa. Inicia sesion nuevamente.')
    }

    onProgress('Conectando con el servidor...', 0)

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

    // Fallback: si no hay body streaming, leer como texto completo
    if (!response.body) {
        const text = await response.text()
        const resultRef = { value: null as ImportResult | null }
        processNdjsonBuffer(text + '\n', onProgress, resultRef)

        if (!resultRef.value) {
            throw new Error('El servidor no envio resultado en la respuesta')
        }
        return resultRef.value
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const resultRef = { value: null as ImportResult | null }
    let buffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        buffer = processNdjsonBuffer(buffer, onProgress, resultRef)
    }

    // Flush del TextDecoder (bytes pendientes de secuencias multi-byte)
    const finalChunk = decoder.decode()
    if (finalChunk) {
        buffer += finalChunk
    }

    // Procesar ultimo fragmento del buffer
    if (buffer.trim()) {
        processNdjsonBuffer(buffer + '\n', onProgress, resultRef)
    }

    if (!resultRef.value) {
        throw new Error('No se recibio resultado de la importacion')
    }

    return resultRef.value
}
