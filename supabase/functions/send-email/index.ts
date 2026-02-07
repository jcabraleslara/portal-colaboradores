/**
 * Supabase Edge Function: Envio de Correos (Radicacion, Rechazo, Devolucion, etc.)
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
    onedriveFolderUrl?: string
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

function generarTemplateConfirmacion(radicado: string, datos: DatosRadicacionExitosa): string {
    const archivosHtml = datos.archivos
        .filter(grupo => grupo.urls.length > 0)
        .map(grupo => {
            const listaArchivos = grupo.urls
                .map((url, idx) => `<li><a href="${url}" target="_blank" style="color: ${COLORS.success}; text-decoration: none;">Archivo ${idx + 1}</a></li>`)
                .join('')
            return `
                <h4 style="color: ${COLORS.success}; margin-top: 15px; margin-bottom: 5px;">${grupo.categoria}</h4>
                <ul style="margin: 0; padding-left: 20px;">${listaArchivos}</ul>
            `
        })
        .join('')

    const oneDriveSection = datos.onedriveFolderUrl
        ? `<div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0;">
            <strong>&#128194; Carpeta OneDrive:</strong>
            <a href="${datos.onedriveFolderUrl}" target="_blank" style="color: #0284c7; text-decoration: none;">
                Acceder a carpeta en OneDrive
            </a>
        </div>`
        : ''

    return `
        <div style="font-family: ${EMAIL_FONTS.primary}; color: ${COLORS.text}; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header con Logo -->
            <div style="background: linear-gradient(135deg, ${COLORS.success} 0%, ${COLORS.successDark} 100%); padding: 24px 30px; text-align: center;">
                <img src="cid:logo-gestar" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 12px;" />
                <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">
                    &#9989; Radicacion Exitosa
                </h1>
            </div>

            <!-- Contenido Principal -->
            <div style="padding: 30px; background-color: ${COLORS.background};">
                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6;">Cordial saludo,</p>
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Le confirmamos que su radicacion ha sido creada exitosamente con el siguiente numero:</p>
                <div style="background-color: ${COLORS.successLight}; border: 2px solid ${COLORS.success}; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                    <h2 style="color: ${COLORS.success}; margin: 0; font-size: 28px;">${radicado}</h2>
                    <p style="color: ${COLORS.successDark}; margin: 5px 0 0 0; font-size: 14px;">Numero de Radicado</p>
                </div>
                <h3 style="color: ${COLORS.success}; border-bottom: 2px solid ${COLORS.successLight}; padding-bottom: 8px;">&#128203; Informacion del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                    <li><strong>Identificacion:</strong> ${datos.pacienteIdentificacion}</li>
                </ul>
                <h3 style="color: ${COLORS.success}; border-bottom: 2px solid ${COLORS.successLight}; padding-bottom: 8px;">&#127973; Informacion del Servicio</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>EPS:</strong> ${datos.eps}</li>
                    <li><strong>Regimen:</strong> ${datos.regimen}</li>
                    <li><strong>Servicio Prestado:</strong> ${datos.servicioPrestado}</li>
                    <li><strong>Fecha de Atencion:</strong> ${formatDate(datos.fechaAtencion)}</li>
                </ul>
                <h3 style="color: ${COLORS.success}; border-bottom: 2px solid ${COLORS.successLight}; padding-bottom: 8px;">&#128206; Archivos Adjuntos</h3>
                ${archivosHtml}
                ${oneDriveSection}
                <div style="background-color: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0;">
                    <strong>&#9203; Proximos Pasos:</strong>
                    <p style="margin: 10px 0 0 0;">Su radicacion sera revisada por el area de facturacion. Recibira una notificacion cuando cambie el estado de su radicado.</p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje automatico generado por el<br />
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
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Le informamos que su radicado <strong>${radicado}</strong> ha sido rechazado por el area de facturacion.</p>
                <div style="background-color: ${COLORS.errorLight}; border: 3px solid ${COLORS.error}; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: ${COLORS.error}; margin-top: 0; margin-bottom: 10px;">&#128172; Observaciones de Facturacion</h3>
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #7f1d1d;">${datos.observacionesFacturacion}</p>
                </div>
                <h3 style="color: ${COLORS.error}; border-bottom: 2px solid ${COLORS.errorLight}; padding-bottom: 8px;">&#128203; Informacion del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Tipo de Identificacion:</strong> ${datos.pacienteTipoId}</li>
                    <li><strong>Identificacion:</strong> ${datos.pacienteIdentificacion}</li>
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                </ul>
                <h3 style="color: ${COLORS.error}; border-bottom: 2px solid ${COLORS.errorLight}; padding-bottom: 8px;">&#127973; Informacion del Servicio</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>EPS:</strong> ${datos.eps}</li>
                    <li><strong>Regimen:</strong> ${datos.regimen}</li>
                    <li><strong>Servicio Prestado:</strong> ${datos.servicioPrestado}</li>
                    <li><strong>Fecha de Atencion:</strong> ${formatDate(datos.fechaAtencion)}</li>
                </ul>
                <h3 style="color: ${COLORS.error}; border-bottom: 2px solid ${COLORS.errorLight}; padding-bottom: 8px;">&#128197; Fechas</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Fecha de Radicacion:</strong> ${formatDateTime(datos.fechaRadicacion)}</li>
                    <li><strong>Fecha de Rechazo:</strong> ${formatDateTime(new Date().toISOString())}</li>
                </ul>
                <h3 style="color: ${COLORS.error}; border-bottom: 2px solid ${COLORS.errorLight}; padding-bottom: 8px;">&#128206; Archivos Radicados</h3>
                ${archivosHtml}
                <div style="background-color: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0;">
                    <strong>&#128260; Proximos Pasos:</strong>
                    <p style="margin: 10px 0 0 0;">Por favor, subsane las observaciones mencionadas y radique nuevamente los soportes corregidos a traves del Portal de Colaboradores.</p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje automatico generado por el<br />
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
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Le informamos que su radicado <strong>${radicado}</strong> ha sido devuelto por el area de Gestion Back.</p>
                <div style="background-color: ${COLORS.warningLight}; border: 3px solid ${COLORS.warning}; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: ${COLORS.warningDark}; margin-top: 0; margin-bottom: 10px;">&#128172; Observaciones de Devolucion</h3>
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #78350F;">${datos.observacionesDevolucion}</p>
                </div>
                <h3 style="color: ${COLORS.warning}; border-bottom: 2px solid ${COLORS.warningLight}; padding-bottom: 8px;">&#128203; Informacion del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Tipo de Identificacion:</strong> ${datos.pacienteTipoId}</li>
                    <li><strong>Identificacion:</strong> ${datos.pacienteIdentificacion}</li>
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                </ul>
                <h3 style="color: ${COLORS.warning}; border-bottom: 2px solid ${COLORS.warningLight}; padding-bottom: 8px;">&#127973; Informacion del Servicio</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>EPS:</strong> ${datos.eps}</li>
                    <li><strong>Regimen:</strong> ${datos.regimen}</li>
                    <li><strong>Servicio Prestado:</strong> ${datos.servicioPrestado}</li>
                    <li><strong>Fecha de Atencion:</strong> ${formatDate(datos.fechaAtencion)}</li>
                    ${datos.tipoSolicitud ? `<li><strong>Tipo Solicitud:</strong> ${datos.tipoSolicitud}</li>` : ''}
                </ul>
                <h3 style="color: ${COLORS.warning}; border-bottom: 2px solid ${COLORS.warningLight}; padding-bottom: 8px;">&#128197; Fechas</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Fecha de Radicacion:</strong> ${formatDateTime(datos.fechaRadicacion)}</li>
                    <li><strong>Fecha de Devolucion:</strong> ${formatDateTime(new Date().toISOString())}</li>
                </ul>
                <h3 style="color: ${COLORS.warning}; border-bottom: 2px solid ${COLORS.warningLight}; padding-bottom: 8px;">&#128206; Archivos Radicados</h3>
                ${archivosHtml}
                <div style="background-color: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0;">
                    <strong>&#128260; Proximos Pasos:</strong>
                    <p style="margin: 10px 0 0 0;">Por favor, subsane las observaciones mencionadas y gestione nuevamente el caso o contacte al area correspondiente.</p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje automatico generado por el<br />
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
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Le informamos que en la gestion del radicado <strong>${radicado}</strong>, hemos intentado contactar al paciente sin exito.</p>
                <div style="background-color: ${COLORS.slate100}; border: 3px solid ${COLORS.slate600}; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: ${COLORS.slate700}; margin-top: 0; margin-bottom: 10px;">&#128205; Informacion del Intento</h3>
                    <ul style="line-height: 1.8; color: ${COLORS.slate700};">
                        <li><strong>Paciente:</strong> ${datos.pacienteNombre}</li>
                        <li><strong>Identificacion:</strong> ${datos.pacienteIdentificacion}</li>
                        <li><strong>Fecha de Gestion:</strong> ${datos.fechaGestion}</li>
                    </ul>
                </div>
                <div style="background-color: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0;">
                    <strong>&#128260; Accion Requerida:</strong>
                    <p style="margin: 10px 0 0 0;">Le sugerimos <strong>validar los datos de contacto del paciente</strong> (telefonos, direccion) y realizar un nuevo radicado con la informacion actualizada para poder gestionar su solicitud.</p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje automatico generado por el<br />
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
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Le informamos que su solicitud de recobro <strong>${consecutivo}</strong> ha sido devuelta por el area de Auditoria.</p>
                <div style="background-color: ${COLORS.errorLight}; border: 3px solid ${COLORS.error}; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: ${COLORS.error}; margin-top: 0; margin-bottom: 10px;">&#128221; Motivo de Devolucion</h3>
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #7f1d1d;">${datos.respuestaAuditor}</p>
                </div>
                <h3 style="color: ${COLORS.error}; border-bottom: 2px solid ${COLORS.errorLight}; padding-bottom: 8px;">&#128203; Informacion del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                    <li><strong>Identificacion:</strong> ${datos.pacienteIdentificacion}</li>
                </ul>
                <h3 style="color: ${COLORS.error}; border-bottom: 2px solid ${COLORS.errorLight}; padding-bottom: 8px;">&#127973; Procedimientos Solicitados</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                    <thead>
                        <tr style="background-color: ${COLORS.errorLight};">
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid ${COLORS.error};">Codigo</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid ${COLORS.error};">Descripcion</th>
                            <th style="padding: 8px; text-align: center; border-bottom: 2px solid ${COLORS.error};">Cant.</th>
                        </tr>
                    </thead>
                    <tbody>${cupsHtml}</tbody>
                </table>
                <p style="font-size: 12px; color: ${COLORS.textSecondary};">&#11088; = Procedimiento principal</p>
                <div style="background-color: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0;">
                    <strong>&#128260; Proximos Pasos:</strong>
                    <p style="margin: 10px 0 0 0;">Por favor, revise las observaciones indicadas y realice los ajustes necesarios. Puede radicar nuevamente la solicitud de recobro con la informacion corregida.</p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje automatico generado por el<br />
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
            <strong style="color: ${COLORS.primaryDark};">&#128206; Carta de Autorizacion Adjunta</strong>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: ${COLORS.text};">
                La carta de autorizacion se encuentra adjunta a este correo en formato PDF.
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
                    <strong style="color: ${COLORS.success};">APROBADA</strong> por el area de Auditoria.
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
                    &#128203; Informacion del Paciente
                </h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
                    <tr>
                        <td style="padding: 10px 0; color: ${COLORS.textSecondary}; width: 140px; font-size: 14px; border-bottom: 1px solid #E2E8F0;">Nombre:</td>
                        <td style="padding: 10px 0; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${datos.pacienteNombre}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: ${COLORS.textSecondary}; font-size: 14px;">Identificacion:</td>
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
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid ${COLORS.primary}; font-size: 13px; color: ${COLORS.primaryDark};">Codigo</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid ${COLORS.primary}; font-size: 13px; color: ${COLORS.primaryDark};">Descripcion</th>
                            <th style="padding: 10px; text-align: center; border-bottom: 2px solid ${COLORS.primary}; font-size: 13px; color: ${COLORS.primaryDark};">Cant.</th>
                        </tr>
                    </thead>
                    <tbody>${cupsHtml}</tbody>
                </table>
                <p style="font-size: 12px; color: ${COLORS.textSecondary};">&#11088; = Procedimiento principal</p>

                ${pdfNote}

                <!-- Informacion Importante -->
                <div style="background-color: #FEF3C7; border-left: 4px solid ${COLORS.warning}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <strong style="color: #92400E; font-size: 14px;">&#128205; Informacion Importante:</strong>
                    <p style="margin: 8px 0 0 0; font-size: 14px; color: #78350F; line-height: 1.5;">
                        La carta de autorizacion ha sido generada y almacenada. Tambien puede acceder directamente desde el Portal de Colaboradores en la seccion de Gestion de Recobros.
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje automatico generado por el<br />
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
                    Activacion de Ruta: ${datos.ruta}
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
                        <td style="padding: 10px 0; color: ${COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0;">Telefono:</td>
                        <td style="padding: 10px 0; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E2E8F0;">
                            <a href="tel:${datos.telefono}" style="color: ${COLORS.primary}; text-decoration: none;">${datos.telefono}</a>
                        </td>
                    </tr>
                    ` : ''}
                    ${datos.direccion ? `
                    <tr>
                        <td style="padding: 10px 0; color: ${COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0;">Direccion:</td>
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
                        <td style="padding: 10px 0; color: ${COLORS.textSecondary}; font-size: 14px;">Fecha Radicacion:</td>
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
                    <strong style="color: #92400E; font-size: 14px;">&#9889; Accion Requerida:</strong>
                    <p style="margin: 8px 0 0 0; font-size: 14px; color: #78350F; line-height: 1.5;">
                        Por favor contacte al paciente y realice la gestion correspondiente segun el protocolo de la <strong>Ruta ${datos.ruta}</strong>.
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje automatico generado por el<br />
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
        'validacion_derechos': 'Validacion de Derechos',
        'autorizacion': 'Autorizacion',
        'soporte_clinico': 'Soporte Clinico',
        'comprobante_recibo': 'Comprobante de Recibo',
        'orden_medica': 'Orden Medica',
        'descripcion_quirurgica': 'Descripcion Quirurgica',
        'registro_anestesia': 'Registro de Anestesia',
        'hoja_medicamentos': 'Hoja de Medicamentos',
        'notas_enfermeria': 'Notas de Enfermeria',
    }

    const totalFallidos = datos.archivosFallidos.reduce((acc, f) => acc + f.nombres.length, 0)

    const fallidosHtml = datos.archivosFallidos
        .map(grupo => {
            const categoriaNombre = categoriasMap[grupo.categoria] || grupo.categoria
            const archivosLista = grupo.nombres
                .map(nombre => `<li style="margin: 4px 0; font-size: 14px; color: ${COLORS.slate700};">${nombre}</li>`)
                .join('')
            return `
                <div style="margin-bottom: 12px;">
                    <h4 style="color: ${COLORS.warningDark}; margin: 0 0 6px 0; font-size: 14px;">&#128194; ${categoriaNombre}</h4>
                    <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">${archivosLista}</ul>
                </div>
            `
        })
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
                    Le informamos que durante la radicacion del siguiente caso, <strong>${totalFallidos} archivo(s)</strong> no pudieron ser subidos al sistema debido a problemas de conexion.
                </p>

                <!-- Radicado -->
                <div style="background-color: ${COLORS.warningLight}; border: 2px solid ${COLORS.warning}; padding: 16px; text-align: center; margin: 20px 0; border-radius: 8px;">
                    <h2 style="color: ${COLORS.warningDark}; margin: 0; font-size: 24px;">${radicado}</h2>
                    <p style="color: ${COLORS.slate600}; margin: 5px 0 0 0; font-size: 13px;">Numero de Radicado</p>
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

                <!-- Archivos Fallidos -->
                <h3 style="color: ${COLORS.error}; border-bottom: 2px solid ${COLORS.errorLight}; padding-bottom: 8px; margin-top: 24px;">
                    &#128196; Archivos que no se pudieron subir
                </h3>
                ${fallidosHtml}

                <!-- Accion Requerida -->
                <div style="background-color: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                    <strong style="color: ${COLORS.warningDark};">&#9889; Accion Requerida:</strong>
                    <p style="margin: 10px 0 0 0; font-size: 14px; line-height: 1.6; color: ${COLORS.slate700};">
                        Por favor, ingrese al <strong>Portal de Colaboradores</strong>, busque el radicado <strong>${radicado}</strong>
                        y vuelva a subir los archivos indicados. Le recomendamos verificar su conexion a internet antes de intentar nuevamente.
                    </p>
                </div>

                <!-- Tips -->
                <div style="background-color: ${COLORS.infoLight}; border-left: 4px solid ${COLORS.info}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <strong style="color: ${COLORS.primary};">&#128161; Recomendaciones:</strong>
                    <ul style="margin: 10px 0 0 0; padding-left: 18px; font-size: 13px; line-height: 1.8; color: ${COLORS.slate700};">
                        <li>Verifique que su conexion a internet sea estable</li>
                        <li>Si el problema persiste, intente con una red diferente (ej: datos moviles)</li>
                        <li>Los archivos que se subieron exitosamente ya quedaron guardados</li>
                    </ul>
                </div>

                <p style="margin: 20px 0 0 0; font-size: 13px; color: ${COLORS.textSecondary};">
                    Fecha del intento: ${datos.timestamp}
                </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
                <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                    Este es un mensaje automatico generado por el<br />
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
            JSON.stringify({ success: false, error: 'Metodo no permitido' }),
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
            subject = `Confirmacion de Radicacion - ${body.radicado} - ${buildPacienteSuffix(datos)}`
            htmlBody = generarTemplateConfirmacion(body.radicado, datos)
        } else if (body.type === 'rechazo') {
            const datos = body.datos as DatosRechazo
            subject = `Rechazo de Radicado - ${body.radicado} - ${buildPacienteSuffix(datos)}`
            htmlBody = generarTemplateRechazo(body.radicado, datos)
        } else if (body.type === 'devolucion') {
            const datos = body.datos as DatosDevolucion
            subject = `Devolucion de Caso - ${body.radicado} - ${buildPacienteSuffix(datos)}`
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
                JSON.stringify({ success: false, error: 'Tipo de correo no valido' }),
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
