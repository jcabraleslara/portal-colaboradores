/**
 * Supabase Edge Function: Envío de Correos (Radicación, Rechazo, Devolución, etc.)
 * Portal de Colaboradores - Gestar Salud IPS
 *
 * POST /functions/v1/send-email
 */

import { corsHeaders } from '../_shared/cors.ts'
import { sendGmailEmail, type EmailAttachment, type InlineImage } from '../_shared/gmail-utils.ts'
import { GESTAR_LOGO_BASE64, COLORS, EMAIL_FONTS } from '../_shared/email-templates.ts'

// ==========================================
// INTERFACES
// ==========================================

interface BaseDatosRadicacion {
    eps: string
    regimen: string
    servicioPrestado: string
    fechaAtencion: string
    pacienteNombre: string
    pacienteIdentificacion: string
    pacienteTipoId?: string
    archivos: { categoria: string; urls: string[] }[]
}

interface DatosRadicacionExitosa extends BaseDatosRadicacion {
    fechaRadicacion?: string
    radicadorEmail?: string
}

interface DatosRechazo extends BaseDatosRadicacion {
    pacienteTipoId: string
    fechaRadicacion: string
    observacionesFacturacion: string
}

interface DatosDevolucion extends BaseDatosRadicacion {
    pacienteTipoId: string
    fechaRadicacion: string
    observacionesDevolucion: string
    tipoSolicitud?: string
}

interface DatosNoContactable {
    pacienteNombre: string
    pacienteIdentificacion: string
    pacienteTipoId?: string
    radicado: string
    fechaGestion: string
}

interface DatosDevolucionRecobro {
    pacienteNombre: string
    pacienteIdentificacion: string
    pacienteTipoId?: string
    cupsData: { cups: string; descripcion: string; cantidad: number; es_principal: boolean }[]
    respuestaAuditor: string
    fechaDevolucion: string
}

interface DatosAprobacionRecobro {
    pacienteNombre: string
    pacienteIdentificacion: string
    pacienteTipoId?: string
    cupsData: { cups: string; descripcion: string; cantidad: number; es_principal: boolean }[]
    pdfUrl?: string
    fechaAprobacion: string
}

interface DatosFalloSubida {
    archivosFallidos: { categoria: string; nombres: string[] }[]
    archivosExitosos: number
    totalArchivos: number
    timestamp: string
    erroresDetalle?: { nombre: string; razon: string }[]
}

interface DatosEnrutado {
    pacienteNombre: string
    pacienteIdentificacion: string
    pacienteTipoId: string
    eps: string
    ipsPrimaria: string
    ruta: string
    telefono?: string
    direccion?: string
    municipio?: string
    fechaRadicacion: string
    observaciones?: string
    archivosUrls?: string[]  // URLs de los archivos para enlaces de descarga
}

interface RequestBody {
    type: 'radicacion' | 'rechazo' | 'devolucion' | 'no_contactable' | 'devolucion_recobro' | 'aprobacion_recobro' | 'enrutado' | 'fallo_subida'
    destinatario: string | string[]  // Soporta multiples destinatarios
    cc?: string | string[]           // Copias opcionales
    radicado: string
    datos: DatosRadicacionExitosa | DatosRechazo | DatosDevolucion | DatosNoContactable | DatosDevolucionRecobro | DatosAprobacionRecobro | DatosEnrutado | DatosFalloSubida
    adjuntos?: EmailAttachment[]     // Adjuntos opcionales para enrutado
}

// ==========================================
// TEMPLATES
// ==========================================

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-CO')
}

function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

/**
 * Extraer nombre del archivo desde una URL firmada de Supabase Storage
 * URL típica: https://xxx.supabase.co/storage/v1/object/sign/bucket/FACT1234/archivo.pdf?token=...
 */
function extractFilenameFromUrl(url: string): string {
    try {
        const urlObj = new URL(url)
        const pathName = decodeURIComponent(urlObj.pathname)
        const fileName = pathName.split('/').pop() || ''
        return fileName || 'Archivo'
    } catch {
        return 'Archivo'
    }
}

