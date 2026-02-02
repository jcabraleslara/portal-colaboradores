/**
 * Supabase Edge Function: Envio de Correos (Radicacion, Rechazo, Devolucion, etc.)
 * Portal de Colaboradores - Gestar Salud IPS
 *
 * POST /functions/v1/send-email
 */

import { corsHeaders } from '../_shared/cors.ts'
import { sendGmailEmail, type EmailAttachment, type InlineImage } from '../_shared/gmail-utils.ts'

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
    radicado: string
    fechaGestion: string
}

interface DatosDevolucionRecobro {
    pacienteNombre: string
    pacienteIdentificacion: string
    cupsData: { cups: string; descripcion: string; cantidad: number; es_principal: boolean }[]
    respuestaAuditor: string
    fechaDevolucion: string
}

interface DatosAprobacionRecobro {
    pacienteNombre: string
    pacienteIdentificacion: string
    cupsData: { cups: string; descripcion: string; cantidad: number; es_principal: boolean }[]
    pdfUrl?: string
    fechaAprobacion: string
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
    type: 'radicacion' | 'rechazo' | 'devolucion' | 'no_contactable' | 'devolucion_recobro' | 'aprobacion_recobro' | 'enrutado'
    destinatario: string | string[]  // Soporta mÃºltiples destinatarios
    cc?: string | string[]           // Copias opcionales
    radicado: string
    datos: DatosRadicacionExitosa | DatosRechazo | DatosDevolucion | DatosNoContactable | DatosDevolucionRecobro | DatosAprobacionRecobro | DatosEnrutado
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
                .map((url, idx) => `<li><a href="${url}" target="_blank">Archivo ${idx + 1}</a></li>`)
                .join('')
            return `
                <h4 style="color: #059669; margin-top: 15px; margin-bottom: 5px;">${grupo.categoria}</h4>
                <ul style="margin: 0; padding-left: 20px;">${listaArchivos}</ul>
            `
        })
        .join('')

    const oneDriveSection = datos.onedriveFolderUrl
        ? `<div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0;">
            <strong>ðŸ“ Carpeta OneDrive:</strong>
            <a href="${datos.onedriveFolderUrl}" target="_blank" style="color: #0284c7; text-decoration: none;">
                Acceder a carpeta en OneDrive
            </a>
        </div>`
        : ''

    return `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">✅ Radicacion Exitosa</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Cordial saludo,</p>
                <p>Le confirmamos que su radicacion ha sido creada exitosamente con el siguiente numero:</p>
                <div style="background-color: #d1fae5; border: 2px solid #059669; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                    <h2 style="color: #059669; margin: 0; font-size: 28px;">${radicado}</h2>
                    <p style="color: #047857; margin: 5px 0 0 0; font-size: 14px;">Numero de Radicado</p>
                </div>
                <h3 style="color: #059669; border-bottom: 2px solid #d1fae5; padding-bottom: 8px;">📋 Informacion del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                    <li><strong>Identificacion:</strong> ${datos.pacienteIdentificacion}</li>
                </ul>
                <h3 style="color: #059669; border-bottom: 2px solid #d1fae5; padding-bottom: 8px;">🏥 Informacion del Servicio</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>EPS:</strong> ${datos.eps}</li>
                    <li><strong>Regimen:</strong> ${datos.regimen}</li>
                    <li><strong>Servicio Prestado:</strong> ${datos.servicioPrestado}</li>
                    <li><strong>Fecha de Atencion:</strong> ${formatDate(datos.fechaAtencion)}</li>
                </ul>
                <h3 style="color: #059669; border-bottom: 2px solid #d1fae5; padding-bottom: 8px;">📎 Archivos Adjuntos</h3>
                ${archivosHtml}
                ${oneDriveSection}
                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                    <strong>⏳ Proximos Pasos:</strong>
                    <p style="margin: 10px 0 0 0;">Su radicacion sera revisada por el area de facturacion. Recibira una notificacion cuando cambie el estado de su radicado.</p>
                </div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
                    Este es un mensaje automatico generado por el Portal de Colaboradores de Gestar Salud IPS.<br />No responda a este correo.
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
                .map((url, idx) => `<li><a href="${url}" target="_blank">Archivo ${idx + 1}</a></li>`)
                .join('')
            return `
                <h4 style="color: #dc2626; margin-top: 15px; margin-bottom: 5px;">${grupo.categoria}</h4>
                <ul style="margin: 0; padding-left: 20px;">${listaArchivos}</ul>
            `
        })
        .join('')

    return `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">âš ï¸ Radicado Rechazado</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Cordial saludo,</p>
                <p>Le informamos que su radicado <strong>${radicado}</strong> ha sido rechazado por el area de facturacion.</p>
                <div style="background-color: #fef2f2; border: 3px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: #dc2626; margin-top: 0; margin-bottom: 10px;">💬 Observaciones de Facturacion</h3>
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #7f1d1d;">${datos.observacionesFacturacion}</p>
                </div>
                <h3 style="color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">📋 Informacion del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Tipo de Identificacion:</strong> ${datos.pacienteTipoId}</li>
                    <li><strong>Identificacion:</strong> ${datos.pacienteIdentificacion}</li>
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                </ul>
                <h3 style="color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">🏥 Informacion del Servicio</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>EPS:</strong> ${datos.eps}</li>
                    <li><strong>Regimen:</strong> ${datos.regimen}</li>
                    <li><strong>Servicio Prestado:</strong> ${datos.servicioPrestado}</li>
                    <li><strong>Fecha de Atencion:</strong> ${formatDate(datos.fechaAtencion)}</li>
                </ul>
                <h3 style="color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">📅 Fechas</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Fecha de Radicacion:</strong> ${formatDateTime(datos.fechaRadicacion)}</li>
                    <li><strong>Fecha de Rechazo:</strong> ${formatDateTime(new Date().toISOString())}</li>
                </ul>
                <h3 style="color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">📎 Archivos Radicados</h3>
                ${archivosHtml}
                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                    <strong>🔄 Proximos Pasos:</strong>
                    <p style="margin: 10px 0 0 0;">Por favor, subsane las observaciones mencionadas y radique nuevamente los soportes corregidos a traves del Portal de Colaboradores.</p>
                </div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
                    Este es un mensaje automatico generado por el Portal de Colaboradores de Gestar Salud IPS.<br />No responda a este correo.
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
                .map((url, idx) => `<li><a href="${url}" target="_blank">Archivo ${idx + 1}</a></li>`)
                .join('')
            return `
                <h4 style="color: #ea580c; margin-top: 15px; margin-bottom: 5px;">${grupo.categoria}</h4>
                <ul style="margin: 0; padding-left: 20px;">${listaArchivos}</ul>
            `
        })
        .join('')

    return `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #ea580c; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">âš ï¸ Radicado Devuelto</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Cordial saludo,</p>
                <p>Le informamos que su radicado <strong>${radicado}</strong> ha sido devuelto por el area de Gestion Back.</p>
                <div style="background-color: #fff7ed; border: 3px solid #ea580c; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: #ea580c; margin-top: 0; margin-bottom: 10px;">💬 Observaciones de Devolucion</h3>
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #7c2d12;">${datos.observacionesDevolucion}</p>
                </div>
                <h3 style="color: #ea580c; border-bottom: 2px solid #fdba74; padding-bottom: 8px;">📋 Informacion del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Tipo de Identificacion:</strong> ${datos.pacienteTipoId}</li>
                    <li><strong>Identificacion:</strong> ${datos.pacienteIdentificacion}</li>
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                </ul>
                <h3 style="color: #ea580c; border-bottom: 2px solid #fdba74; padding-bottom: 8px;">🏥 Informacion del Servicio</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>EPS:</strong> ${datos.eps}</li>
                    <li><strong>Regimen:</strong> ${datos.regimen}</li>
                    <li><strong>Servicio Prestado:</strong> ${datos.servicioPrestado}</li>
                    <li><strong>Fecha de Atencion:</strong> ${formatDate(datos.fechaAtencion)}</li>
                    ${datos.tipoSolicitud ? `<li><strong>Tipo Solicitud:</strong> ${datos.tipoSolicitud}</li>` : ''}
                </ul>
                <h3 style="color: #ea580c; border-bottom: 2px solid #fdba74; padding-bottom: 8px;">📅 Fechas</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Fecha de Radicacion:</strong> ${formatDateTime(datos.fechaRadicacion)}</li>
                    <li><strong>Fecha de Devolucion:</strong> ${formatDateTime(new Date().toISOString())}</li>
                </ul>
                <h3 style="color: #ea580c; border-bottom: 2px solid #fdba74; padding-bottom: 8px;">📎 Archivos Radicados</h3>
                ${archivosHtml}
                <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 15px; margin: 20px 0;">
                    <strong>🔄 Proximos Pasos:</strong>
                    <p style="margin: 10px 0 0 0;">Por favor, subsane las observaciones mencionadas y gestione nuevamente el caso o contacte al area correspondiente.</p>
                </div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
                    Este es un mensaje automatico generado por el Portal de Colaboradores de Gestar Salud IPS.<br />No responda a este correo.
                </p>
            </div>
        </div>
    `
}

