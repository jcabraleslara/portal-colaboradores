/**
 * Vercel Serverless Function: Envío de Correo de Rechazo de Radicación
 * Portal de Colaboradores - Gestar Salud IPS
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendGmailEmail } from './utils/gmail-utils'

interface RequestBody {
    destinatario: string
    radicado: string
    observacionesFacturacion: string
    datosRadicacion: {
        eps: string
        regimen: string
        servicioPrestado: string
        fechaAtencion: string
        pacienteNombre: string
        pacienteIdentificacion: string
        pacienteTipoId: string
        archivos: { categoria: string; urls: string[] }[]
        fechaRadicacion: string
    }
}

/**
 * Generar template HTML para correo de rechazo de radicación
 */
function generarTemplateRechazo(
    radicado: string,
    observaciones: string,
    datos: RequestBody['datosRadicacion']
): string {
    // Generar lista de archivos por categoría
    const archivosHtml = datos.archivos
        .filter(grupo => grupo.urls.length > 0)
        .map(grupo => {
            const listaArchivos = grupo.urls
                .map((url, idx) => `<li><a href="${url}" target="_blank">Archivo ${idx + 1}</a></li>`)
                .join('')

            return `
                <h4 style="color: #dc2626; margin-top: 15px; margin-bottom: 5px;">${grupo.categoria}</h4>
                <ul style="margin: 0; padding-left: 20px;">
                    ${listaArchivos}
                </ul>
            `
        })
        .join('')

    return `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">⚠️ Radicado Rechazado</h1>
            </div>
            
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Cordial saludo,</p>
                
                <p>Le informamos que su radicado <strong>${radicado}</strong> ha sido rechazado por el área de facturación.</p>
                
                <div style="background-color: #fef2f2; border: 3px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: #dc2626; margin-top: 0; margin-bottom: 10px;">
                        📝 Observaciones de Facturación
                    </h3>
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #7f1d1d;">
                        ${observaciones}
                    </p>
                </div>

                <h3 style="color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">📋 Información del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Tipo de Identificación:</strong> ${datos.pacienteTipoId}</li>
                    <li><strong>Identificación:</strong> ${datos.pacienteIdentificacion}</li>
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                </ul>

                <h3 style="color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">🏥 Información del Servicio</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>EPS:</strong> ${datos.eps}</li>
                    <li><strong>Régimen:</strong> ${datos.regimen}</li>
                    <li><strong>Servicio Prestado:</strong> ${datos.servicioPrestado}</li>
                    <li><strong>Fecha de Atención:</strong> ${new Date(datos.fechaAtencion).toLocaleDateString('es-CO')}</li>
                </ul>

                <h3 style="color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">📅 Fechas</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Fecha de Radicación:</strong> ${new Date(datos.fechaRadicacion).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}</li>
                    <li><strong>Fecha de Rechazo:</strong> ${new Date().toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}</li>
                </ul>

                <h3 style="color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">📎 Archivos Radicados</h3>
                ${archivosHtml}

                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                    <strong>🔄 Próximos Pasos:</strong>
                    <p style="margin: 10px 0 0 0;">
                        Por favor, subsane las observaciones mencionadas y radique nuevamente los soportes 
                        corregidos a través del Portal de Colaboradores.
                    </p>
                </div>

                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                
                <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
                    Este es un mensaje automático generado por el Portal de Colaboradores de Gestar Salud IPS.<br />
                    No responda a este correo.
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
        const body = req.body as RequestBody

        // Validar campos requeridos
        if (!body.destinatario || !body.radicado || !body.observacionesFacturacion || !body.datosRadicacion) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos requeridos: destinatario, radicado, observacionesFacturacion, datosRadicacion'
            })
        }

        // Generar template HTML
        const subject = `Rechazo de Radicado - ${body.radicado}`
        const htmlBody = generarTemplateRechazo(
            body.radicado,
            body.observacionesFacturacion,
            body.datosRadicacion
        )

        // Enviar correo
        await sendGmailEmail(body.destinatario, subject, htmlBody)

        return res.status(200).json({
            success: true,
            message: 'Correo de rechazo enviado exitosamente'
        })

    } catch (error) {
        console.error('Error en send-rechazo-email:', error)
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        })
    }
}
