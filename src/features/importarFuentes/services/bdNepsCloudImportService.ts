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

    if (!response.body) {
        throw new Error('El servidor no envio respuesta streaming')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let lastResult: ImportResult | null = null
    let buffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Procesar lineas NDJSON completas
        const lines = buffer.split('\n')
        // La ultima linea puede estar incompleta
        buffer = lines.pop() || ''

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
                    lastResult = data.result as ImportResult
                }
            } catch (parseErr) {
                // Si no es JSON valido, ignorar (puede ser fragmento parcial)
                if (parseErr instanceof SyntaxError) continue
                throw parseErr
            }
        }
    }

    // Procesar ultimo fragmento del buffer
    if (buffer.trim()) {
        try {
            const data = JSON.parse(buffer.trim())
            if (data.phase === 'error') throw new Error(data.error)
            if (data.result) lastResult = data.result as ImportResult
        } catch {
            // Ignorar fragmentos parciales finales
        }
    }

    if (!lastResult) {
        throw new Error('No se recibio resultado de la importacion')
    }

    return lastResult
}