function generarTemplateConfirmacion(radicado: string, datos: DatosRadicacionExitosa): string {
    const archivosHtml = datos.archivos
        .filter(grupo => grupo.urls.length > 0)
        .map(grupo => {
            const listaArchivos = grupo.urls
                .map(url => {
                    const nombre = extractFilenameFromUrl(url)
                    return `<li style="margin: 3px 0;"><a href="${url}" target="_blank" style="color: ${COLORS.primary}; text-decoration: none; font-size: 14px;">${nombre}</a></li>`
                })
                .join('')
            return `
                <tr>
                    <td style="padding: 12px 15px; vertical-align: top; border-bottom: 1px solid #E2E8F0; width: 180px;">
                        <strong style="color: ${COLORS.text}; font-size: 14px;">${grupo.categoria}</strong>
                    </td>
                    <td style="padding: 12px 15px; vertical-align: top; border-bottom: 1px solid #E2E8F0;">
                        <ul style="margin: 0; padding-left: 0; list-style: none;">${listaArchivos}</ul>
                    </td>
                </tr>
            `
        })
        .join('')

    const fechaRadicacionHtml = datos.fechaRadicacion
        ? `<tr>
            <td style="padding: 10px 15px; color: ${COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0; width: 180px;">Fecha Radicaci&oacute;n</td>
            <td style="padding: 10px 15px; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${formatDateTime(datos.fechaRadicacion)}</td>
        </tr>`
        : ''

    const correoFacturadorHtml = datos.radicadorEmail
        ? `<tr>
            <td style="padding: 10px 15px; color: ${COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0; width: 180px;">Correo Facturador</td>
            <td style="padding: 10px 15px; font-size: 14px; border-bottom: 1px solid #E2E8F0;">
                <a href="mailto:${datos.radicadorEmail}" style="color: ${COLORS.primary}; text-decoration: none;">${datos.radicadorEmail}</a>
            </td>
        </tr>`
        : ''

    return `
        <div style="font-family: ${EMAIL_FONTS.primary}; color: ${COLORS.text}; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header con Logo -->
            <div style="background: linear-gradient(135deg, ${COLORS.success} 0%, ${COLORS.successDark} 100%); padding: 24px 30px; text-align: center;">
                <img src="cid:logo-gestar" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 12px;" />
                <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">
                    &#9989; Radicaci&oacute;n Exitosa
                </h1>
            </div>

            <!-- Contenido Principal -->
            <div style="padding: 30px; background-color: ${COLORS.background};">
                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6;">Cordial saludo,</p>
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Le confirmamos que su radicaci&oacute;n ha sido creada exitosamente con el siguiente n&uacute;mero:</p>
                <div style="background-color: ${COLORS.successLight}; border: 2px solid ${COLORS.success}; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                    <h2 style="color: ${COLORS.success}; margin: 0; font-size: 28px;">${radicado}</h2>
                    <p style="color: ${COLORS.successDark}; margin: 5px 0 0 0; font-size: 14px;">N&uacute;mero de Radicado</p>
                </div>

                <!-- Datos de la Radicaci&oacute;n -->
                <h3 style="color: ${COLORS.success}; border-bottom: 2px solid ${COLORS.successLight}; padding-bottom: 8px;">&#128203; Datos de la Radicaci&oacute;n</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
                    ${fechaRadicacionHtml}
                    ${correoFacturadorHtml}
                    <tr>
                        <td style="padding: 10px 15px; color: ${COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0; width: 180px;">R&eacute;gimen</td>
                        <td style="padding: 10px 15px; border-bottom: 1px solid #E2E8F0;">
                            <span style="display: inline-block; background-color: #1E293B; color: #ffffff; padding: 4px 12px; border-radius: 4px; font-size: 13px; font-weight: 600;">${datos.regimen}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 15px; color: ${COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0; width: 180px;">EPS</td>
                        <td style="padding: 10px 15px; border-bottom: 1px solid #E2E8F0;">
                            <span style="display: inline-block; background-color: ${COLORS.primary}; color: #ffffff; padding: 4px 12px; border-radius: 4px; font-size: 13px; font-weight: 600;">${datos.eps}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 15px; color: ${COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0; width: 180px;">Servicio Prestado</td>
                        <td style="padding: 10px 15px; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${datos.servicioPrestado}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 15px; color: ${COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0; width: 180px;">Fecha de Atenci&oacute;n</td>
                        <td style="padding: 10px 15px; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${formatDate(datos.fechaAtencion)}</td>
                    </tr>
                </table>

                <!-- Informaci&oacute;n del Paciente -->
                <h3 style="color: ${COLORS.success}; border-bottom: 2px solid ${COLORS.successLight}; padding-bottom: 8px;">&#128100; Informaci&oacute;n del Paciente</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
                    <tr>
                        <td style="padding: 10px 15px; color: ${COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0; width: 180px;">Nombre</td>
                        <td style="padding: 10px 15px; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${datos.pacienteNombre}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 15px; color: ${COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0; width: 180px;">Identificaci&oacute;n</td>
                        <td style="padding: 10px 15px; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${datos.pacienteIdentificacion}</td>
                    </tr>
                </table>

                <!-- Archivos por Categoria -->
                <h3 style="color: ${COLORS.success}; border-bottom: 2px solid ${COLORS.successLight}; padding-bottom: 8px;">&#128206; Archivos Adjuntos</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
                    ${archivosHtml}
                </table>
                <div style="background-color: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0;">
                    <strong>&#9203; Pr&oacute;ximos Pasos:</strong>
                    <p style="margin: 10px 0 0 0;">Su radicaci&oacute;n ser&aacute; revisada por el &aacute;rea de facturaci&oacute;n. Recibir&aacute; una notificaci&oacute;n cuando cambie el estado de su radicado.</p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje autom&aacute;tico generado por el<br />
                    <strong style="color: #E2E8F0;">Portal de Colaboradores de Gestar Salud IPS</strong><br />
                    No responda a este correo.
                </p>
                <p style="font-size: 11px; color: #64748B; margin: 12px 0 0 0;">
                    &#169; ${new Date().getFullYear()} Gestar Salud de Colombia IPS S.A.S.
                </p>
            </div>
        </div>
    `
}

function generarTemplateRechazo(radicado: string, datos: DatosRechazo): string {
    const archivosHtml = datos.archivos
        .filter(grupo => grupo.urls.length > 0)
        .map(grupo => {
            const listaArchivos = grupo.urls
                .map((url, idx) => `<li><a href="${url}" target="_blank" style="color: ${COLORS.error}; text-decoration: none;">Archivo ${idx + 1}</a></li>`)
                .join('')
            return `
                <h4 style="color: ${COLORS.error}; margin-top: 15px; margin-bottom: 5px;">${grupo.categoria}</h4>
                <ul style="margin: 0; padding-left: 20px;">${listaArchivos}</ul>
            `
        })
        .join('')

    return `
        <div style="font-family: ${EMAIL_FONTS.primary}; color: ${COLORS.text}; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header con Logo -->
            <div style="background: linear-gradient(135deg, ${COLORS.error} 0%, ${COLORS.errorDark} 100%); padding: 24px 30px; text-align: center;">
                <img src="cid:logo-gestar" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 12px;" />
                <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">
                    &#9888;&#65039; Radicado Rechazado
                </h1>
            </div>

            <!-- Contenido Principal -->
            <div style="padding: 30px; background-color: ${COLORS.background};">
                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6;">Cordial saludo,</p>
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Le informamos que su radicado <strong>${radicado}</strong> ha sido rechazado por el &aacute;rea de facturaci&oacute;n.</p>
                <div style="background-color: ${COLORS.errorLight}; border: 3px solid ${COLORS.error}; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: ${COLORS.error}; margin-top: 0; margin-bottom: 10px;">&#128172; Observaciones de Facturaci&oacute;n</h3>
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #7f1d1d;">${datos.observacionesFacturacion}</p>
                </div>
                <h3 style="color: ${COLORS.error}; border-bottom: 2px solid ${COLORS.errorLight}; padding-bottom: 8px;">&#128203; Informaci&oacute;n del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Tipo de Identificaci&oacute;n:</strong> ${datos.pacienteTipoId}</li>
                    <li><strong>Identificaci&oacute;n:</strong> ${datos.pacienteIdentificacion}</li>
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                </ul>
                <h3 style="color: ${COLORS.error}; border-bottom: 2px solid ${COLORS.errorLight}; padding-bottom: 8px;">&#127973; Informaci&oacute;n del Servicio</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>EPS:</strong> ${datos.eps}</li>
                    <li><strong>R&eacute;gimen:</strong> ${datos.regimen}</li>
                    <li><strong>Servicio Prestado:</strong> ${datos.servicioPrestado}</li>
                    <li><strong>Fecha de Atenci&oacute;n:</strong> ${formatDate(datos.fechaAtencion)}</li>
                </ul>
                <h3 style="color: ${COLORS.error}; border-bottom: 2px solid ${COLORS.errorLight}; padding-bottom: 8px;">&#128197; Fechas</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Fecha de Radicaci&oacute;n:</strong> ${formatDateTime(datos.fechaRadicacion)}</li>
                    <li><strong>Fecha de Rechazo:</strong> ${formatDateTime(new Date().toISOString())}</li>
                </ul>
                <h3 style="color: ${COLORS.error}; border-bottom: 2px solid ${COLORS.errorLight}; padding-bottom: 8px;">&#128206; Archivos Radicados</h3>
                ${archivosHtml}
                <div style="background-color: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0;">
                    <strong>&#128260; Pr&oacute;ximos Pasos:</strong>
                    <p style="margin: 10px 0 0 0;">Por favor, subsane las observaciones mencionadas y radique nuevamente los soportes corregidos a trav&eacute;s del Portal de Colaboradores.</p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje autom&aacute;tico generado por el<br />
                    <strong style="color: #E2E8F0;">Portal de Colaboradores de Gestar Salud IPS</strong><br />
                    No responda a este correo.
                </p>
                <p style="font-size: 11px; color: #64748B; margin: 12px 0 0 0;">
                    &#169; ${new Date().getFullYear()} Gestar Salud de Colombia IPS S.A.S.
                </p>
            </div>
        </div>
    `
}

