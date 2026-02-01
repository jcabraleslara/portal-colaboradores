/**
 * Supabase Edge Function: Envio de Correos (Radicacion, Rechazo, Devolucion, etc.)
 * Portal de Colaboradores - Gestar Salud IPS
 *
 * POST /functions/v1/send-email
 */

import { corsHeaders } from '../_shared/cors.ts'
import { sendGmailEmail } from '../_shared/gmail-utils.ts'

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

interface RequestBody {
    type: 'radicacion' | 'rechazo' | 'devolucion' | 'no_contactable' | 'devolucion_recobro' | 'aprobacion_recobro'
    destinatario: string
    radicado: string
    datos: DatosRadicacionExitosa | DatosRechazo | DatosDevolucion | DatosNoContactable | DatosDevolucionRecobro | DatosAprobacionRecobro
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

        if (!body.type || !body.destinatario || !body.radicado || !body.datos) {
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
        } else {
            return new Response(
                JSON.stringify({ success: false, error: 'Tipo de correo no valido' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        await sendGmailEmail(body.destinatario, subject, htmlBody)

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