function generarTemplateNoContactable(radicado: string, datos: DatosNoContactable): string {
    return `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #4b5563; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">📵 Paciente No Contactable</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Cordial saludo,</p>
                <p>Le informamos que en la gestion del radicado <strong>${radicado}</strong>, hemos intentado contactar al paciente sin exito.</p>
                <div style="background-color: #f3f4f6; border: 3px solid #4b5563; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: #374151; margin-top: 0; margin-bottom: 10px;">📍 Informacion del Intento</h3>
                    <ul style="line-height: 1.8; color: #374151;">
                        <li><strong>Paciente:</strong> ${datos.pacienteNombre}</li>
                        <li><strong>Identificacion:</strong> ${datos.pacienteIdentificacion}</li>
                        <li><strong>Fecha de Gestion:</strong> ${datos.fechaGestion}</li>
                    </ul>
                </div>
                <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 15px; margin: 20px 0;">
                    <strong>🔄 Accion Requerida:</strong>
                    <p style="margin: 10px 0 0 0;">Le sugerimos <strong>validar los datos de contacto del paciente</strong> (telefonos, direccion) y realizar un nuevo radicado con la informacion actualizada para poder gestionar su solicitud.</p>
                </div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
                    Este es un mensaje automatico generado por el Portal de Colaboradores de Gestar Salud IPS.<br />No responda a este correo.
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
                    ${cups.es_principal ? 'â­ ' : ''}<code style="background-color: #e0f2fe; padding: 2px 6px; border-radius: 4px; color: #0369a1;">${cups.cups}</code>
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${cups.descripcion}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${cups.cantidad}</td>
            </tr>
        `)
        .join('')

    return `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">🔄 Recobro Devuelto</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Cordial saludo,</p>
                <p>Le informamos que su solicitud de recobro <strong>${consecutivo}</strong> ha sido devuelta por el area de Auditoria.</p>
                <div style="background-color: #fef2f2; border: 3px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: #dc2626; margin-top: 0; margin-bottom: 10px;">ðŸ“ Motivo de Devolucion</h3>
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #7f1d1d;">${datos.respuestaAuditor}</p>
                </div>
                <h3 style="color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">ðŸ“‹ Informacion del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                    <li><strong>Identificacion:</strong> ${datos.pacienteIdentificacion}</li>
                </ul>
                <h3 style="color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">ðŸ¥ Procedimientos Solicitados</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                    <thead>
                        <tr style="background-color: #fef2f2;">
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #fecaca;">Codigo</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #fecaca;">Descripcion</th>
                            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #fecaca;">Cant.</th>
                        </tr>
                    </thead>
                    <tbody>${cupsHtml}</tbody>
                </table>
                <p style="font-size: 12px; color: #6b7280;">â­ = Procedimiento principal</p>
                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                    <strong>ðŸ”„ Proximos Pasos:</strong>
                    <p style="margin: 10px 0 0 0;">Por favor, revise las observaciones indicadas y realice los ajustes necesarios. Puede radicar nuevamente la solicitud de recobro con la informacion corregida.</p>
                </div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
                    Este es un mensaje automatico generado por el Portal de Colaboradores de Gestar Salud IPS.<br />No responda a este correo.
                </p>
            </div>
        </div>
    `
}