function generarTemplateDevolucion(radicado: string, datos: DatosDevolucion): string {
    const archivosHtml = datos.archivos
        .filter(grupo => grupo.urls.length > 0)
        .map(grupo => {
            const listaArchivos = grupo.urls
                .map((url, idx) => `<li><a href="${url}" target="_blank" style="color: ${COLORS.warning}; text-decoration: none;">Archivo ${idx + 1}</a></li>`)
                .join('')
            return `
                <h4 style="color: ${COLORS.warning}; margin-top: 15px; margin-bottom: 5px;">${grupo.categoria}</h4>
                <ul style="margin: 0; padding-left: 20px;">${listaArchivos}</ul>
            `
        })
        .join('')

    return `
        <div style="font-family: ${EMAIL_FONTS.primary}; color: ${COLORS.text}; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header con Logo -->
            <div style="background: linear-gradient(135deg, ${COLORS.warning} 0%, ${COLORS.warningDark} 100%); padding: 24px 30px; text-align: center;">
                <img src="cid:logo-gestar" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 12px;" />
                <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">
                    &#9888;&#65039; Radicado Devuelto
                </h1>
            </div>

            <!-- Contenido Principal -->
            <div style="padding: 30px; background-color: ${COLORS.background};">
                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6;">Cordial saludo,</p>
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Le informamos que su radicado <strong>${radicado}</strong> ha sido devuelto por el &aacute;rea de Gesti&oacute;n Back.</p>
                <div style="background-color: ${COLORS.warningLight}; border: 3px solid ${COLORS.warning}; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: ${COLORS.warningDark}; margin-top: 0; margin-bottom: 10px;">&#128172; Observaciones de Devoluci&oacute;n</h3>
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #78350F;">${datos.observacionesDevolucion}</p>
                </div>
                <h3 style="color: ${COLORS.warning}; border-bottom: 2px solid ${COLORS.warningLight}; padding-bottom: 8px;">&#128203; Informaci&oacute;n del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Tipo de Identificaci&oacute;n:</strong> ${datos.pacienteTipoId}</li>
                    <li><strong>Identificaci&oacute;n:</strong> ${datos.pacienteIdentificacion}</li>
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                </ul>
                <h3 style="color: ${COLORS.warning}; border-bottom: 2px solid ${COLORS.warningLight}; padding-bottom: 8px;">&#127973; Informaci&oacute;n del Servicio</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>EPS:</strong> ${datos.eps}</li>
                    <li><strong>R&eacute;gimen:</strong> ${datos.regimen}</li>
                    <li><strong>Servicio Prestado:</strong> ${datos.servicioPrestado}</li>
                    <li><strong>Fecha de Atenci&oacute;n:</strong> ${formatDate(datos.fechaAtencion)}</li>
                    ${datos.tipoSolicitud ? `<li><strong>Tipo Solicitud:</strong> ${datos.tipoSolicitud}</li>` : ''}
                </ul>
                <h3 style="color: ${COLORS.warning}; border-bottom: 2px solid ${COLORS.warningLight}; padding-bottom: 8px;">&#128197; Fechas</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Fecha de Radicaci&oacute;n:</strong> ${formatDateTime(datos.fechaRadicacion)}</li>
                    <li><strong>Fecha de Devoluci&oacute;n:</strong> ${formatDateTime(new Date().toISOString())}</li>
                </ul>
                <h3 style="color: ${COLORS.warning}; border-bottom: 2px solid ${COLORS.warningLight}; padding-bottom: 8px;">&#128206; Archivos Radicados</h3>
                ${archivosHtml}
                <div style="background-color: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0;">
                    <strong>&#128260; Pr&oacute;ximos Pasos:</strong>
                    <p style="margin: 10px 0 0 0;">Por favor, subsane las observaciones mencionadas y gestione nuevamente el caso o contacte al &aacute;rea correspondiente.</p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje autom&aacute;tico generado por el<br />
                    <strong style="color: #E2E8F0;">Portal de Colaboradores de Gestar Salud IPS</strong><br />
                    No responda a este correo.
                </p>
                <p style="font-size: 11px; color: #64748B; margin: 12px 0 0 0;">
                    &#169; ${new Date().getFullYear()} Gestar Salud de Colombia IPS S.A.S.
                </p>
            </div>
        </div>
    `
}

