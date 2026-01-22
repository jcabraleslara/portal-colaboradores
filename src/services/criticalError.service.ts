/**
 * Servicio de Notificación de Errores Críticos
 * Portal de Colaboradores - Gestar Salud IPS
 * 
 * Servicio centralizado para reportar errores críticos que requieren intervención
 * inmediata del equipo técnico mediante notificaciones por correo electrónico.
 */

/**
 * Severidad del error crítico
 */
export type ErrorSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM'

/**
 * Categoría del error para mejor clasificación
 */
export type ErrorCategory =
    | 'API_KEY_FAILURE'          // API keys que no funcionan
    | 'EMAIL_FAILURE'            // Correos que no se envían
    | 'SERVICE_UNAVAILABLE'      // Servicios externos caídos
    | 'STORAGE_FAILURE'          // Fallas en Supabase Storage
    | 'DATABASE_ERROR'           // Errores de base de datos
    | 'AUTHENTICATION_ERROR'     // Problemas de autenticación
    | 'INTEGRATION_ERROR'        // Errores en integraciones (OneDrive, Airtable, etc)
    | 'GEMINI_API_ERROR'         // Errores con Gemini AI
    | 'UNKNOWN'                  // Errores no clasificados

/**
 * Payload para reportar error crítico
 */
export interface CriticalErrorPayload {
    severity: ErrorSeverity
    category: ErrorCategory
    errorMessage: string
    errorStack?: string
    userEmail?: string
    userId?: string
    feature: string              // Nombre del módulo/funcionalidad afectada
    timestamp: string
    metadata?: Record<string, unknown>  // Datos adicionales del contexto
}

/**
 * Opciones para reportar error crítico (simplificadas para el usuario)
 */
export interface ReportCriticalErrorOptions {
    category: ErrorCategory
    errorMessage: string
    feature: string
    severity?: ErrorSeverity      // Por defecto: CRITICAL
    error?: Error                 // Objeto Error nativo de JavaScript
    metadata?: Record<string, unknown>
}

/**
 * Servicio de notificación de errores críticos
 */
