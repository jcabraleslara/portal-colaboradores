/**
 * Supabase Edge Function: Notificacion de Errores Criticos
 * Portal de Colaboradores - Gestar Salud IPS
 *
 * POST /functions/v1/notify-critical-error
 * Envia alertas por correo cuando ocurren errores criticos.
 */

import { corsHeaders } from '../_shared/cors.ts'
import { sendGmailEmail } from '../_shared/gmail-utils.ts'

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
    userEmail?: string
    userId?: string
    feature: string
    timestamp: string
    metadata?: Record<string, unknown>
}

function getSeverityEmoji(severity: ErrorSeverity): string {
    const emojis: Record<ErrorSeverity, string> = {
        CRITICAL: '🚨',
        HIGH: '⚠️',
        MEDIUM: '⚡'
    }
    return emojis[severity]
}

function getCategoryEmoji(category: ErrorCategory): string {
    const emojis: Record<ErrorCategory, string> = {
        API_KEY_FAILURE: '🔑',
        EMAIL_FAILURE: '📧',
        SERVICE_UNAVAILABLE: '🌐',
        STORAGE_FAILURE: '💾',
        DATABASE_ERROR: '🗄️',
        AUTHENTICATION_ERROR: '🔐',
        INTEGRATION_ERROR: '🔌',
        GEMINI_API_ERROR: '🤖',
        UNKNOWN: '❓'
    }
    return emojis[category]
}

function getSeverityColor(severity: ErrorSeverity): string {
    const colors: Record<ErrorSeverity, string> = {
        CRITICAL: '#dc2626',
        HIGH: '#f59e0b',
        MEDIUM: '#3b82f6'
    }
    return colors[severity]
}

function generarTemplateErrorCritico(error: CriticalErrorPayload): string {
    const severityEmoji = getSeverityEmoji(error.severity)
    const categoryEmoji = getCategoryEmoji(error.category)
    const severityColor = getSeverityColor(error.severity)

    const metadataHtml = error.metadata && Object.keys(error.metadata).length > 0
        ? `
            <h3 style="color: ${severityColor}; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                📊 Metadata Adicional
            </h3>
            <ul style="line-height: 1.8; font-family: 'Courier New', monospace; background-color: #f9fafb; padding: 15px; border-radius: 4px;">
                ${Object.entries(error.metadata)
            .map(([key, value]) => `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`)
            .join('')}
            </ul>
        `
        : ''

    const stackTraceHtml = error.errorStack
        ? `
            <h3 style="color: ${severityColor}; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                🔍 Stack Trace
            </h3>
            <pre style="background-color: #1f2937; color: #f9fafb; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; line-height: 1.5;">${error.errorStack}</pre>
        `
        : ''

    const userInfoHtml = error.userEmail || error.userId
        ? `
            <h3 style="color: ${severityColor}; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                👤 Usuario Afectado
            </h3>
            <ul style="line-height: 1.8;">
                ${error.userEmail ? `<li><strong>Email:</strong> ${error.userEmail}</li>` : ''}
                ${error.userId ? `<li><strong>ID:</strong> ${error.userId}</li>` : ''}
            </ul>
        `
        : ''

    const fechaFormateada = new Date(error.timestamp).toLocaleString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })

    return `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: 0 auto;">
            <div style="background-color: ${severityColor}; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 26px;">${severityEmoji} Error Critico Detectado</h1>
                <p style="margin: 10px 0 0 0; font-size: 14px;">Portal de Colaboradores - Gestar Salud IPS</p>
            </div>

            <div style="padding: 30px; background-color: #f9fafb;">
                <div style="background-color: white; border-left: 5px solid ${severityColor}; padding: 20px; margin: 20px 0; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: ${severityColor}; margin-top: 0; font-size: 20px;">
                        ${categoryEmoji} ${error.category.replace(/_/g, ' ')}
                    </h2>
                    <p style="margin: 5px 0; font-size: 14px; color: #6b7280;">
                        <strong>Severidad:</strong> <span style="color: ${severityColor}; font-weight: bold;">${error.severity}</span>
                    </p>
                    <p style="margin: 5px 0; font-size: 14px; color: #6b7280;">
                        <strong>Modulo:</strong> ${error.feature}
                    </p>
                    <p style="margin: 5px 0; font-size: 14px; color: #6b7280;">
                        <strong>Timestamp:</strong> ${fechaFormateada}
                    </p>
                </div>

                <h3 style="color: ${severityColor}; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                    💬 Mensaje de Error
                </h3>
                <div style="background-color: #fef2f2; border: 2px solid ${severityColor}; padding: 15px; border-radius: 4px; margin: 15px 0;">
                    <p style="margin: 0; font-family: 'Courier New', monospace; color: #7f1d1d; word-wrap: break-word;">
                        ${error.errorMessage}
                    </p>
                </div>

                ${userInfoHtml}
                ${metadataHtml}
                ${stackTraceHtml}

                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                    <strong>⚡ Accion Requerida:</strong>
                    <p style="margin: 10px 0 0 0;">
                        Este error requiere atencion inmediata. Por favor, revise el sistema y tome las medidas correctivas necesarias.
                    </p>
                </div>

                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />

                <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
                    Este es un mensaje automatico del Sistema de Monitoreo de Errores Criticos.<br />
                    Portal de Colaboradores - Gestar Salud IPS
                </p>
            </div>
        </div>
    `
}

Deno.serve(async (req) => {
    // Manejar preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Solo permitir POST
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ success: false, error: 'Metodo no permitido' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        const error = await req.json() as CriticalErrorPayload

        // Validar campos requeridos
        if (!error.severity || !error.category || !error.errorMessage || !error.feature || !error.timestamp) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Faltan campos requeridos: severity, category, errorMessage, feature, timestamp'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Email de destino para notificaciones criticas
        const CRITICAL_ERRORS_EMAIL = 'coordinacionmedica@gestarsaludips.com'

        // Generar subject
        const severityEmoji = getSeverityEmoji(error.severity)
        const categoryEmoji = getCategoryEmoji(error.category)
        const subject = `${severityEmoji} Error ${error.severity} - ${categoryEmoji} ${error.category} - ${error.feature}`

        // Generar template HTML
        const htmlBody = generarTemplateErrorCritico(error)

        // Enviar correo
        await sendGmailEmail(CRITICAL_ERRORS_EMAIL, subject, htmlBody)

        console.log(`[CRITICAL ERROR NOTIFICATION] Sent to ${CRITICAL_ERRORS_EMAIL}:`, {
            severity: error.severity,
            category: error.category,
            feature: error.feature,
            timestamp: error.timestamp
        })

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Notificacion de error critico enviada exitosamente'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error enviando notificacion de error critico:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
