/**
 * Vercel Serverless Function: Notificación de Errores Críticos
 * Portal de Colaboradores - Gestar Salud IPS
 * 
 * Envía alertas por correo cuando ocurren errores críticos que requieren
 * intervención inmediata del equipo técnico.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendGmailEmail } from './_utils/gmail-utils.js'

/**
 * Severidad del error crítico
 */
type ErrorSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM'

/**
 * Categoría del error para mejor clasificación
 */
type ErrorCategory =
    | 'API_KEY_FAILURE'          // API keys que no funcionan
    | 'EMAIL_FAILURE'            // Correos que no se envían
    | 'SERVICE_UNAVAILABLE'      // Servicios externos caídos
    | 'STORAGE_FAILURE'          // Fallas en Supabase Storage
    | 'DATABASE_ERROR'           // Errores de base de datos
    | 'AUTHENTICATION_ERROR'     // Problemas de autenticación
    | 'INTEGRATION_ERROR'        // Errores en integraciones (OneDrive, Airtable, etc)
    | 'GEMINI_API_ERROR'         // Errores con Gemini AI
    | 'UNKNOWN'                  // Errores no clasificados

interface CriticalErrorPayload {
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
 * Obtener emoji según severidad
 */
function getSeverityEmoji(severity: ErrorSeverity): string {
    const emojis: Record<ErrorSeverity, string> = {
        CRITICAL: '🚨',
        HIGH: '⚠️',
        MEDIUM: '⚡'
    }
    return emojis[severity]
}

/**
 * Obtener emoji según categoría
 */
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

/**
 * Obtener color según severidad
 */
function getSeverityColor(severity: ErrorSeverity): string {
    const colors: Record<ErrorSeverity, string> = {
        CRITICAL: '#dc2626',   // Rojo intenso
        HIGH: '#f59e0b',       // Naranja
        MEDIUM: '#3b82f6'      // Azul
    }
    return colors[severity]
}

/**
 * Generar template HTML para notificación de error crítico
 */
function generarTemplateErrorCritico(error: CriticalErrorPayload): string {
    const severityEmoji = getSeverityEmoji(error.severity)
    const categoryEmoji = getCategoryEmoji(error.category)
    const severityColor = getSeverityColor(error.severity)

    // Formatear metadata si existe
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

    // Formatear stack trace si existe
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

    return `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: 0 auto;">
            <div style="background-color: ${severityColor}; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 26px;">${severityEmoji} Error Crítico Detectado</h1>
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
                        <strong>Módulo:</strong> ${error.feature}
                    </p>
                    <p style="margin: 5px 0; font-size: 14px; color: #6b7280;">
                        <strong>Timestamp:</strong> ${new Date(error.timestamp).toLocaleString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })}
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
                    <strong>⚡ Acción Requerida:</strong>
                    <p style="margin: 10px 0 0 0;">
                        Este error requiere atención inmediata. Por favor, revise el sistema y tome las medidas correctivas necesarias.
                    </p>
                </div>

                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                
                <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
                    Este es un mensaje automático del Sistema de Monitoreo de Errores Críticos.<br />
                    Portal de Colaboradores - Gestar Salud IPS
                </p>
            </div>
        </div>
    `
}

/**
 * Handler principal
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Solo permitir POST
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' })
    }

    try {
        const error = req.body as CriticalErrorPayload

        // Validar campos requeridos
        if (!error.severity || !error.category || !error.errorMessage || !error.feature || !error.timestamp) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos requeridos: severity, category, errorMessage, feature, timestamp'
            })
        }

        // Email de destino para notificaciones críticas
        const CRITICAL_ERRORS_EMAIL = 'coordinacionmedica@gestarsaludips.com'

        // Generar subject
        const severityEmoji = getSeverityEmoji(error.severity)
        const categoryEmoji = getCategoryEmoji(error.category)
        const subject = `${severityEmoji} Error ${error.severity} - ${categoryEmoji} ${error.category} - ${error.feature}`

        // Generar template HTML
        const htmlBody = generarTemplateErrorCritico(error)

        // Enviar correo
        await sendGmailEmail(CRITICAL_ERRORS_EMAIL, subject, htmlBody)

        // Log para debugging
        console.log(`[CRITICAL ERROR NOTIFICATION] Sent to ${CRITICAL_ERRORS_EMAIL}:`, {
            severity: error.severity,
            category: error.category,
            feature: error.feature,
            timestamp: error.timestamp
        })

        return res.status(200).json({
            success: true,
            message: 'Notificación de error crítico enviada exitosamente'
        })

    } catch (error) {
        console.error('Error enviando notificación de error crítico:', error)
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        })
    }
}
