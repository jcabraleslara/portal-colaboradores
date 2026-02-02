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
    destinatario: string | string[]  // Soporta múltiples destinatarios
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
            <strong>📁 Carpeta OneDrive:</strong>
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
                <h1 style="margin: 0; font-size: 24px;">⚠️ Radicado Rechazado</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Cordial saludo,</p>
                <p>Le informamos que su radicado <strong>${radicado}</strong> ha sido rechazado por el area de facturacion.</p>
                <div style="background-color: #fef2f2; border: 3px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: #dc2626; margin-top: 0; margin-bottom: 10px;">📝 Observaciones de Facturacion</h3>
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
                <h1 style="margin: 0; font-size: 24px;">⚠️ Radicado Devuelto</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Cordial saludo,</p>
                <p>Le informamos que su radicado <strong>${radicado}</strong> ha sido devuelto por el area de Gestion Back.</p>
                <div style="background-color: #fff7ed; border: 3px solid #ea580c; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: #ea580c; margin-top: 0; margin-bottom: 10px;">📝 Observaciones de Devolucion</h3>
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
                <h1 style="margin: 0; font-size: 24px;">📴 Paciente No Contactable</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Cordial saludo,</p>
                <p>Le informamos que en la gestion del radicado <strong>${radicado}</strong>, hemos intentado contactar al paciente sin exito.</p>
                <div style="background-color: #f3f4f6; border: 3px solid #4b5563; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="color: #374151; margin-top: 0; margin-bottom: 10px;">📌 Informacion del Intento</h3>
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
                    ${cups.es_principal ? '⭐ ' : ''}<code style="background-color: #e0f2fe; padding: 2px 6px; border-radius: 4px; color: #0369a1;">${cups.cups}</code>
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
                    <h3 style="color: #dc2626; margin-top: 0; margin-bottom: 10px;">📝 Motivo de Devolucion</h3>
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #7f1d1d;">${datos.respuestaAuditor}</p>
                </div>
                <h3 style="color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">📋 Informacion del Paciente</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Nombre:</strong> ${datos.pacienteNombre}</li>
                    <li><strong>Identificacion:</strong> ${datos.pacienteIdentificacion}</li>
                </ul>
                <h3 style="color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">🏥 Procedimientos Solicitados</h3>
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
                <p style="font-size: 12px; color: #6b7280;">⭐ = Procedimiento principal</p>
                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                    <strong>🔄 Proximos Pasos:</strong>
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
                    ${cups.es_principal ? '⭐ ' : ''}<code style="background-color: #d1fae5; padding: 2px 6px; border-radius: 4px; color: #047857;">${cups.cups}</code>
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${cups.descripcion}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${cups.cantidad}</td>
            </tr>
        `)
        .join('')

    const pdfSection = datos.pdfUrl
        ? `<div style="background-color: #d1fae5; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
            <strong>📄 Carta de Autorizacion:</strong>
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
                    <strong>📌 Informacion Importante:</strong>
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
    primaryDark: '#0077BC',  // Hover/énfasis
    text: '#1E293B',         // Texto principal
    textSecondary: '#64748B', // Texto secundario
    success: '#85C54C',      // Verde éxito
    warning: '#F59E0B',      // Amarillo advertencia
    background: '#F8FAFC',   // Fondo secundario
}

// Logo Gestar Salud en Base64 (PNG pequeño optimizado para email)
const GESTAR_LOGO_URL = 'https://portal-colaboradores.vercel.app/logo_gestar.png'

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
            <div style="background: linear-gradient(135deg, ${GESTAR_COLORS.primary} 0%, ${GESTAR_COLORS.primaryDark} 100%); padding: 24px 30px; text-align: center;">
                <img src="${GESTAR_LOGO_URL}" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 12px;" />
                <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: white; letter-spacing: -0.5px;">
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
                    📝 Observaciones
                </h3>
                <div style="background-color: #ffffff; padding: 16px; border-radius: 8px; border-left: 4px solid ${GESTAR_COLORS.success}; margin-top: 12px;">
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; font-size: 14px; color: ${GESTAR_COLORS.text};">${datos.observaciones}</p>
                </div>
                ` : ''}

                ${archivosHtml}

                <!-- Call to Action -->
                <div style="background-color: #FEF3C7; border-left: 4px solid ${GESTAR_COLORS.warning}; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                    <strong style="color: #92400E; font-size: 14px;">⚡ Accion Requerida:</strong>
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
            subject = `✅ Recobro Aprobado - ${body.radicado}`
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

        // Usar nueva API con soporte para CC y adjuntos si es necesario
        if (body.type === 'enrutado' || body.cc || body.adjuntos) {
            await sendGmailEmail({
                to: body.destinatario,
                cc: body.cc,
                subject,
                htmlBody,
                attachments: body.adjuntos
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
