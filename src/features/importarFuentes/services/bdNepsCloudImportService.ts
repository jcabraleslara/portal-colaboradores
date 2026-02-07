/**
 * Servicio de importacion BD NEPS desde la nube
 * Invoca el Edge Function import-bd-neps que descarga y procesa
 * los archivos ZIP desde el correo de coordinacion medica.
 */

import { supabase } from '@/config/supabase.config'
import type { ImportProgressCallback, ImportResult } from '../types/import.types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

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
    console.log('[BD_NEPS] Iniciando fetch a Edge Function...')

    const response = await fetch(`${SUPABASE_URL}/functions/v1/import-bd-neps`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
    })

    console.log('[BD_NEPS] Response status:', response.status, response.statusText)
    console.log('[BD_NEPS] Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
        const errorText = await response.text()
        console.error('[BD_NEPS] Error response body:', errorText)
        throw new Error(`Error del servidor (${response.status}): ${errorText}`)
    }

    if (!response.body) {
        throw new Error('El servidor no envio respuesta streaming')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let lastResult: ImportResult | null = null
    let buffer = ''
    let lineCount = 0

    while (true) {
        const { done, value } = await reader.read()
        if (done) {
            console.log('[BD_NEPS] Stream finalizado. Total lineas NDJSON:', lineCount)
            break
        }

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        // Procesar lineas NDJSON completas
        const lines = buffer.split('\n')
        // La ultima linea puede estar incompleta
        buffer = lines.pop() || ''

        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            try {
                const data = JSON.parse(trimmed)
                lineCount++
                console.log(`[BD_NEPS] NDJSON #${lineCount}:`, data)

                if (data.phase === 'error') {
                    throw new Error(data.error || 'Error desconocido en la importacion')
                }

                if (data.pct !== undefined && data.status) {
                    onProgress(data.status, data.pct)
                }

                if (data.result) {
                    lastResult = data.result as ImportResult
                }
            } catch (parseErr) {
                // Si no es JSON valido, ignorar (puede ser fragmento parcial)
                if (parseErr instanceof SyntaxError) {
                    console.warn('[BD_NEPS] JSON parcial ignorado:', trimmed.substring(0, 100))
                    continue
                }
                throw parseErr
            }
        }
    }

    // Procesar ultimo fragmento del buffer
    if (buffer.trim()) {
        try {
            const data = JSON.parse(buffer.trim())
            console.log('[BD_NEPS] Buffer final:', data)
            if (data.phase === 'error') throw new Error(data.error)
            if (data.result) lastResult = data.result as ImportResult
        } catch {
            console.warn('[BD_NEPS] Buffer final no parseable:', buffer.substring(0, 100))
        }
    }

    if (!lastResult) {
        console.error('[BD_NEPS] No se recibio resultado. lineCount:', lineCount)
        throw new Error('No se recibio resultado de la importacion')
    }

    console.log('[BD_NEPS] Resultado final:', lastResult)
    return lastResult
}