function generarTemplateAprobacionRecobro(consecutivo: string, datos: DatosAprobacionRecobro): string {
    const cupsHtml = datos.cupsData
        .map(cups => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                    ${cups.es_principal ? 'â­ ' : ''}<code style="background-color: #d1fae5; padding: 2px 6px; border-radius: 4px; color: #047857;">${cups.cups}</code>
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${cups.descripcion}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${cups.cantidad}</td>
            </tr>
        `)
        .join('')

    const pdfSection = datos.pdfUrl
        ? `<div style="background-color: #d1fae5; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
            <strong>ðŸ“„ Carta de Autorizacion:</strong>
            <a href="${datos.pdfUrl}" target="_blank" style="color: #047857; text-decoration: none; margin-left: 10px;">
                Descargar PDF de Aprobacion
            </a>
        </div>`
        : ''

    return `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">✅ Recobro Aprobado</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Cordial saludo,</p>
                <p>Nos complace informarle que su solicitud de recobro <strong>${consecutivo}</strong> ha sido <strong style="color: #059669;">APROBADA</strong> por el area de Auditoria.</p>
                <div style="background-color: #d1fae5; border: 3px solid #059669; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
                    <h2 style="color: #059669; margin: 0; font-size: 28px;">✓ APROBADO</h2>
                    <p style="color: #047857; margin: 10px 0 0 0; font-size: 14px;">Consecutivo: <strong>${consecutivo}</strong></p>
                </div>
                <h3 style="color: #059669; border-bottom: 2px solid #d1fae5; padding-bottom: 8px;">📋 Informacion del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                    <li><strong>Identificacion:</strong> ${datos.pacienteIdentificacion}</li>
                </ul>
                <h3 style="color: #059669; border-bottom: 2px solid #d1fae5; padding-bottom: 8px;">🏥 Procedimientos Aprobados</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                    <thead>
                        <tr style="background-color: #d1fae5;">
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #10b981;">Codigo</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #10b981;">Descripcion</th>
                            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #10b981;">Cant.</th>
                        </tr>
                    </thead>
                    <tbody>${cupsHtml}</tbody>
                </table>
                <p style="font-size: 12px; color: #6b7280;">⭐ = Procedimiento principal</p>
                ${pdfSection}
                <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
                    <strong>📍 Informacion Importante:</strong>
                    <p style="margin: 10px 0 0 0;">La carta de autorizacion ha sido generada y almacenada. Puede descargarla desde el enlace anterior o acceder directamente desde el Portal de Colaboradores en la seccion de Gestion de Recobros.</p>
                </div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
                    Este es un mensaje automatico generado por el Portal de Colaboradores de Gestar Salud IPS.<br />No responda a este correo.
                </p>
            </div>
        </div>
    `
}

/**
 * Paleta de colores corporativos GESTAR SALUD IPS
 */
const GESTAR_COLORS = {
    primary: '#0095EB',      // Azul GESTAR
    primaryLight: '#E6F4FD', // Fondo claro
    primaryDark: '#0077BC',  // Hover/Ã©nfasis
    text: '#1E293B',         // Texto principal
    textSecondary: '#64748B', // Texto secundario
    success: '#85C54C',      // Verde Ã©xito
    warning: '#F59E0B',      // Amarillo advertencia
    background: '#F8FAFC',   // Fondo secundario
}

// Logo Gestar Salud en Base64 (PNG pequeño optimizado para email)
const GESTAR_LOGO_BASE64 = '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'

function generarTemplateEnrutado(radicado: string, datos: DatosEnrutado): string {
    const archivosHtml = datos.archivosUrls && datos.archivosUrls.length > 0
        ? `
            <h3 style="color: ${GESTAR_COLORS.primary}; border-bottom: 2px solid ${GESTAR_COLORS.primaryLight}; padding-bottom: 8px;">📎 Documentos Adjuntos</h3>
            <ul style="line-height: 1.8;">
                ${datos.archivosUrls.map((url, idx) => `
                    <li><a href="${url}" target="_blank" style="color: ${GESTAR_COLORS.primary}; text-decoration: none;">
                        📄 Documento ${idx + 1}
                    </a></li>
                `).join('')}
            </ul>
        `
        : ''

    return `
        <div style="font-family: 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: ${GESTAR_COLORS.text}; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header con Logo -->
            <div style="background-color: ${GESTAR_COLORS.primary}; background: linear-gradient(135deg, ${GESTAR_COLORS.primary} 0%, ${GESTAR_COLORS.primaryDark} 100%); padding: 24px 30px; text-align: center;">
                <img src="cid:logo-gestar" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 12px;" />
                <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">
                    Activacion de Ruta: ${datos.ruta}
                </h1>
            </div>

            <!-- Contenido Principal -->
            <div style="padding: 30px; background-color: ${GESTAR_COLORS.background};">
                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6;">Cordial saludo,</p>
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">
                    Se ha activado la <strong style="color: ${GESTAR_COLORS.primary};">Ruta ${datos.ruta}</strong> para el siguiente paciente. Por favor gestionar a la brevedad:
                </p>

                <!-- Card Paciente -->
                <div style="background-color: #ffffff; border: 1px solid #E2E8F0; border-left: 4px solid ${GESTAR_COLORS.primary}; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="vertical-align: top;">
                                <h2 style="color: ${GESTAR_COLORS.text}; margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">${datos.pacienteNombre}</h2>
                                <p style="color: ${GESTAR_COLORS.textSecondary}; margin: 0; font-size: 14px;">
                                    <strong>${datos.pacienteTipoId}:</strong> ${datos.pacienteIdentificacion}
                                </p>
                            </td>
                            <td style="text-align: right; vertical-align: top; width: 120px;">
                                <p style="color: ${GESTAR_COLORS.textSecondary}; margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Radicado</p>
                                <p style="color: ${GESTAR_COLORS.primary}; margin: 0; font-size: 16px; font-weight: 700; font-family: 'JetBrains Mono', monospace;">${radicado}</p>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Datos del Paciente -->
                <h3 style="color: ${GESTAR_COLORS.primary}; border-bottom: 2px solid ${GESTAR_COLORS.primaryLight}; padding-bottom: 8px; margin-top: 24px; font-size: 16px; font-weight: 600;">
                    📋 Datos del Paciente
                </h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
                    <tr>
                        <td style="padding: 10px 0; color: ${GESTAR_COLORS.textSecondary}; width: 140px; font-size: 14px; border-bottom: 1px solid #E2E8F0;">EPS:</td>
                        <td style="padding: 10px 0; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${datos.eps}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: ${GESTAR_COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0;">IPS Primaria:</td>
                        <td style="padding: 10px 0; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${datos.ipsPrimaria}</td>
                    </tr>
                    ${datos.telefono ? `
                    <tr>
                        <td style="padding: 10px 0; color: ${GESTAR_COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0;">Telefono:</td>
                        <td style="padding: 10px 0; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E2E8F0;">
                            <a href="tel:${datos.telefono}" style="color: ${GESTAR_COLORS.primary}; text-decoration: none;">${datos.telefono}</a>
                        </td>
                    </tr>
                    ` : ''}
                    ${datos.direccion ? `
                    <tr>
                        <td style="padding: 10px 0; color: ${GESTAR_COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0;">Direccion:</td>
                        <td style="padding: 10px 0; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${datos.direccion}</td>
                    </tr>
                    ` : ''}
                    ${datos.municipio ? `
                    <tr>
                        <td style="padding: 10px 0; color: ${GESTAR_COLORS.textSecondary}; font-size: 14px; border-bottom: 1px solid #E2E8F0;">Municipio:</td>
                        <td style="padding: 10px 0; font-size: 14px; border-bottom: 1px solid #E2E8F0;">${datos.municipio}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td style="padding: 10px 0; color: ${GESTAR_COLORS.textSecondary}; font-size: 14px;">Fecha Radicacion:</td>
                        <td style="padding: 10px 0; font-size: 14px;">${formatDateTime(datos.fechaRadicacion)}</td>
                    </tr>
                </table>

                ${datos.observaciones ? `
                <h3 style="color: ${GESTAR_COLORS.primary}; border-bottom: 2px solid ${GESTAR_COLORS.primaryLight}; padding-bottom: 8px; margin-top: 24px; font-size: 16px; font-weight: 600;">
                    ðŸ“ Observaciones
                </h3>
                <div style="background-color: #ffffff; padding: 16px; border-radius: 8px; border-left: 4px solid ${GESTAR_COLORS.success}; margin-top: 12px;">
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; font-size: 14px; color: ${GESTAR_COLORS.text};">${datos.observaciones}</p>
                </div>
                ` : ''}

                ${archivosHtml}

                <!-- Call to Action -->
                <div style="background-color: #FEF3C7; border-left: 4px solid ${GESTAR_COLORS.warning}; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                    <strong style="color: #92400E; font-size: 14px;">âš¡ Accion Requerida:</strong>
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
                    © ${new Date().getFullYear()} Gestar Salud de Colombia IPS S.A.S.
                </p>
            </div>
        </div>
    `
}

// ==========================================
// HANDLER PRINCIPAL
// ==========================================

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

        if (body.type === 'radicacion') {
            subject = `Confirmacion de Radicacion - ${body.radicado}`
            htmlBody = generarTemplateConfirmacion(body.radicado, body.datos as DatosRadicacionExitosa)
        } else if (body.type === 'rechazo') {
            subject = `Rechazo de Radicado - ${body.radicado}`
            htmlBody = generarTemplateRechazo(body.radicado, body.datos as DatosRechazo)
        } else if (body.type === 'devolucion') {
            subject = `Devolucion de Caso - ${body.radicado}`
            htmlBody = generarTemplateDevolucion(body.radicado, body.datos as DatosDevolucion)
        } else if (body.type === 'no_contactable') {
            subject = `Paciente No Contactable - Radicado ${body.radicado}`
            htmlBody = generarTemplateNoContactable(body.radicado, body.datos as DatosNoContactable)
        } else if (body.type === 'devolucion_recobro') {
            subject = `Recobro Devuelto - ${body.radicado}`
            htmlBody = generarTemplateDevolucionRecobro(body.radicado, body.datos as DatosDevolucionRecobro)
        } else if (body.type === 'aprobacion_recobro') {
            subject = `âœ… Recobro Aprobado - ${body.radicado}`
            htmlBody = generarTemplateAprobacionRecobro(body.radicado, body.datos as DatosAprobacionRecobro)
        } else if (body.type === 'enrutado') {
            const datosEnrutado = body.datos as DatosEnrutado
            // Asunto con datos del paciente: Ruta + TipoID + ID + Nombre
            subject = `Ruta ${datosEnrutado.ruta} - ${datosEnrutado.pacienteTipoId} ${datosEnrutado.pacienteIdentificacion} - ${datosEnrutado.pacienteNombre}`
            htmlBody = generarTemplateEnrutado(body.radicado, datosEnrutado)
        } else {
            return new Response(
                JSON.stringify({ success: false, error: 'Tipo de correo no valido' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Preparar imagenes inline si es necesario (ej: logo corporativo para enrutado)
        const inlineImages: InlineImage[] = []
        if (body.type === 'enrutado') {
            inlineImages.push({
                cid: 'logo-gestar',
                content: GESTAR_LOGO_BASE64,
                mimeType: 'image/png'
            })
        }

        // Usar nueva API con soporte para CC, adjuntos e imagenes inline si es necesario
        if (body.type === 'enrutado' || body.cc || body.adjuntos) {
            await sendGmailEmail({
                to: body.destinatario,
                cc: body.cc,
                subject,
                htmlBody,
                attachments: body.adjuntos,
                inlineImages: inlineImages.length > 0 ? inlineImages : undefined
            })
        } else {
            // Llamada legacy para compatibilidad
            await sendGmailEmail(body.destinatario as string, subject, htmlBody)
        }

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