function generarTemplateNoContactable(radicado: string, datos: DatosNoContactable): string {
    return `
        <div style="font-family: ${EMAIL_FONTS.primary}; color: ${COLORS.text}; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header con Logo -->
            <div style="background: linear-gradient(135deg, ${COLORS.slate600} 0%, ${COLORS.slate700} 100%); padding: 24px 30px; text-align: center;">
                <img src="cid:logo-gestar" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 12px;" />
                <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">
                    &#128245; Paciente No Contactable
                </h1>
            </div>

            <!-- Contenido Principal -->
            <div style="padding: 30px; background-color: ${COLORS.background};">
                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6;">Cordial saludo,</p>
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Le informamos que en la gesti&oacute;n del radicado <strong>${radicado}</strong>, hemos intentado contactar al paciente sin &eacute;xito.</p>
                <div style="background-color: ${COLORS.slate100}; border: 3px solid ${COLORS.slate600}; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: ${COLORS.slate700}; margin-top: 0; margin-bottom: 10px;">&#128205; Informaci&oacute;n del Intento</h3>
                    <ul style="line-height: 1.8; color: ${COLORS.slate700};">
                        <li><strong>Paciente:</strong> ${datos.pacienteNombre}</li>
                        <li><strong>Identificaci&oacute;n:</strong> ${datos.pacienteIdentificacion}</li>
                        <li><strong>Fecha de Gesti&oacute;n:</strong> ${datos.fechaGestion}</li>
                    </ul>
                </div>
                <div style="background-color: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0;">
                    <strong>&#128260; Acci&oacute;n Requerida:</strong>
                    <p style="margin: 10px 0 0 0;">Le sugerimos <strong>validar los datos de contacto del paciente</strong> (tel&eacute;fonos, direcci&oacute;n) y realizar un nuevo radicado con la informaci&oacute;n actualizada para poder gestionar su solicitud.</p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje autom&aacute;tico generado por el<br />
                    <strong style="color: #E2E8F0;">Portal de Colaboradores de Gestar Salud IPS</strong><br />
                    No responda a este correo.
                </p>
                <p style="font-size: 11px; color: #64748B; margin: 12px 0 0 0;">
                    &#169; ${new Date().getFullYear()} Gestar Salud de Colombia IPS S.A.S.
                </p>
            </div>
        </div>
    `
}

