/**
 * Vercel Serverless Function: Envío de Correo de Confirmación de Radicación
 * Portal de Colaboradores - Gestar Salud IPS
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendGmailEmail } from './utils/gmail-utils.js'

interface RequestBody {
    destinatario: string
    radicado: string
    datosRadicacion: {
        eps: string
        regimen: string
        servicioPrestado: string
        fechaAtencion: string
        pacienteNombre: string
        pacienteIdentificacion: string
        archivos: { categoria: string; urls: string[] }[]
        onedriveFolderUrl?: string
    }
}

/**
 * Generar template HTML para correo de confirmación de radicación
 */
function generarTemplateConfirmacion(radicado: string, datos: RequestBody['datosRadicacion']): string {
    // Generar lista de archivos por categoría
    const archivosHtml = datos.archivos
        .filter(grupo => grupo.urls.length > 0)
        .map(grupo => {
            const listaArchivos = grupo.urls
                .map((url, idx) => `<li><a href="${url}" target="_blank">Archivo ${idx + 1}</a></li>`)
                .join('')

            return `
                <h4 style="color: #059669; margin-top: 15px; margin-bottom: 5px;">${grupo.categoria}</h4>
                <ul style="margin: 0; padding-left: 20px;">
                    ${listaArchivos}
                </ul>
            `
        })
        .join('')

    const oneDriveSection = datos.onedriveFolderUrl
        ? `
            <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0;">
                <strong>📁 Carpeta OneDrive:</strong>
                <a href="${datos.onedriveFolderUrl}" target="_blank" style="color: #0284c7; text-decoration: none;">
                    Acceder a carpeta en OneDrive
                </a>
            </div>
        `
        : ''

    return `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">✅ Radicación Exitosa</h1>
            </div>
            
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Cordial saludo,</p>
                
                <p>Le confirmamos que su radicación ha sido creada exitosamente con el siguiente número:</p>
                
                <div style="background-color: #d1fae5; border: 2px solid #059669; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                    <h2 style="color: #059669; margin: 0; font-size: 28px;">${radicado}</h2>
                    <p style="color: #047857; margin: 5px 0 0 0; font-size: 14px;">Número de Radicado</p>
                </div>

                <h3 style="color: #059669; border-bottom: 2px solid #d1fae5; padding-bottom: 8px;">📋 Información del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                    <li><strong>Identificación:</strong> ${datos.pacienteIdentificacion}</li>
                </ul>

                <h3 style="color: #059669; border-bottom: 2px solid #d1fae5; padding-bottom: 8px;">🏥 Información del Servicio</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>EPS:</strong> ${datos.eps}</li>
                    <li><strong>Régimen:</strong> ${datos.regimen}</li>
                    <li><strong>Servicio Prestado:</strong> ${datos.servicioPrestado}</li>
                    <li><strong>Fecha de Atención:</strong> ${new Date(datos.fechaAtencion).toLocaleDateString('es-CO')}</li>
                </ul>

                <h3 style="color: #059669; border-bottom: 2px solid #d1fae5; padding-bottom: 8px;">📎 Archivos Adjuntos</h3>
                ${archivosHtml}

                ${oneDriveSection}

                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                    <strong>⏳ Próximos Pasos:</strong>
                    <p style="margin: 10px 0 0 0;">
                        Su radicación será revisada por el área de facturación. Recibirá una notificación cuando 
                        cambie el estado de su radicado.
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
        if (!body.destinatario || !body.radicado || !body.datosRadicacion) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos requeridos: destinatario, radicado, datosRadicacion'
            })
        }

        // Generar template HTML
        const subject = `Confirmación de Radicación - ${body.radicado}`
        const htmlBody = generarTemplateConfirmacion(body.radicado, body.datosRadicacion)

        // Enviar correo
        await sendGmailEmail(body.destinatario, subject, htmlBody)

        return res.status(200).json({
            success: true,
            message: 'Correo enviado exitosamente'
        })

    } catch (error) {
        console.error('Error en send-radicacion-email:', error)
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        })
    }
}
