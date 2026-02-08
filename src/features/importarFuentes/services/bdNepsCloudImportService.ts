/**
 * Servicio de importacion BD NEPS desde la nube
 *
 * Arquitectura: RPC trigger (pg_net interno) + polling a import_jobs.
 * Evita streaming NDJSON que era truncado por el gateway Cloudflare/Supabase.
 *
 * Flujo:
 * 1. Frontend llama RPC trigger_import_bd_neps() → crea job + dispara Edge Function via pg_net
 * 2. Edge Function corre internamente (sin proxy) y actualiza import_jobs con progreso
 * 3. Frontend hace polling cada 2.5s a import_jobs hasta que el job complete o falle
 */

import { supabase } from '@/config/supabase.config'
import type { ImportProgressCallback, ImportResult } from '../types/import.types'

/** Intervalo de polling en ms */
const POLL_INTERVAL = 2500

/** Timeout maximo para la importacion (10 minutos) */
const MAX_WAIT_MS = 600_000

/** Tiempo maximo para que el job pase de pending a processing */
const PENDING_TIMEOUT_MS = 30_000

/** Si el job no se actualiza en 90s, asumir que el Edge Function fue matado por timeout */
const STALE_JOB_TIMEOUT_MS = 90_000

interface ImportJob {
    status: string
    progress_pct: number
    progress_status: string
    result: ImportResult | null
    error_message: string | null
    updated_at: string
}

/**
 * Ejecuta la sincronizacion cloud de BD NEPS.
 * Dispara el Edge Function via pg_net (interno) y hace polling a la BD.
 */
export async function processBdNepsCloud(
    onProgress: ImportProgressCallback
): Promise<ImportResult> {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
        throw new Error('No hay sesion activa. Inicia sesion nuevamente.')
    }

    onProgress('Iniciando importacion...', 0)

    // Paso 1: Disparar import via RPC (pg_net interno, sin Cloudflare)
    const { data: triggerResult, error: triggerError } = await supabase.rpc('trigger_import_bd_neps')

    if (triggerError) {
        throw new Error(`Error al iniciar importacion: ${triggerError.message}`)
    }

    const jobId = triggerResult?.job_id
    if (!jobId) {
        throw new Error('No se recibio ID de trabajo del servidor')
    }

    onProgress('Importacion iniciada, conectando con servidor...', 1)

    // Paso 2: Polling a import_jobs hasta que complete o falle
    const startTime = Date.now()
    let pendingStart = Date.now()
    let wasProcessing = false

    while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))

        const { data: job, error: jobError } = await supabase
            .from('import_jobs')
            .select('status, progress_pct, progress_status, result, error_message, updated_at')
            .eq('id', jobId)
            .single()

        if (jobError) {
            console.warn('[BD_NEPS] Error polling job:', jobError.message)
            continue
        }

        if (!job) continue

        const typedJob = job as ImportJob

        // Actualizar progreso en la UI
        if (typedJob.progress_status && typedJob.progress_pct !== null) {
            onProgress(typedJob.progress_status, typedJob.progress_pct)
        }

        // Job completado exitosamente (status='completed' O progress_pct=100 con result)
        if ((typedJob.status === 'completed' || typedJob.progress_pct === 100) && typedJob.result) {
            return typedJob.result
        }

        // Job completado con resultado vacio (sin correos, etc.)
        if (typedJob.status === 'completed' && !typedJob.result) {
            return {
                success: 0,
                errors: 0,
                duplicates: 0,
                totalProcessed: 0,
                duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
                errorMessage: typedJob.progress_status || 'Importacion completada sin resultados',
            }
        }

        // Job fallido
        if (typedJob.status === 'failed') {
            throw new Error(typedJob.error_message || 'La importacion fallo en el servidor')
        }

        // Detectar si ya paso a processing
        if (typedJob.status === 'processing' && !wasProcessing) {
            wasProcessing = true
        }

        // Timeout de pending: si el job no arranca en 30s, algo fallo
        if (typedJob.status === 'pending' && Date.now() - pendingStart > PENDING_TIMEOUT_MS) {
            throw new Error('El servidor no inicio la importacion. Intenta nuevamente.')
        }

        // Detectar job estancado: si no se actualiza en 90s, el Edge Function fue matado por timeout
        if (typedJob.status === 'processing' && typedJob.updated_at) {
            const lastUpdate = new Date(typedJob.updated_at).getTime()
            if (Date.now() - lastUpdate > STALE_JOB_TIMEOUT_MS) {
                throw new Error(
                    'El servidor dejo de responder (posible timeout por exceso de correos). ' +
                    'Los correos se procesaran automaticamente con el CRON diario a las 7am.'
                )
            }
        }
    }

    throw new Error('Timeout: La importacion tomo mas de 10 minutos sin completarse.')
}