function generarTemplateDevolucionRecobro(consecutivo: string, datos: DatosDevolucionRecobro): string {
    const cupsHtml = datos.cupsData
        .map(cups => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                    ${cups.es_principal ? '&#11088; ' : ''}<code style="background-color: #e0f2fe; padding: 2px 6px; border-radius: 4px; color: #0369a1;">${cups.cups}</code>
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${cups.descripcion}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${cups.cantidad}</td>
            </tr>
        `)
        .join('')

    return `
        <div style="font-family: ${EMAIL_FONTS.primary}; color: ${COLORS.text}; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header con Logo -->
            <div style="background: linear-gradient(135deg, ${COLORS.error} 0%, ${COLORS.errorDark} 100%); padding: 24px 30px; text-align: center;">
                <img src="cid:logo-gestar" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 12px;" />
                <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">
                    &#128260; Recobro Devuelto
                </h1>
            </div>

            <!-- Contenido Principal -->
            <div style="padding: 30px; background-color: ${COLORS.background};">
                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6;">Cordial saludo,</p>
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Le informamos que su solicitud de recobro <strong>${consecutivo}</strong> ha sido devuelta por el &aacute;rea de Auditor&iacute;a.</p>
                <div style="background-color: ${COLORS.errorLight}; border: 3px solid ${COLORS.error}; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: ${COLORS.error}; margin-top: 0; margin-bottom: 10px;">&#128221; Motivo de Devoluci&oacute;n</h3>
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #7f1d1d;">${datos.respuestaAuditor}</p>
                </div>
                <h3 style="color: ${COLORS.error}; border-bottom: 2px solid ${COLORS.errorLight}; padding-bottom: 8px;">&#128203; Informaci&oacute;n del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                    <li><strong>Identificaci&oacute;n:</strong> ${datos.pacienteIdentificacion}</li>
                </ul>
                <h3 style="color: ${COLORS.error}; border-bottom: 2px solid ${COLORS.errorLight}; padding-bottom: 8px;">&#127973; Procedimientos Solicitados</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                    <thead>
                        <tr style="background-color: ${COLORS.errorLight};">
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid ${COLORS.error};">C&oacute;digo</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid ${COLORS.error};">Descripci&oacute;n</th>
                            <th style="padding: 8px; text-align: center; border-bottom: 2px solid ${COLORS.error};">Cant.</th>
                        </tr>
                    </thead>
                    <tbody>${cupsHtml}</tbody>
                </table>
                <p style="font-size: 12px; color: ${COLORS.textSecondary};">&#11088; = Procedimiento principal</p>
                <div style="background-color: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0;">
                    <strong>&#128260; Pr&oacute;ximos Pasos:</strong>
                    <p style="margin: 10px 0 0 0;">Por favor, revise las observaciones indicadas y realice los ajustes necesarios. Puede radicar nuevamente la solicitud de recobro con la informaci&oacute;n corregida.</p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje autom&aacute;tico generado por el<br />
                    <strong style="color: #E2E8F0;">Portal de Colaboradores de Gestar Salud IPS</strong><br />
                    No responda a este correo.
                </p>
                <p style="font-size: 11px; color: #64748B; margin: 12px 0 0 0;">
                    &#169; ${new Date().getFullYear()} Gestar Salud de Colombia IPS S.A.S.
                </p>
            </div>
        </div>
    `
}

function generarTemplateAprobacionRecobro(consecutivo: string, datos: DatosAprobacionRecobro): string {
    const cupsHtml = datos.cupsData
        .map(cups => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">
                    ${cups.es_principal ? '&#11088; ' : ''}<code style="background-color: ${COLORS.primaryLight}; padding: 2px 8px; border-radius: 4px; color: ${COLORS.primary}; font-weight: 600;">${cups.cups}</code>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-size: 14px;">${cups.descripcion}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center; font-weight: 600;">${cups.cantidad}</td>
            </tr>
        `)
        .join('')

    // Nota: El PDF ahora se adjunta directamente al correo
    const pdfNote = datos.pdfUrl
        ? `<div style="background-color: ${COLORS.primaryLight}; border-left: 4px solid ${COLORS.primary}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <strong style="color: ${COLORS.primaryDark};">&#128206; Carta de Autorizaci&oacute;n Adjunta</strong>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: ${COLORS.text};">
                La carta de autorizaci&oacute;n se encuentra adjunta a este correo en formato PDF.
            </p>
        </div>`
        : ''

    return `
        <div style="font-family: ${EMAIL_FONTS.primary}; color: ${COLORS.text}; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header con Logo -->
            <div style="background-color: ${COLORS.primary}; background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%); padding: 24px 30px; text-align: center;">
                <img src="cid:logo-gestar" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 12px;" />
                <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">
                    &#9989; Recobro Aprobado
                </h1>
            </div>

            <!-- Contenido Principal -->
            <div style="padding: 30px; background-color: ${COLORS.background};">
                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6;">Cordial saludo,</p>
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">
                    Nos complace informarle que su solicitud de recobro <strong>${consecutivo}</strong> ha sido
                    <strong style="color: ${COLORS.success};">APROBADA</strong> por el &aacute;rea de Auditor&iacute;a.
                </p>

                <!-- Card Estado -->
                <div style="background-color: #ffffff; border: 2px solid ${COLORS.success}; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <h2 style="color: ${COLORS.success}; margin: 0; font-size: 26px; font-weight: 700;">&#10003; APROBADO</h2>
                    <p style="color: ${COLORS.textSecondary}; margin: 10px 0 0 0; font-size: 14px;">
                        Consecutivo: <strong style="color: ${COLORS.text}; font-family: ${EMAIL_FONTS.monospace};">${consecutivo}</strong>
                    </p>
                </div>

                <!-- Datos del Paciente -->
                <h3 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primaryLight}; padding-bottom: 8px; margin-top: 24px; font-size: 16px; font-weight: 600;">
                    &#128203; Informaci&oacute;n del Paciente
                </h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
                    <tr>
                        <td style="padding: 10px 0; color: ${COLORS.textSecondary}; width: 140px; font-size: 14px; border-bottom: 1px solid #E2E8F0;">Nombre:</td>
                        <td style="padding: 10px 0; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${datos.pacienteNombre}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: ${COLORS.textSecondary}; font-size: 14px;">Identificaci&oacute;n:</td>
                        <td style="padding: 10px 0; font-weight: 600; font-size: 14px;">${datos.pacienteIdentificacion}</td>
                    </tr>
                </table>

                <!-- Procedimientos -->
                <h3 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primaryLight}; padding-bottom: 8px; margin-top: 24px; font-size: 16px; font-weight: 600;">
                    &#127973; Procedimientos Aprobados
                </h3>
                <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
                    <thead>
                        <tr style="background-color: ${COLORS.primaryLight};">
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid ${COLORS.primary}; font-size: 13px; color: ${COLORS.primaryDark};">C&oacute;digo</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid ${COLORS.primary}; font-size: 13px; color: ${COLORS.primaryDark};">Descripci&oacute;n</th>
                            <th style="padding: 10px; text-align: center; border-bottom: 2px solid ${COLORS.primary}; font-size: 13px; color: ${COLORS.primaryDark};">Cant.</th>
                        </tr>
                    </thead>
                    <tbody>${cupsHtml}</tbody>
                </table>
                <p style="font-size: 12px; color: ${COLORS.textSecondary};">&#11088; = Procedimiento principal</p>

                ${pdfNote}

                <!-- Informaci&oacute;n Importante -->
                <div style="background-color: #FEF3C7; border-left: 4px solid ${COLORS.warning}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <strong style="color: #92400E; font-size: 14px;">&#128205; Informaci&oacute;n Importante:</strong>
                    <p style="margin: 8px 0 0 0; font-size: 14px; color: #78350F; line-height: 1.5;">
                        La carta de autorizaci&oacute;n ha sido generada y almacenada. Tambi&eacute;n puede acceder directamente desde el Portal de Colaboradores en la secci&oacute;n de Gesti&oacute;n de Recobros.
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje autom&aacute;tico generado por el<br />
                    <strong style="color: #E2E8F0;">Portal de Colaboradores de Gestar Salud IPS</strong><br />
                    No responda a este correo.
                </p>
                <p style="font-size: 11px; color: #64748B; margin: 12px 0 0 0;">
                    &#169; ${new Date().getFullYear()} Gestar Salud de Colombia IPS S.A.S.
                </p>
            </div>
        </div>
    `
}