export const criticalErrorService = {
    /**
     * Reportar un error crítico que requiere intervención técnica
     * 
     * @param options - Opciones del error crítico
     * @returns true si la notificación se envió exitosamente
     * 
     * @example
     * ```typescript
     * // Reportar fallo de API key de Gemini
     * await criticalErrorService.reportCriticalError({
     *   category: 'GEMINI_API_ERROR',
     *   errorMessage: 'Gemini API retornó 401 - API key inválida',
     *   feature: 'Generación de Contrarreferencias',
     *   severity: 'CRITICAL',
     *   metadata: { model: 'gemini-2.5-flash', statusCode: 401 }
     * })
     * 
     * // Reportar fallo de envío de correo
     * await criticalErrorService.reportCriticalError({
     *   category: 'EMAIL_FAILURE',
     *   errorMessage: 'No se pudo enviar correo de confirmación de radicación',
     *   feature: 'Soportes de Facturación',
     *   metadata: { destinatario: 'usuario@example.com', radicado: 'FACT0001' }
     * })
     * ```
     */
    async reportCriticalError(options: ReportCriticalErrorOptions): Promise<boolean> {
        try {
            // Obtener información del usuario actual si está disponible
            let userEmail: string | undefined
            let userId: string | undefined

            try {
                const userDataStr = localStorage.getItem('userData')
                if (userDataStr) {
                    const userData = JSON.parse(userDataStr)
                    userEmail = userData.correo || userData.email
                    userId = userData.id?.toString()
                }
            } catch {
                // Ignorar si no hay datos de usuario
            }

            // Construir payload completo
            const payload: CriticalErrorPayload = {
                severity: options.severity || 'CRITICAL',
                category: options.category,
                errorMessage: options.errorMessage,
                errorStack: options.error?.stack,
                userEmail,
                userId,
                feature: options.feature,
                timestamp: new Date().toISOString(),
                metadata: options.metadata
            }

            // Enviar notificación al endpoint serverless
            const response = await fetch('/api/notify-critical-error', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                console.error('[CRITICAL ERROR SERVICE] Failed to send notification:', await response.text())
                return false
            }

            const result = await response.json()
            console.log('[CRITICAL ERROR SERVICE] ✅ Notificación enviada exitosamente:', {
                category: options.category,
                feature: options.feature
            })

            return result.success

        } catch (error) {
            // No queremos que el sistema de notificación rompa la aplicación
            console.error('[CRITICAL ERROR SERVICE] Error enviando notificación de error crítico:', error)
            return false
        }
    },

    /**
     * Wrapper para reportar fallos de API keys
     */
    async reportApiKeyFailure(
        apiName: string,
        feature: string,
        statusCode: number,
        error?: Error
    ): Promise<void> {
        await this.reportCriticalError({
            category: 'API_KEY_FAILURE',
            errorMessage: `${apiName} retornó error ${statusCode} - Posible API key inválida o expirada`,
            feature,
            severity: 'CRITICAL',
            error,
            metadata: { apiName, statusCode }
        })
    },

    /**
     * Wrapper para reportar fallos de envío de correo
     */
    async reportEmailFailure(
        destinatario: string,
        feature: string,
        tipoCorreo: string,
        error?: Error
    ): Promise<void> {
        await this.reportCriticalError({
            category: 'EMAIL_FAILURE',
            errorMessage: `No se pudo enviar correo de tipo '${tipoCorreo}' a ${destinatario}`,
            feature,
            severity: 'HIGH',
            error,
            metadata: { destinatario, tipoCorreo }
        })
    },

    /**
     * Wrapper para reportar servicios externos no disponibles
     */
    async reportServiceUnavailable(
        serviceName: string,
        feature: string,
        statusCode: number,
        error?: Error
    ): Promise<void> {
        await this.reportCriticalError({
            category: 'SERVICE_UNAVAILABLE',
            errorMessage: `Servicio '${serviceName}' no disponible (HTTP ${statusCode})`,
            feature,
            severity: 'CRITICAL',
            error,
            metadata: { serviceName, statusCode }
        })
    },

    /**
     * Wrapper para reportar fallos en Supabase Storage
     */
    async reportStorageFailure(
        operation: string,
        feature: string,
        bucket: string,
        error?: Error
    ): Promise<void> {
        await this.reportCriticalError({
            category: 'STORAGE_FAILURE',
            errorMessage: `Fallo en operación '${operation}' en bucket '${bucket}' de Supabase Storage`,
            feature,
            severity: 'HIGH',
            error,
            metadata: { operation, bucket }
        })
    },

    /**
     * Wrapper para reportar errores de base de datos
     */
    async reportDatabaseError(
        query: string,
        feature: string,
        error?: Error
    ): Promise<void> {
        await this.reportCriticalError({
            category: 'DATABASE_ERROR',
            errorMessage: `Error ejecutando query en base de datos`,
            feature,
            severity: 'CRITICAL',
            error,
            metadata: { query: query.substring(0, 200) } // Limitar longitud
        })
    },

    /**
     * Wrapper para reportar errores de integración (OneDrive, Airtable, etc)
     */
    async reportIntegrationError(
        integrationName: string,
        feature: string,
        operation: string,
        error?: Error
    ): Promise<void> {
        await this.reportCriticalError({
            category: 'INTEGRATION_ERROR',
            errorMessage: `Fallo en integración con ${integrationName} al ejecutar '${operation}'`,
            feature,
            severity: 'HIGH',
            error,
            metadata: { integrationName, operation }
        })
    },

    /**
     * Wrapper para reportar errores de Gemini AI
     */
    async reportGeminiError(
        feature: string,
        model: string,
        statusCode: number,
        error?: Error
    ): Promise<void> {
        await this.reportCriticalError({
            category: 'GEMINI_API_ERROR',
            errorMessage: `Gemini API (${model}) retornó error ${statusCode}`,
            feature,
            severity: 'HIGH',
            error,
            metadata: { model, statusCode }
        })
    }
}
