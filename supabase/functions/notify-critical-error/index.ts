/**
 * Supabase Edge Function: Notificacion de Errores Criticos
 * Portal de Colaboradores - Gestar Salud IPS
 *
 * POST /functions/v1/notify-critical-error
 * Envia alertas por correo cuando ocurren errores criticos.
 */

import { corsHeaders } from '../_shared/cors.ts'
import { sendGmailEmail, type InlineImage } from '../_shared/gmail-utils.ts'
import { GESTAR_LOGO_BASE64, COLORS, EMAIL_FONTS } from '../_shared/email-templates.ts'

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
        CRITICAL: '&#128680;',
        HIGH: '&#9888;&#65039;',
        MEDIUM: '&#9889;'
    }
    return emojis[severity]
}

function getCategoryEmoji(category: ErrorCategory): string {
    const emojis: Record<ErrorCategory, string> = {
        API_KEY_FAILURE: '&#128273;',
        EMAIL_FAILURE: '&#128231;',
        SERVICE_UNAVAILABLE: '&#127760;',
        STORAGE_FAILURE: '&#128190;',
        DATABASE_ERROR: '&#128452;',
        AUTHENTICATION_ERROR: '&#128274;',
        INTEGRATION_ERROR: '&#128268;',
        GEMINI_API_ERROR: '&#129302;',
        UNKNOWN: '&#10067;'
    }
    return emojis[category]
}

function getSeverityColor(severity: ErrorSeverity): { primary: string; dark: string } {
    const colors: Record<ErrorSeverity, { primary: string; dark: string }> = {
        CRITICAL: { primary: COLORS.error, dark: COLORS.errorDark },
        HIGH: { primary: COLORS.warning, dark: COLORS.warningDark },
        MEDIUM: { primary: '#3b82f6', dark: '#2563eb' }
    }
    return colors[severity]
}

function generarTemplateErrorCritico(error: CriticalErrorPayload): string {
    const severityEmoji = getSeverityEmoji(error.severity)
    const categoryEmoji = getCategoryEmoji(error.category)
    const severityColors = getSeverityColor(error.severity)

    const metadataHtml = error.metadata && Object.keys(error.metadata).length > 0
        ? `
            <h3 style="color: ${severityColors.primary}; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                &#128202; Metadata Adicional
            </h3>
            <ul style="line-height: 1.8; font-family: ${EMAIL_FONTS.monospace}; background-color: #f9fafb; padding: 15px; border-radius: 4px;">
                ${Object.entries(error.metadata)
            .map(([key, value]) => `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`)
            .join('')}
            </ul>
        `
        : ''

    const stackTraceHtml = error.errorStack
        ? `
            <h3 style="color: ${severityColors.primary}; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                &#128269; Stack Trace
            </h3>
            <pre style="background-color: #1f2937; color: #f9fafb; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; line-height: 1.5;">${error.errorStack}</pre>
        `
        : ''

    const userInfoHtml = error.userEmail || error.userId
        ? `
            <h3 style="color: ${severityColors.primary}; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                &#128100; Usuario Afectado
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
        <div style="font-family: ${EMAIL_FONTS.primary}; color: ${COLORS.text}; max-width: 700px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header con Logo -->
            <div style="background: linear-gradient(135deg, ${severityColors.primary} 0%, ${severityColors.dark} 100%); padding: 24px 30px; text-align: center;">
                <img src="cid:logo-gestar" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 12px;" />
                <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">
                    ${severityEmoji} Error Critico Detectado
                </h1>
                <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; color: white;">Portal de Colaboradores - Gestar Salud IPS</p>
            </div>

            <!-- Contenido Principal -->
            <div style="padding: 30px; background-color: ${COLORS.background};">
                <div style="background-color: white; border-left: 5px solid ${severityColors.primary}; padding: 20px; margin: 20px 0; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: ${severityColors.primary}; margin-top: 0; font-size: 20px;">
                        ${categoryEmoji} ${error.category.replace(/_/g, ' ')}
                    </h2>
                    <p style="margin: 5px 0; font-size: 14px; color: ${COLORS.textSecondary};">
                        <strong>Severidad:</strong> <span style="color: ${severityColors.primary}; font-weight: bold;">${error.severity}</span>
                    </p>
                    <p style="margin: 5px 0; font-size: 14px; color: ${COLORS.textSecondary};">
                        <strong>Modulo:</strong> ${error.feature}
                    </p>
                    <p style="margin: 5px 0; font-size: 14px; color: ${COLORS.textSecondary};">
                        <strong>Timestamp:</strong> ${fechaFormateada}
                    </p>
                </div>

                <h3 style="color: ${severityColors.primary}; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                    &#128172; Mensaje de Error
                </h3>
                <div style="background-color: ${COLORS.errorLight}; border: 2px solid ${severityColors.primary}; padding: 15px; border-radius: 4px; margin: 15px 0;">
                    <p style="margin: 0; font-family: ${EMAIL_FONTS.monospace}; color: #7f1d1d; word-wrap: break-word;">
                        ${error.errorMessage}
                    </p>
                </div>

                ${userInfoHtml}
                ${metadataHtml}
                ${stackTraceHtml}

                <div style="background-color: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0;">
                    <strong>&#9889; Accion Requerida:</strong>
                    <p style="margin: 10px 0 0 0;">
                        Este error requiere atencion inmediata. Por favor, revise el sistema y tome las medidas correctivas necesarias.
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje automatico del Sistema de Monitoreo de Errores Criticos.<br />
                    <strong style="color: #E2E8F0;">Portal de Colaboradores de Gestar Salud IPS</strong>
                </p>
                <p style="font-size: 11px; color: #64748B; margin: 12px 0 0 0;">
                    &#169; ${new Date().getFullYear()} Gestar Salud de Colombia IPS S.A.S.
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

        // Generar subject (emojis en subject van como Unicode directo, solo en HTML usan entities)
        const subject = `Error ${error.severity} - ${error.category} - ${error.feature}`

        // Generar template HTML
        const htmlBody = generarTemplateErrorCritico(error)

        // Logo corporativo inline
        const inlineImages: InlineImage[] = [{
            cid: 'logo-gestar',
            content: GESTAR_LOGO_BASE64,
            mimeType: 'image/png'
        }]

        // Enviar correo con logo inline
        await sendGmailEmail({
            to: CRITICAL_ERRORS_EMAIL,
            subject,
            htmlBody,
            inlineImages
        })

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
