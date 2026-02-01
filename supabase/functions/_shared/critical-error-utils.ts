/**
 * Utilidades para Notificacion de Errores Criticos desde Edge Functions
 * Portal de Colaboradores - Gestar Salud IPS
 *
 * Este modulo permite enviar notificaciones de errores criticos
 * llamando al endpoint de notificacion.
 * Adaptado para Deno runtime.
 */

type ErrorSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM'

type ErrorCategory =
    | 'API_KEY_FAILURE'
    | 'EMAIL_FAILURE'
    | 'SERVICE_UNAVAILABLE'
    | 'STORAGE_FAILURE'
    | 'DATABASE_ERROR'
    | 'AUTHENTICATION_ERROR'
    | 'INTEGRATION_ERROR'
    | 'GEMINI_API_ERROR'
    | 'UNKNOWN'

interface CriticalErrorPayload {
    severity: ErrorSeverity
    category: ErrorCategory
    errorMessage: string
    errorStack?: string
    feature: string
    timestamp: string
    metadata?: Record<string, unknown>
}

/**
 * Enviar notificacion de error critico desde Edge Function
 *
 * @param options - Opciones del error critico
 * @returns true si la notificacion se envio exitosamente
 */
export async function notifyCriticalError(options: {
    category: ErrorCategory
    errorMessage: string
    feature: string
    severity?: ErrorSeverity
    error?: Error
    metadata?: Record<string, unknown>
}): Promise<boolean> {
    try {
        const payload: CriticalErrorPayload = {
            severity: options.severity || 'CRITICAL',
            category: options.category,
            errorMessage: options.errorMessage,
            errorStack: options.error?.stack,
            feature: options.feature,
            timestamp: new Date().toISOString(),
            metadata: options.metadata
        }

        // Usar URL de Supabase Functions
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

        const response = await fetch(`${supabaseUrl}/functions/v1/notify-critical-error`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`
            },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            console.error('[CRITICAL ERROR UTILS] Failed to send notification:', await response.text())
            return false
        }

        const result = await response.json()
        console.log('[CRITICAL ERROR UTILS] Notificacion enviada:', options.category, options.feature)
        return result.success

    } catch (error) {
        // No queremos que el sistema de notificacion rompa las Edge Functions
        console.error('[CRITICAL ERROR UTILS] Error enviando notificacion:', error)
        return false
    }
}

/**
 * Wrapper para reportar fallos de API keys
 */
export async function notifyApiKeyFailure(
    apiName: string,
    feature: string,
    statusCode: number,
    error?: Error
): Promise<void> {
    await notifyCriticalError({
        category: 'API_KEY_FAILURE',
        errorMessage: `${apiName} retorno error ${statusCode} - Posible API key invalida o expirada`,
        feature,
        severity: 'CRITICAL',
        error,
        metadata: { apiName, statusCode }
    })
}

/**
 * Wrapper para reportar errores de autenticacion OAuth2
 */
export async function notifyAuthenticationError(
    provider: string,
    feature: string,
    statusCode: number,
    error?: Error
): Promise<void> {
    await notifyCriticalError({
        category: 'AUTHENTICATION_ERROR',
        errorMessage: `Error de autenticacion con ${provider} (${statusCode}) - Credenciales OAuth2 pueden estar expiradas`,
        feature,
        severity: 'CRITICAL',
        error,
        metadata: { provider, statusCode }
    })
}

/**
 * Wrapper para reportar servicios no disponibles
 */
export async function notifyServiceUnavailable(
    serviceName: string,
    feature: string,
    statusCode: number,
    error?: Error
): Promise<void> {
    await notifyCriticalError({
        category: 'SERVICE_UNAVAILABLE',
        errorMessage: `Servicio '${serviceName}' no disponible (HTTP ${statusCode})`,
        feature,
        severity: 'CRITICAL',
        error,
        metadata: { serviceName, statusCode }
    })
}
