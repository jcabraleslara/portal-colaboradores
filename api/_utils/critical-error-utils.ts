/**
 * Utilidades para Notificación de Errores Críticos desde APIs Serverless
 * Portal de Colaboradores - Gestar Salud IPS
 * 
 * Este módulo permite enviar notificaciones de errores críticos desde las
 * APIs serverless (Vercel Functions) llamando al endpoint de notificación.
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
 * Enviar notificación de error crítico desde API serverless
 * 
 * @param options - Opciones del error crítico
 * @returns true si la notificación se envió exitosamente
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

        // Determinar la URL base del endpoint de notificación
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000'

        const response = await fetch(`${baseUrl}/api/notify-critical-error`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            console.error('[CRITICAL ERROR UTILS] Failed to send notification:', await response.text())
            return false
        }

        const result = await response.json()
        console.log('[CRITICAL ERROR UTILS] ✅ Notificación enviada:', options.category, options.feature)
        return result.success

    } catch (error) {
        // No queremos que el sistema de notificación rompa las APIs serverless
        console.error('[CRITICAL ERROR UTILS] Error enviando notificación:', error)
        return false
    }
}

/**
 * Wrapper para reportar fallos de API keys desde serverless
 */
export async function notifyApiKeyFailure(
    apiName: string,
    feature: string,
    statusCode: number,
    error?: Error
): Promise<void> {
    await notifyCriticalError({
        category: 'API_KEY_FAILURE',
        errorMessage: `${apiName} retornó error ${statusCode} - Posible API key inválida o expirada`,
        feature,
        severity: 'CRITICAL',
        error,
        metadata: { apiName, statusCode }
    })
}

/**
 * Wrapper para reportar errores de autenticación OAuth2 desde serverless
 */
export async function notifyAuthenticationError(
    provider: string,
    feature: string,
    statusCode: number,
    error?: Error
): Promise<void> {
    await notifyCriticalError({
        category: 'AUTHENTICATION_ERROR',
        errorMessage: `Error de autenticación con ${provider} (${statusCode}) - Credenciales OAuth2 pueden estar expiradas`,
        feature,
        severity: 'CRITICAL',
        error,
        metadata: { provider, statusCode }
    })
}

/**
 * Wrapper para reportar servicios no disponibles desde serverless
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