function generarTemplateEnrutado(radicado: string, datos: DatosEnrutado): string {
    const archivosHtml = datos.archivosUrls && datos.archivosUrls.length > 0
        ? `
            <h3 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primaryLight}; padding-bottom: 8px;">&#128206; Documentos Adjuntos</h3>
            <ul style="line-height: 1.8;">
                ${datos.archivosUrls.map((url, idx) => `
                    <li><a href="${url}" target="_blank" style="color: ${COLORS.primary}; text-decoration: none;">
                        &#128196; Documento ${idx + 1}
                    </a></li>
                `).join('')}
            </ul>
        `
        : ''

    return `
        <div style="font-family: ${EMAIL_FONTS.primary}; color: ${COLORS.text}; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header con Logo -->
            <div style="background-color: ${COLORS.primary}; background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%); padding: 24px 30px; text-align: center;">
                <img src="cid:logo-gestar" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 12px;" />
                <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">
                    Activaci&oacute;n de Ruta: ${datos.ruta}
                </h1>
            </div>

            <!-- Contenido Principal -->
            <div style="padding: 30px; background-color: ${COLORS.background};">
                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6;">Cordial saludo,</p>
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">
                    Se ha activado la <strong style="color: ${COLORS.primary};">Ruta ${datos.ruta}</strong> para el siguiente paciente. Por favor gestionar a la brevedad:
                </p>

                <!-- Card Paciente -->
                <div style="background-color: #ffffff; border: 1px solid #E2E8F0; border-left: 4px solid ${COLORS.primary}; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="vertical-align: top;">
                                <h2 style="color: ${COLORS.text}; margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">${datos.pacienteNombre}</h2>
                                <p style="color: ${COLORS.textSecondary}; margin: 0; font-size: 14px;">
                                    <strong>${datos.pacienteTipoId}:</strong> ${datos.pacienteIdentificacion}
                                </p>
                            </td>
                            <td style="text-align: right; vertical-align: top; width: 120px;">
                                <p style="color: ${COLORS.textSecondary}; margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Radicado</p>
                                <p style="color: ${COLORS.primary}; margin: 0; font-size: 16px; font-weight: 700; font-family: ${EMAIL_FONTS.monospace};">${radicado}</p>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Datos del Paciente -->
                <h3 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primaryLight}; padding-bottom: 8px; margin-top: 24px; font-size: 16px; font-weight: 600;">
                    &#128203; Datos del Paciente
                </h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
                    <tr>
                        <td style="padding: 10px 0; color: ${COLORS.textSecondary}; width: 140px; font-size: 14px; border-bottom: 1px solid #E2E8F0;">EPS:</td>
                        <td style="padding: 10px 0; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${datos.eps}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: ${COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0;">IPS Primaria:</td>
                        <td style="padding: 10px 0; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${datos.ipsPrimaria}</td>
                    </tr>
                    ${datos.telefono ? `
                    <tr>
                        <td style="padding: 10px 0; color: ${COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0;">Tel&eacute;fono:</td>
                        <td style="padding: 10px 0; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E2E8F0;">
                            <a href="tel:${datos.telefono}" style="color: ${COLORS.primary}; text-decoration: none;">${datos.telefono}</a>
                        </td>
                    </tr>
                    ` : ''}
                    ${datos.direccion ? `
                    <tr>
                        <td style="padding: 10px 0; color: ${COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0;">Direcci&oacute;n:</td>
                        <td style="padding: 10px 0; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${datos.direccion}</td>
                    </tr>
                    ` : ''}
                    ${datos.municipio ? `
                    <tr>
                        <td style="padding: 10px 0; color: ${COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0;">Municipio:</td>
                        <td style="padding: 10px 0; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${datos.municipio}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td style="padding: 10px 0; color: ${COLORS.textSecondary}; font-size: 14px;">Fecha Radicaci&oacute;n:</td>
                        <td style="padding: 10px 0; font-size: 14px;">${formatDateTime(datos.fechaRadicacion)}</td>
                    </tr>
                </table>

                ${datos.observaciones ? `
                <h3 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primaryLight}; padding-bottom: 8px; margin-top: 24px; font-size: 16px; font-weight: 600;">
                    &#128221; Observaciones
                </h3>
                <div style="background-color: #ffffff; padding: 16px; border-radius: 8px; border-left: 4px solid ${COLORS.success}; margin-top: 12px;">
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; font-size: 14px; color: ${COLORS.text};">${datos.observaciones}</p>
                </div>
                ` : ''}

                ${archivosHtml}

                <!-- Call to Action -->
                <div style="background-color: #FEF3C7; border-left: 4px solid ${COLORS.warning}; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                    <strong style="color: #92400E; font-size: 14px;">&#9889; Acci&oacute;n Requerida:</strong>
                    <p style="margin: 8px 0 0 0; font-size: 14px; color: #78350F; line-height: 1.5;">
                        Por favor contacte al paciente y realice la gesti&oacute;n correspondiente seg&uacute;n el protocolo de la <strong>Ruta ${datos.ruta}</strong>.
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje autom&aacute;tico generado por el<br />
                    <strong style="color: #E2E8F0;">Portal de Colaboradores de Gestar Salud IPS</strong><br />
                    No responda a este correo.
                </p>
                <p style="font-size: 11px; color: #64748B; margin: 12px 0 0 0;">
                    &#169; ${new Date().getFullYear()} Gestar Salud de Colombia IPS S.A.S.
                </p>
            </div>
        </div>
    `
}

function generarTemplateFalloSubida(radicado: string, datos: DatosFalloSubida): string {
    const categoriasMap: Record<string, string> = {
        'validacion_derechos': 'Validaci&oacute;n de Derechos',
        'autorizacion': 'Autorizaci&oacute;n',
        'soporte_clinico': 'Soporte Cl&iacute;nico',
        'comprobante_recibo': 'Comprobante de Recibo',
        'orden_medica': 'Orden M&eacute;dica',
        'descripcion_quirurgica': 'Descripci&oacute;n Quir&uacute;rgica',
        'registro_anestesia': 'Registro de Anestesia',
        'hoja_medicamentos': 'Hoja de Medicamentos',
        'notas_enfermeria': 'Notas de Enfermer&iacute;a',
    }

    const totalFallidos = datos.archivosFallidos.reduce((acc, f) => acc + f.nombres.length, 0)

    // Crear mapa de razones por nombre de archivo para lookup rápido
    const razonesMap = new Map<string, string>()
    if (datos.erroresDetalle) {
        for (const e of datos.erroresDetalle) {
            razonesMap.set(e.nombre, e.razon)
        }
    }

    // Clasificar errores para generar recomendaciones específicas
    const tieneErrorVacio = datos.erroresDetalle?.some(e => e.razon.includes('vac&iacute;o') || e.razon.includes('vacío') || e.razon.includes('0 bytes')) ?? false
    const tieneErrorTamanio = datos.erroresDetalle?.some(e => e.razon.includes('excede') || e.razon.includes('l&iacute;mite') || e.razon.includes('límite') || e.razon.includes('MB')) ?? false
    const tieneErrorCorrupto = datos.erroresDetalle?.some(e => e.razon.includes('corrupto') || e.razon.includes('v&aacute;lido') || e.razon.includes('válido')) ?? false
    const tieneErrorRed = datos.erroresDetalle?.some(e => e.razon.includes('conexi&oacute;n') || e.razon.includes('conexión') || e.razon.includes('servidor')) ?? false
    const tieneErrorLectura = datos.erroresDetalle?.some(e => e.razon.includes('leer') || e.razon.includes('contenido')) ?? false

    // Determinar causa principal para el mensaje introductorio
    let causaPrincipal = 'problemas durante el procesamiento'
    if (tieneErrorCorrupto && !tieneErrorRed) causaPrincipal = 'problemas con el contenido de los archivos'
    else if (tieneErrorVacio && !tieneErrorRed) causaPrincipal = 'archivos que se encuentran vac&iacute;os o sin contenido'
    else if (tieneErrorTamanio && !tieneErrorRed) causaPrincipal = 'archivos que exceden el tama&ntilde;o m&aacute;ximo permitido'
    else if (tieneErrorRed && !tieneErrorCorrupto && !tieneErrorVacio) causaPrincipal = 'problemas de conexi&oacute;n con el servidor'

    const fallidosHtml = datos.archivosFallidos
        .map(grupo => {
            const categoriaNombre = categoriasMap[grupo.categoria] || grupo.categoria
            const archivosLista = grupo.nombres
                .map(nombre => {
                    const razon = razonesMap.get(nombre)
                    const razonHtml = razon
                        ? `<br/><span style="font-size: 12px; color: ${COLORS.error}; font-style: italic;">Motivo: ${razon}</span>`
                        : ''
                    return `<li style="margin: 6px 0; font-size: 14px; color: ${COLORS.slate700};">
                        <strong>${nombre}</strong>${razonHtml}
                    </li>`
                })
                .join('')
            return `
                <div style="margin-bottom: 16px; background-color: #ffffff; border: 1px solid ${COLORS.errorLight}; border-radius: 8px; padding: 14px;">
                    <h4 style="color: ${COLORS.warningDark}; margin: 0 0 8px 0; font-size: 14px;">&#128194; ${categoriaNombre}</h4>
                    <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">${archivosLista}</ul>
                </div>
            `
        })
        .join('')

    // Generar recomendaciones específicas según los tipos de error detectados
    const recomendaciones: string[] = []

    if (tieneErrorVacio) {
        recomendaciones.push(
            'Uno o m&aacute;s archivos est&aacute;n vac&iacute;os (0 bytes). Esto suele ocurrir cuando el archivo no se descarg&oacute; completamente o se guard&oacute; de forma incorrecta. <strong>Vuelva a descargar o generar el documento original</strong> y verifique que se pueda abrir correctamente antes de cargarlo.'
        )
    }

    if (tieneErrorTamanio) {
        recomendaciones.push(
            'Uno o m&aacute;s archivos exceden el tama&ntilde;o m&aacute;ximo de <strong>10 MB</strong>. Puede reducir el tama&ntilde;o del PDF usando herramientas en l&iacute;nea como <em>ilovepdf.com</em> (comprimir PDF), o escaneando el documento con una resoluci&oacute;n m&aacute;s baja.'
        )
    }

    if (tieneErrorCorrupto) {
        recomendaciones.push(
            'Uno o m&aacute;s archivos parecen estar da&ntilde;ados o corruptos. <strong>Abra el archivo en su computador</strong> para verificar que se visualice correctamente. Si el archivo no se abre o muestra errores, vuelva a descargarlo desde la fuente original (correo, sistema, esc&aacute;ner).'
        )
    }

    if (tieneErrorLectura) {
        recomendaciones.push(
            'No se pudo leer el contenido de uno o m&aacute;s archivos. Aseg&uacute;rese de que el archivo no est&eacute; abierto en otro programa y que no est&eacute; protegido con contrase&ntilde;a. Cierre cualquier programa que pueda estar us&aacute;ndolo y vuelva a intentar.'
        )
    }

    if (tieneErrorRed) {
        recomendaciones.push(
            'Hubo problemas de conexi&oacute;n al subir archivos al servidor. <strong>Verifique que su conexi&oacute;n a internet sea estable</strong>. Si est&aacute; usando Wi-Fi, intente acercarse al router o usar datos m&oacute;viles como alternativa.'
        )
    }

    // Recomendación siempre presente
    recomendaciones.push(
        'Los archivos que se subieron exitosamente <strong>ya quedaron guardados</strong> en el sistema. Solo necesita volver a cargar los archivos que fallaron.'
    )

    const recomendacionesHtml = recomendaciones
        .map(r => `<li style="margin: 8px 0; font-size: 13px; line-height: 1.7; color: ${COLORS.slate700};">${r}</li>`)
        .join('')

    return `
        <div style="font-family: ${EMAIL_FONTS.primary}; color: ${COLORS.text}; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, ${COLORS.warning} 0%, ${COLORS.warningDark} 100%); padding: 24px 30px; text-align: center;">
                <img src="cid:logo-gestar" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 12px;" />
                <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">
                    &#9888;&#65039; Archivos Pendientes de Subida
                </h1>
            </div>

            <!-- Contenido -->
            <div style="padding: 30px; background-color: ${COLORS.background};">
                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6;">Cordial saludo,</p>
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">
                    Le informamos que durante la radicaci&oacute;n del siguiente caso, <strong>${totalFallidos} archivo(s)</strong> no pudieron ser procesados debido a <strong>${causaPrincipal}</strong>.
                </p>

                <!-- Radicado -->
                <div style="background-color: ${COLORS.warningLight}; border: 2px solid ${COLORS.warning}; padding: 16px; text-align: center; margin: 20px 0; border-radius: 8px;">
                    <h2 style="color: ${COLORS.warningDark}; margin: 0; font-size: 24px;">${radicado}</h2>
                    <p style="color: ${COLORS.slate600}; margin: 5px 0 0 0; font-size: 13px;">N&uacute;mero de Radicado</p>
                </div>

                <!-- Resumen -->
                <div style="display: flex; gap: 12px; margin: 20px 0;">
                    <div style="flex: 1; background-color: ${COLORS.successLight}; border-radius: 8px; padding: 14px; text-align: center;">
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${COLORS.success};">${datos.archivosExitosos}</p>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: ${COLORS.slate600};">Exitosos</p>
                    </div>
                    <div style="flex: 1; background-color: ${COLORS.errorLight}; border-radius: 8px; padding: 14px; text-align: center;">
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${COLORS.error};">${totalFallidos}</p>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: ${COLORS.slate600};">Fallidos</p>
                    </div>
                    <div style="flex: 1; background-color: ${COLORS.primaryLight}; border-radius: 8px; padding: 14px; text-align: center;">
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${COLORS.primary};">${datos.totalArchivos}</p>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: ${COLORS.slate600};">Total</p>
                    </div>
                </div>

                <!-- Archivos Fallidos con motivo -->
                <h3 style="color: ${COLORS.error}; border-bottom: 2px solid ${COLORS.errorLight}; padding-bottom: 8px; margin-top: 24px;">
                    &#128196; Archivos que requieren atenci&oacute;n
                </h3>
                ${fallidosHtml}

                <!-- Accion Requerida -->
                <div style="background-color: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                    <strong style="color: ${COLORS.warningDark};">&#9889; Acci&oacute;n Requerida:</strong>
                    <p style="margin: 10px 0 0 0; font-size: 14px; line-height: 1.6; color: ${COLORS.slate700};">
                        Ingrese al <strong>Portal de Colaboradores</strong>, busque el radicado <strong>${radicado}</strong>
                        en la pesta&ntilde;a <em>Gesti&oacute;n de Radicados</em> y vuelva a cargar &uacute;nicamente los archivos que fallaron.
                    </p>
                </div>

                <!-- Recomendaciones específicas -->
                <div style="background-color: ${COLORS.infoLight}; border-left: 4px solid ${COLORS.info}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <strong style="color: ${COLORS.primary};">&#128161; Recomendaciones seg&uacute;n el tipo de error:</strong>
                    <ul style="margin: 10px 0 0 0; padding-left: 18px; list-style-type: none;">
                        ${recomendacionesHtml}
                    </ul>
                </div>

                <p style="margin: 20px 0 0 0; font-size: 13px; color: ${COLORS.textSecondary};">
                    Fecha del intento: ${datos.timestamp}
                </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje autom&aacute;tico generado por el<br />
                    <strong style="color: #E2E8F0;">Portal de Colaboradores de Gestar Salud IPS</strong><br />
                    No responda a este correo.
                </p>
                <p style="font-size: 11px; color: #64748B; margin: 12px 0 0 0;">
                    &#169; ${new Date().getFullYear()} Gestar Salud de Colombia IPS S.A.S.
                </p>
            </div>
        </div>
    `
}

// ==========================================
// HANDLER PRINCIPAL
// ==========================================

// @ts-ignore
Deno.serve(async (req: Request) => {
    // Manejar preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Solo permitir POST
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ success: false, error: 'Método no permitido' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        const body = await req.json() as RequestBody

        // Validar campos requeridos (destinatario puede ser string o array)
        const tieneDestinatario = body.destinatario &&
            (typeof body.destinatario === 'string' ||
                (Array.isArray(body.destinatario) && body.destinatario.length > 0))

        if (!body.type || !tieneDestinatario || !body.radicado || !body.datos) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Faltan campos requeridos: type, destinatario, radicado, datos'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        let subject = ''
        let htmlBody = ''

        // Helper para construir sufijo de trazabilidad: TipoId ID - Nombre
        const buildPacienteSuffix = (datos: { pacienteTipoId?: string; pacienteIdentificacion: string; pacienteNombre: string }) => {
            const tipoId = datos.pacienteTipoId || 'CC'
            return `${tipoId} ${datos.pacienteIdentificacion} - ${datos.pacienteNombre}`
        }

        if (body.type === 'radicacion') {
            const datos = body.datos as DatosRadicacionExitosa
            subject = `Confirmación de Radicación - ${body.radicado} - ${buildPacienteSuffix(datos)}`
            htmlBody = generarTemplateConfirmacion(body.radicado, datos)
        } else if (body.type === 'rechazo') {
            const datos = body.datos as DatosRechazo
            subject = `Rechazo de Radicado - ${body.radicado} - ${buildPacienteSuffix(datos)}`
            htmlBody = generarTemplateRechazo(body.radicado, datos)
        } else if (body.type === 'devolucion') {
            const datos = body.datos as DatosDevolucion
            subject = `Devolución de Caso - ${body.radicado} - ${buildPacienteSuffix(datos)}`
            htmlBody = generarTemplateDevolucion(body.radicado, datos)
        } else if (body.type === 'no_contactable') {
            const datos = body.datos as DatosNoContactable
            subject = `Paciente No Contactable - ${body.radicado} - ${buildPacienteSuffix(datos)}`
            htmlBody = generarTemplateNoContactable(body.radicado, datos)
        } else if (body.type === 'devolucion_recobro') {
            const datos = body.datos as DatosDevolucionRecobro
            subject = `Recobro Devuelto - ${body.radicado} - ${buildPacienteSuffix(datos)}`
            htmlBody = generarTemplateDevolucionRecobro(body.radicado, datos)
        } else if (body.type === 'aprobacion_recobro') {
            const datosRecobro = body.datos as DatosAprobacionRecobro
            subject = `Recobro Aprobado - ${body.radicado} - ${buildPacienteSuffix(datosRecobro)}`
            htmlBody = generarTemplateAprobacionRecobro(body.radicado, datosRecobro)
        } else if (body.type === 'enrutado') {
            const datosEnrutado = body.datos as DatosEnrutado
            subject = `Ruta ${datosEnrutado.ruta} - ${datosEnrutado.pacienteTipoId} ${datosEnrutado.pacienteIdentificacion} - ${datosEnrutado.pacienteNombre}`
            htmlBody = generarTemplateEnrutado(body.radicado, datosEnrutado)
        } else if (body.type === 'fallo_subida') {
            const datosFallo = body.datos as DatosFalloSubida
            const totalFallidos = datosFallo.archivosFallidos.reduce((acc, f) => acc + f.nombres.length, 0)
            subject = `Archivos Pendientes de Subida - ${body.radicado} (${totalFallidos} archivo${totalFallidos > 1 ? 's' : ''})`
            htmlBody = generarTemplateFalloSubida(body.radicado, datosFallo)
        } else {
            return new Response(
                JSON.stringify({ success: false, error: 'Tipo de correo no válido' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Logo corporativo inline para TODOS los correos
        const inlineImages: InlineImage[] = [{
            cid: 'logo-gestar',
            content: GESTAR_LOGO_BASE64,
            mimeType: 'image/png'
        }]

        await sendGmailEmail({
            to: body.destinatario,
            cc: body.cc,
            subject,
            htmlBody,
            attachments: body.adjuntos,
            inlineImages
        })

        return new Response(
            JSON.stringify({
                success: true,
                message: `Correo de ${body.type} enviado exitosamente`
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error en send-email:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
