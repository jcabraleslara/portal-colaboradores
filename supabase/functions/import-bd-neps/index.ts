/**
 * Supabase Edge Function: Importacion BD NEPS desde correo electronico
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * POST /functions/v1/import-bd-neps
 *
 * Descarga automaticamente archivos ZIP con CSVs de la carpeta "BD"
 * del correo de coordinacionmedica@gestarsaludips.com (Microsoft 365),
 * los parsea, transforma y carga en la tabla `bd` via RPC `upsert_bd_batch`.
 *
 * Respuesta: streaming NDJSON con progreso en tiempo real.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import JSZip from 'npm:jszip@3.10.1'
import { corsHeaders } from '../_shared/cors.ts'
import { notifyAuthenticationError, notifyServiceUnavailable, notifyCriticalError } from '../_shared/critical-error-utils.ts'
import { sendGmailEmail } from '../_shared/gmail-utils.ts'
import { COLORS, EMAIL_FONTS, GESTAR_LOGO_BASE64, generarHeaderEmail, generarFooterEmail } from '../_shared/email-templates.ts'

// --- Tipos ---

interface GraphTokenResponse {
    access_token: string
    expires_in: number
    token_type: string
}

interface MailFolder {
    id: string
    displayName: string
}

interface MailMessage {
    id: string
    subject: string
    hasAttachments: boolean
    receivedDateTime: string
}

interface TipoIdRow {
    afi_tid_codigo: string
    tipo_id: string
}

interface DivipolaRow {
    cod_municipio: string
    nombre_departamento: string
    nombre_municipio: string
}

interface BdRecord {
    tipo_id: string
    id: string
    apellido1: string
    apellido2: string
    nombres: string
    sexo: string
    direccion: string
    telefono: string
    fecha_nacimiento: string
    estado: string
    municipio: string
    observaciones: string
    ips_primaria: string
    tipo_cotizante: string
    departamento: string
    rango: string
    email: string
    regimen: string
    eps: string
}

// --- Constantes ---

const FEATURE_NAME = 'Importacion BD NEPS'
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const EMAIL_USER = 'coordinacionmedica@gestarsaludips.com'
const BATCH_SIZE = 5000

// --- Helpers Graph API ---

async function getGraphAccessToken(): Promise<string> {
    const clientId = Deno.env.get('AZURE_CLIENT_ID') ?? ''
    const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET') ?? ''
    const tenantId = Deno.env.get('AZURE_TENANT_ID') ?? ''

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

    const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
    })

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    })

    if (!response.ok) {
        const errorText = await response.text()
        if ([400, 401, 403].includes(response.status)) {
            await notifyAuthenticationError('Azure AD (Microsoft Graph)', FEATURE_NAME, response.status)
        }
        throw new Error(`Error obteniendo token Graph: ${response.status} - ${errorText}`)
    }

    const data: GraphTokenResponse = await response.json()
    return data.access_token
}

async function findMailFolder(token: string, folderName: string): Promise<string> {
    const url = `${GRAPH_BASE}/users/${EMAIL_USER}/mailFolders?$filter=displayName eq '${folderName}'&$top=5`
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
        if (res.status >= 500) await notifyServiceUnavailable('Microsoft Graph API', FEATURE_NAME, res.status)
        throw new Error(`Error buscando carpeta de correo '${folderName}': ${res.status}`)
    }

    const data = await res.json()
    const folders: MailFolder[] = data.value || []
    if (folders.length === 0) {
        throw new Error(`No se encontro la carpeta de correo '${folderName}'. Verifica que exista en ${EMAIL_USER}.`)
    }
    return folders[0].id
}

async function listAllMessages(token: string, folderId: string): Promise<MailMessage[]> {
    const allMessages: MailMessage[] = []
    let url: string | null = `${GRAPH_BASE}/users/${EMAIL_USER}/mailFolders/${folderId}/messages?$select=id,subject,hasAttachments,receivedDateTime&$orderby=receivedDateTime desc&$top=50`

    while (url) {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) {
            if (res.status >= 500) await notifyServiceUnavailable('Microsoft Graph API', FEATURE_NAME, res.status)
            throw new Error(`Error listando correos: ${res.status}`)
        }

        const data = await res.json()
        const messages: MailMessage[] = data.value || []
        allMessages.push(...messages)

        url = data['@odata.nextLink'] || null
    }

    return allMessages
}

/**
 * Separa correos en lote mas reciente (mismo dia) vs correos viejos.
 * Los correos llegan diariamente entre 6-8AM (~22 por dia).
 */
function separarLoteMasReciente(messages: MailMessage[]): {
    loteReciente: MailMessage[]
    correosViejos: MailMessage[]
} {
    if (messages.length === 0) return { loteReciente: [], correosViejos: [] }

    // Ya vienen ordenados por receivedDateTime desc
    const fechaMasReciente = messages[0].receivedDateTime.substring(0, 10) // YYYY-MM-DD

    const loteReciente: MailMessage[] = []
    const correosViejos: MailMessage[] = []

    for (const msg of messages) {
        const fechaMsg = msg.receivedDateTime.substring(0, 10)
        if (fechaMsg === fechaMasReciente) {
            loteReciente.push(msg)
        } else {
            correosViejos.push(msg)
        }
    }

    return { loteReciente, correosViejos }
}

interface AttachmentMeta {
    id: string
    name: string
    size: number
}

/**
 * Listar metadatos de adjuntos (sin contentBytes para evitar error 400 en archivos grandes)
 */
async function listAttachmentsMeta(token: string, messageId: string): Promise<AttachmentMeta[]> {
    const url = `${GRAPH_BASE}/users/${EMAIL_USER}/messages/${messageId}/attachments?$select=id,name,size`
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
        console.error(`Error listando adjuntos del mensaje ${messageId}: ${res.status}`)
        return []
    }

    const data = await res.json()
    return (data.value || []) as AttachmentMeta[]
}

/**
 * Descargar contenido binario de un adjunto via endpoint /$value
 */
async function downloadAttachmentContent(token: string, messageId: string, attachmentId: string): Promise<Uint8Array> {
    const url = `${GRAPH_BASE}/users/${EMAIL_USER}/messages/${messageId}/attachments/${attachmentId}/$value`
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
        throw new Error(`Error descargando adjunto ${attachmentId}: ${res.status}`)
    }

    const buffer = await res.arrayBuffer()
    return new Uint8Array(buffer)
}

async function deleteMessage(token: string, messageId: string): Promise<void> {
    const url = `${GRAPH_BASE}/users/${EMAIL_USER}/messages/${messageId}`
    const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok && res.status !== 204) {
        console.error(`Error eliminando mensaje ${messageId}: ${res.status}`)
    }
}

// --- Helpers de datos ---

function limpiarCampo(valor: string | undefined): string {
    if (!valor) return ''
    return valor.trim().replace(/^["',]+|["',]+$/g, '')
}

function convertirFecha(fechaStr: string): string {
    // Formatos: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
    const clean = fechaStr.trim()
    if (!clean) return ''

    // DD/MM/YYYY o DD-MM-YYYY
    const match = clean.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)
    if (match) {
        const [, dia, mes, anio] = match
        return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
    }

    // Ya esta en formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        return clean
    }

    return ''
}

function resolverRegimen(pafCodigo: string): string {
    const code = pafCodigo.trim().toUpperCase()
    if (['A', 'B', 'C'].includes(code)) return 'CONTRIBUTIVO'
    if (['1', '2'].includes(code)) return 'SUBSIDIADO'
    return ''
}

function resolverDivipola(
    depCode: string,
    munCode: string,
    divipolaMap: Map<string, { nombre_municipio: string; nombre_departamento: string }>,
    depMap: Map<string, string>
): { municipio: string; departamento: string } {
    const dep = depCode.trim()
    const mun = munCode.trim()

    // Intentar codigo completo: dep (2 digitos) + mun (3 digitos)
    const fullCode = dep.padStart(2, '0') + mun.padStart(3, '0')
    const divipola = divipolaMap.get(fullCode)
    if (divipola) {
        return { municipio: divipola.nombre_municipio, departamento: divipola.nombre_departamento }
    }

    // Si munCode ya tiene 4-5 digitos (codigo completo), intentar directo
    if (mun.length >= 4) {
        const padded = mun.padStart(5, '0')
        const divipola2 = divipolaMap.get(padded)
        if (divipola2) {
            return { municipio: divipola2.nombre_municipio, departamento: divipola2.nombre_departamento }
        }
    }

    // Fallback: solo departamento
    return {
        municipio: mun || '',
        departamento: depMap.get(dep.padStart(2, '0')) || dep,
    }
}

function decodificarTexto(bytes: Uint8Array): string {
    // Intentar UTF-8 primero
    try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        // Verificar BOM UTF-8
        return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
    } catch {
        // Fallback a Latin-1
    }

    try {
        return new TextDecoder('iso-8859-1').decode(bytes)
    } catch {
        // Ultimo recurso
        return new TextDecoder('windows-1252').decode(bytes)
    }
}

// --- Notificacion por correo ---

interface NotificacionData {
    fechaLote: string
    totalExitosos: number
    totalErrores: number
    totalInsertados: number
    totalActualizados: number
    totalComplementados: number
    huerfanosMarcados: number
    duplicados: number
    totalLineas: number
    lineasDescartadas: number
    registrosUnicos: number
    duracion: string
    zips: number
    csvs: number
    correosEliminados: number
    infoReport: string
}

/**
 * Envía correo de notificación con estadísticas de la importación,
 * estado general de la BD, gráfica histórica y log adjunto.
 */
async function enviarCorreoNotificacion(
    supabase: ReturnType<typeof createClient>,
    data: NotificacionData
): Promise<void> {
    const hasErrors = data.totalErrores > 0
    const statusColor = hasErrors ? COLORS.error : COLORS.success
    const statusText = hasErrors ? 'CON ERRORES' : 'EXITOSA'
    const statusIcon = hasErrors ? '&#9888;&#65039;' : '&#9989;'

    // Consultar estadisticas generales de la tabla bd por fuente
    const fuenteConteo: Record<string, number> = {}
    let totalBd = 0
    const fuentesDB = ['BD_ST_CERETE', 'BD_NEPS', 'BD_ST_PGP', 'BD_SIGIRES_NEPS', 'PORTAL_COLABORADORES']
    for (const fuente of fuentesDB) {
        const { count } = await supabase.from('bd').select('*', { count: 'exact', head: true }).eq('fuente', fuente)
        if (count !== null) {
            fuenteConteo[fuente] = count
            totalBd += count
        }
    }

    // Consultar historial de importaciones (ultimos 15 dias)
    const { data: historial } = await supabase
        .from('import_history')
        .select('tipo_fuente, fecha_importacion, exitosos, fallidos')
        .gte('fecha_importacion', new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString())
        .order('fecha_importacion', { ascending: true })

    // Preparar datos para grafica: agrupar por fecha y fuente (ultimo resultado por dia)
    const porDiaFuente = new Map<string, Map<string, number>>()
    if (historial) {
        for (const h of historial) {
            const fecha = h.fecha_importacion.substring(0, 10)
            const fuente = h.tipo_fuente || 'legacy'
            if (!porDiaFuente.has(fecha)) porDiaFuente.set(fecha, new Map())
            porDiaFuente.get(fecha)!.set(fuente, h.exitosos || 0)
        }
    }

    // Construir config de QuickChart (bar chart agrupado por fuente)
    const labels = Array.from(porDiaFuente.keys()).slice(-10)
    const fuentesHistorial = ['bd_neps', 'bd-sigires-neps', 'bd-salud-total', 'bd-sigires-st']
    const fuenteColores: Record<string, string> = {
        'bd_neps': COLORS.primary,
        'bd-sigires-neps': COLORS.success,
        'bd-salud-total': COLORS.accent,
        'bd-sigires-st': COLORS.warning,
    }
    const fuenteLabels: Record<string, string> = {
        'bd_neps': 'BD NEPS',
        'bd-sigires-neps': 'SIGIRES NEPS',
        'bd-salud-total': 'Salud Total',
        'bd-sigires-st': 'SIGIRES ST',
    }

    const datasets = fuentesHistorial.map(f => ({
        label: fuenteLabels[f] || f,
        backgroundColor: fuenteColores[f] || '#94A3B8',
        data: labels.map(l => porDiaFuente.get(l)?.get(f) || 0),
    }))

    const chartConfig = {
        type: 'bar',
        data: { labels: labels.map(l => l.substring(5)), datasets },
        options: {
            plugins: {
                title: { display: true, text: 'Registros importados por fuente (ultimos dias)', font: { size: 14 } },
                legend: { position: 'bottom' },
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: (v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v } },
            },
        },
    }

    // Generar URL de QuickChart
    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=600&h=300&bkg=white`

    // Descargar imagen del chart para embeber inline
    let chartBase64 = ''
    try {
        const chartResp = await fetch(chartUrl)
        if (chartResp.ok) {
            const chartBytes = new Uint8Array(await chartResp.arrayBuffer())
            chartBase64 = btoa(String.fromCharCode(...chartBytes))
        }
    } catch {
        // Si falla, el correo se envia sin grafica
    }

    // Tabla de fuentes BD
    const fuenteOrden = ['BD_ST_CERETE', 'BD_NEPS', 'BD_ST_PGP', 'BD_SIGIRES_NEPS', 'PORTAL_COLABORADORES']
    const fuenteFilas = fuenteOrden
        .filter(f => fuenteConteo[f])
        .map(f => `
            <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid ${COLORS.slate200}; font-size: 13px; color: ${COLORS.text};">${f}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid ${COLORS.slate200}; font-size: 13px; color: ${COLORS.text}; text-align: right; font-weight: 600;">${(fuenteConteo[f] || 0).toLocaleString()}</td>
            </tr>
        `).join('')

    const fechaHoy = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

    // HTML del correo
    const htmlBody = `
    <div style="font-family: ${EMAIL_FONTS.primary}; max-width: 650px; margin: 0 auto; background-color: ${COLORS.background}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        ${generarHeaderEmail(
            `${statusIcon} Importacion BD NEPS ${statusText}`,
            `Lote ${data.fechaLote} &#8226; ${fechaHoy}`,
            hasErrors ? COLORS.error : COLORS.primary,
            hasErrors ? COLORS.errorDark : COLORS.primaryDark
        )}

        <div style="padding: 25px 30px;">
            <!-- Resumen rapido -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
                <tr>
                    <td style="width: 25%; text-align: center; padding: 15px 8px; background: ${COLORS.successLight}; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: 700; color: ${COLORS.successDark};">${data.totalExitosos.toLocaleString()}</div>
                        <div style="font-size: 11px; color: ${COLORS.slate500}; text-transform: uppercase; letter-spacing: 0.5px;">Exitosos</div>
                    </td>
                    <td style="width: 4%;"></td>
                    <td style="width: 25%; text-align: center; padding: 15px 8px; background: ${data.totalErrores > 0 ? COLORS.errorLight : COLORS.slate100}; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: 700; color: ${data.totalErrores > 0 ? COLORS.error : COLORS.slate400};">${data.totalErrores.toLocaleString()}</div>
                        <div style="font-size: 11px; color: ${COLORS.slate500}; text-transform: uppercase; letter-spacing: 0.5px;">Errores</div>
                    </td>
                    <td style="width: 4%;"></td>
                    <td style="width: 21%; text-align: center; padding: 15px 8px; background: ${COLORS.infoLight}; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: 700; color: ${COLORS.primary};">${data.duplicados.toLocaleString()}</div>
                        <div style="font-size: 11px; color: ${COLORS.slate500}; text-transform: uppercase; letter-spacing: 0.5px;">Duplicados</div>
                    </td>
                    <td style="width: 4%;"></td>
                    <td style="width: 21%; text-align: center; padding: 15px 8px; background: ${COLORS.slate100}; border-radius: 8px;">
                        <div style="font-size: 18px; font-weight: 700; color: ${COLORS.slate700};">${data.duracion}</div>
                        <div style="font-size: 11px; color: ${COLORS.slate500}; text-transform: uppercase; letter-spacing: 0.5px;">Duracion</div>
                    </td>
                </tr>
            </table>

            <!-- Detalle de importacion -->
            <h3 style="font-size: 15px; color: ${COLORS.text}; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid ${COLORS.primary};">
                &#128203; Detalle de la importacion
            </h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px; font-size: 13px;">
                <tr><td style="padding: 6px 0; color: ${COLORS.slate600};">Correos procesados</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${COLORS.text};">${data.correosEliminados}</td></tr>
                <tr><td style="padding: 6px 0; color: ${COLORS.slate600};">Archivos ZIP</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${COLORS.text};">${data.zips}</td></tr>
                <tr><td style="padding: 6px 0; color: ${COLORS.slate600};">Archivos CSV</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${COLORS.text};">${data.csvs}</td></tr>
                <tr><td style="padding: 6px 0; color: ${COLORS.slate600};">Total lineas en CSVs</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${COLORS.text};">${data.totalLineas.toLocaleString()}</td></tr>
                <tr><td style="padding: 6px 0; color: ${COLORS.slate600};">Registros unicos</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${COLORS.text};">${data.registrosUnicos.toLocaleString()}</td></tr>
                <tr><td style="padding: 6px 0; color: ${COLORS.slate600};">Insertados nuevos</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${COLORS.successDark};">${data.totalInsertados.toLocaleString()}</td></tr>
                <tr><td style="padding: 6px 0; color: ${COLORS.slate600};">Actualizados</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${COLORS.primary};">${data.totalActualizados.toLocaleString()}</td></tr>
                <tr><td style="padding: 6px 0; color: ${COLORS.slate600};">Complementados (CERETE)</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${COLORS.primary};">${data.totalComplementados.toLocaleString()}</td></tr>
                <tr><td style="padding: 6px 0; color: ${COLORS.slate600};">Huerfanos marcados</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${COLORS.warning};">${data.huerfanosMarcados.toLocaleString()}</td></tr>
                <tr><td style="padding: 6px 0; color: ${COLORS.slate600};">Descartados</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${COLORS.slate400};">${data.lineasDescartadas.toLocaleString()}</td></tr>
            </table>

            <!-- Estado general BD -->
            <h3 style="font-size: 15px; color: ${COLORS.text}; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid ${COLORS.success};">
                &#128202; Estado general de la Base de Datos
            </h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                <thead>
                    <tr style="background: ${COLORS.slate100};">
                        <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: ${COLORS.slate600}; text-transform: uppercase; letter-spacing: 0.5px;">Fuente</th>
                        <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: ${COLORS.slate600}; text-transform: uppercase; letter-spacing: 0.5px;">Registros</th>
                    </tr>
                </thead>
                <tbody>
                    ${fuenteFilas}
                </tbody>
                <tfoot>
                    <tr style="background: ${COLORS.slate100};">
                        <td style="padding: 10px 12px; font-size: 13px; font-weight: 700; color: ${COLORS.text};">TOTAL</td>
                        <td style="padding: 10px 12px; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">${totalBd.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- Grafica historica -->
            ${chartBase64 ? `
            <h3 style="font-size: 15px; color: ${COLORS.text}; margin: 25px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid ${COLORS.warning};">
                &#128200; Comportamiento historico de fuentes
            </h3>
            <div style="text-align: center; margin: 15px 0;">
                <img src="cid:chart-historico" alt="Grafica historica" style="max-width: 100%; border-radius: 8px; border: 1px solid ${COLORS.slate200};" />
            </div>
            ` : ''}

            <!-- Nota sobre adjunto -->
            <div style="background: ${COLORS.infoLight}; border-left: 4px solid ${COLORS.primary}; padding: 12px 15px; border-radius: 0 8px 8px 0; margin: 20px 0 0 0;">
                <p style="margin: 0; font-size: 13px; color: ${COLORS.primaryDark};">
                    &#128206; Se adjunta el log detallado de la importacion en formato CSV.
                </p>
            </div>
        </div>

        ${generarFooterEmail(
            'Reporte automatico de sincronizacion BD NEPS generado por el',
            'Portal de Colaboradores de Gestar Salud IPS'
        )}
    </div>`

    // Preparar adjunto CSV
    const csvBase64 = btoa(unescape(encodeURIComponent(data.infoReport)))

    // Preparar imagenes inline
    const inlineImages = [
        { cid: 'logo-gestar', content: GESTAR_LOGO_BASE64, mimeType: 'image/png' },
    ]
    if (chartBase64) {
        inlineImages.push({ cid: 'chart-historico', content: chartBase64, mimeType: 'image/png' })
    }

    await sendGmailEmail({
        to: 'coordinacionmedica@gestarsaludips.com',
        subject: `[BD NEPS] Importacion ${statusText} - Lote ${data.fechaLote} (${data.totalExitosos.toLocaleString()} registros)`,
        htmlBody,
        attachments: [{
            filename: `log_importacion_bd_neps_${data.fechaLote}.csv`,
            content: csvBase64,
            mimeType: 'text/csv',
        }],
        inlineImages,
    })
}

// --- Pipeline principal ---

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Metodo no permitido' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
        return new Response(
            JSON.stringify({ error: 'Configuracion de Supabase no disponible' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const clientId = Deno.env.get('AZURE_CLIENT_ID')
    const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET')
    const tenantId = Deno.env.get('AZURE_TENANT_ID')

    if (!clientId || !clientSecret || !tenantId) {
        return new Response(
            JSON.stringify({ error: 'Credenciales de Azure no configuradas' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Parsear body para obtener job_id (modo pg_net/polling)
    let jobId: string | null = null
    try {
        const body = await req.json()
        jobId = body?.job_id || null
    } catch { /* body vacio es OK (CRON legacy) */ }

    const encoder = new TextEncoder()
    const startTime = Date.now()

    const stream = new ReadableStream({
        async start(controller) {
            // Throttle: minimo 3s entre actualizaciones a BD
            let lastDbUpdate = 0
            const DB_UPDATE_THROTTLE = 3000

            const send = (data: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))

                // Actualizar progreso en import_jobs cuando hay job_id (modo polling)
                if (jobId && data.status && data.pct !== undefined) {
                    const now = Date.now()
                    const isForced = data.phase === 'done' || data.phase === 'error'
                    if (isForced || now - lastDbUpdate >= DB_UPDATE_THROTTLE) {
                        lastDbUpdate = now
                        const supabaseForUpdate = createClient(supabaseUrl, supabaseServiceKey)
                        supabaseForUpdate.from('import_jobs').update({
                            status: 'processing',
                            progress_pct: data.pct as number,
                            progress_status: data.status as string,
                            updated_at: new Date().toISOString(),
                        }).eq('id', jobId).then(
                            ({ error: e }) => { if (e) console.error('[BD_NEPS] Error actualizando job:', e.message) }
                        )
                    }
                }
            }

            // Heartbeat: mantener conexion viva enviando pulso cada 5s
            const heartbeatInterval = setInterval(() => {
                controller.enqueue(encoder.encode(JSON.stringify({ phase: 'heartbeat', pct: -1 }) + '\n'))
            }, 5000)

            try {
                // Fase 0: Crear cliente Supabase
                const supabase = createClient(supabaseUrl, supabaseServiceKey)
                const timestampInicio = new Date().toISOString()

                // Fase 1: Autenticacion Azure
                send({ phase: 'auth', status: 'Autenticando con Microsoft Graph...', pct: 2 })
                const accessToken = await getGraphAccessToken()
                send({ phase: 'auth', status: 'Autenticacion exitosa', pct: 5 })

                // Fase 2: Buscar carpeta "BD" en correo
                send({ phase: 'folder', status: 'Buscando carpeta "BD" en correo...', pct: 7 })
                const folderId = await findMailFolder(accessToken, 'BD')
                send({ phase: 'folder', status: 'Carpeta "BD" encontrada', pct: 10 })

                // Fase 3: Listar todos los correos y separar lote mas reciente
                send({ phase: 'messages', status: 'Listando correos en carpeta BD...', pct: 12 })
                const allMessages = await listAllMessages(accessToken, folderId)

                if (allMessages.length === 0) {
                    const emptyResult = {
                        success: 0, errors: 0, duplicates: 0, totalProcessed: 0,
                        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
                        errorMessage: 'No se encontraron correos en la carpeta BD',
                    }
                    send({ phase: 'done', status: 'No hay correos en la carpeta BD', pct: 100, result: emptyResult })
                    if (jobId) {
                        await supabase.from('import_jobs').update({
                            status: 'completed', progress_pct: 100,
                            progress_status: 'No hay correos en la carpeta BD',
                            result: emptyResult, updated_at: new Date().toISOString(),
                        }).eq('id', jobId)
                    }
                    clearInterval(heartbeatInterval)
                    controller.close()
                    return
                }

                // Separar: solo procesar el lote del dia mas reciente, eliminar los viejos
                const { loteReciente, correosViejos } = separarLoteMasReciente(allMessages)
                const fechaLote = loteReciente[0]?.receivedDateTime.substring(0, 10) || 'N/A'
                const loteConAdjuntos = loteReciente.filter(m => m.hasAttachments)

                send({
                    phase: 'messages',
                    status: `${allMessages.length} correo(s) total — lote ${fechaLote}: ${loteConAdjuntos.length} con adjuntos, ${correosViejos.length} antiguo(s) a eliminar`,
                    pct: 15,
                })

                // Fase 4: Descargar adjuntos ZIP solo del lote mas reciente (paralelo en batches de 5)
                send({ phase: 'download', status: `Descargando ZIPs del lote ${fechaLote}...`, pct: 17 })
                const zipBuffers: { data: Uint8Array; msgId: string; name: string }[] = []
                const processedMessageIds: string[] = []
                const DOWNLOAD_CONCURRENCY = 5

                for (let batchStart = 0; batchStart < loteConAdjuntos.length; batchStart += DOWNLOAD_CONCURRENCY) {
                    const batch = loteConAdjuntos.slice(batchStart, batchStart + DOWNLOAD_CONCURRENCY)

                    const batchResults = await Promise.allSettled(
                        batch.map(async (msg) => {
                            const metas = await listAttachmentsMeta(accessToken, msg.id)
                            const zipMetas = metas.filter(m => m.name.toLowerCase().endsWith('.zip'))
                            const downloaded: { data: Uint8Array; msgId: string; name: string }[] = []

                            for (const meta of zipMetas) {
                                try {
                                    const bytes = await downloadAttachmentContent(accessToken, msg.id, meta.id)
                                    downloaded.push({ data: bytes, msgId: msg.id, name: meta.name })
                                } catch (dlErr) {
                                    console.error(`Error descargando ZIP ${meta.name}:`, dlErr)
                                }
                            }

                            if (zipMetas.length > 0) {
                                processedMessageIds.push(msg.id)
                            }

                            return downloaded
                        })
                    )

                    for (const result of batchResults) {
                        if (result.status === 'fulfilled') {
                            zipBuffers.push(...result.value)
                        }
                    }

                    const completed = Math.min(batchStart + DOWNLOAD_CONCURRENCY, loteConAdjuntos.length)
                    const pct = 17 + Math.round((completed / loteConAdjuntos.length) * 8)
                    send({ phase: 'download', status: `Descargando ${completed}/${loteConAdjuntos.length} correos...`, pct })
                }

                // IDs de correos viejos para eliminar sin procesar
                const oldMessageIds = correosViejos.map(m => m.id)

                if (zipBuffers.length === 0) {
                    // Aunque no hay ZIPs, igualmente eliminar correos viejos
                    for (const msgId of oldMessageIds) {
                        try { await deleteMessage(accessToken, msgId) } catch { /* silent */ }
                    }
                    const noZipResult = {
                        success: 0, errors: 0, duplicates: 0, totalProcessed: 0,
                        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
                        errorMessage: `Lote ${fechaLote}: sin archivos ZIP. ${oldMessageIds.length} correo(s) antiguo(s) eliminados.`,
                    }
                    send({ phase: 'done', status: 'No se encontraron archivos ZIP en el lote mas reciente', pct: 100, result: noZipResult })
                    if (jobId) {
                        await supabase.from('import_jobs').update({
                            status: 'completed', progress_pct: 100,
                            progress_status: 'Sin archivos ZIP',
                            result: noZipResult, updated_at: new Date().toISOString(),
                        }).eq('id', jobId)
                    }
                    clearInterval(heartbeatInterval)
                    controller.close()
                    return
                }

                send({ phase: 'download', status: `${zipBuffers.length} ZIP(s) descargado(s) del lote ${fechaLote}`, pct: 25 })

                // Fase 5: Extraer CSVs de ZIPs
                send({ phase: 'extract', status: 'Extrayendo CSVs de archivos ZIP...', pct: 27 })
                const csvTexts: string[] = []

                for (let i = 0; i < zipBuffers.length; i++) {
                    const { data, name } = zipBuffers[i]
                    try {
                        // Verificar firma ZIP (PK = 0x50 0x4B)
                        const isValidZip = data.length >= 4 && data[0] === 0x50 && data[1] === 0x4B
                        if (!isValidZip) {
                            console.error(`Archivo "${name}" no es ZIP valido (${data.length} bytes)`)
                            continue
                        }

                        const zip = await JSZip.loadAsync(data)
                        const csvFiles = Object.keys(zip.files).filter(
                            f => f.toLowerCase().endsWith('.csv') && !zip.files[f].dir
                        )

                        for (const csvFile of csvFiles) {
                            const csvBytes = await zip.files[csvFile].async('uint8array')
                            csvTexts.push(decodificarTexto(csvBytes))
                        }
                    } catch (err) {
                        console.error(`Error extrayendo ZIP ${name}:`, err)
                    }

                    const pct = 27 + Math.round((i / zipBuffers.length) * 8)
                    send({ phase: 'extract', status: `Extrayendo ${i + 1}/${zipBuffers.length} ZIPs...`, pct })
                }

                if (csvTexts.length === 0) {
                    const noCsvResult = {
                        success: 0, errors: 0, duplicates: 0, totalProcessed: 0,
                        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
                        errorMessage: 'Los archivos ZIP no contienen CSVs validos',
                    }
                    send({ phase: 'done', status: 'No se encontraron archivos CSV dentro de los ZIP', pct: 100, result: noCsvResult })
                    if (jobId) {
                        await supabase.from('import_jobs').update({
                            status: 'completed', progress_pct: 100,
                            progress_status: 'Sin CSVs validos',
                            result: noCsvResult, updated_at: new Date().toISOString(),
                        }).eq('id', jobId)
                    }
                    clearInterval(heartbeatInterval)
                    controller.close()
                    return
                }

                send({ phase: 'extract', status: `${csvTexts.length} archivo(s) CSV extraido(s)`, pct: 35 })

                // Fase 6: Cargar tablas de referencia
                send({ phase: 'reference', status: 'Cargando tablas de referencia...', pct: 37 })

                const { data: tipoIdRows, error: tipoIdErr } = await supabase
                    .from('tipoid')
                    .select('afi_tid_codigo, tipo_id')
                if (tipoIdErr) throw new Error(`Error cargando tipoid: ${tipoIdErr.message}`)

                const tipoIdMap = new Map<string, string>()
                for (const row of (tipoIdRows as TipoIdRow[])) {
                    tipoIdMap.set(row.afi_tid_codigo.trim(), row.tipo_id.trim())
                }

                // Cargar divipola paginado (PostgREST max_rows=1000, divipola tiene ~1122)
                const { data: divBatch1, error: divErr1 } = await supabase
                    .from('divipola')
                    .select('cod_municipio, nombre_departamento, nombre_municipio')
                    .order('cod_municipio')
                    .range(0, 999)
                if (divErr1) throw new Error(`Error cargando divipola: ${divErr1.message}`)

                const { data: divBatch2, error: divErr2 } = await supabase
                    .from('divipola')
                    .select('cod_municipio, nombre_departamento, nombre_municipio')
                    .order('cod_municipio')
                    .range(1000, 1999)
                if (divErr2) throw new Error(`Error cargando divipola p2: ${divErr2.message}`)

                const divipolaRows = [...(divBatch1 || []), ...(divBatch2 || [])]

                const divipolaMap = new Map<string, { nombre_municipio: string; nombre_departamento: string }>()
                const depMap = new Map<string, string>()

                for (const row of (divipolaRows as DivipolaRow[])) {
                    divipolaMap.set(row.cod_municipio, {
                        nombre_municipio: row.nombre_municipio,
                        nombre_departamento: row.nombre_departamento,
                    })
                    // Mapa de departamentos (primeros 2 digitos)
                    const depCode = row.cod_municipio.substring(0, 2)
                    if (!depMap.has(depCode)) {
                        depMap.set(depCode, row.nombre_departamento)
                    }
                }

                send({ phase: 'reference', status: `Tablas cargadas: ${tipoIdMap.size} tipos, ${divipolaMap.size} DIVIPOLA`, pct: 40 })

                // Fase 7: Parsear CSVs + Transformar + Deduplicar
                send({ phase: 'parse', status: 'Parseando y transformando CSVs...', pct: 42 })

                const deduplicados = new Map<string, BdRecord>()
                let totalLineas = 0
                let lineasDescartadas = 0
                let descartadasPorCampos = 0
                let descartadasPorTipoId = 0
                let descartadasPorDocId = 0
                const tipoIdNoResueltos = new Map<string, number>()
                const estadoDistribucion = new Map<string, number>()
                const regimenDistribucion = new Map<string, number>()
                const tipoIdDistribucion = new Map<string, number>()

                for (let csvIdx = 0; csvIdx < csvTexts.length; csvIdx++) {
                    // Soportar todos los tipos de fin de linea: \r\n (Windows), \n (Unix), \r (Mac clasico)
                    const lines = csvTexts[csvIdx].split(/\r?\n|\r/)

                    // Saltar header
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim()
                        if (!line) continue
                        totalLineas++

                        const fields = line.split(';')
                        if (fields.length < 33) {
                            descartadasPorCampos++
                            lineasDescartadas++
                            continue
                        }

                        // Resolver tipo_id via tabla tipoid
                        const afiTidCodigo = limpiarCampo(fields[4])
                        const tipoId = tipoIdMap.get(afiTidCodigo) || ''
                        const docId = limpiarCampo(fields[5])

                        if (!tipoId) {
                            descartadasPorTipoId++
                            lineasDescartadas++
                            if (afiTidCodigo) {
                                tipoIdNoResueltos.set(afiTidCodigo, (tipoIdNoResueltos.get(afiTidCodigo) || 0) + 1)
                            }
                            continue
                        }
                        if (!docId) {
                            descartadasPorDocId++
                            lineasDescartadas++
                            continue
                        }

                        // Resolver DIVIPOLA
                        const depCode = limpiarCampo(fields[21])
                        const munCode = limpiarCampo(fields[22])
                        const { municipio, departamento } = resolverDivipola(depCode, munCode, divipolaMap, depMap)

                        // Resolver regimen desde AFI_PAF_CODIGO_
                        const pafCodigo = limpiarCampo(fields[18])
                        const regimen = resolverRegimen(pafCodigo)

                        // Telefono: solo importar si inicia con 3 y tiene exactamente 10 digitos
                        const telefonoRaw = limpiarCampo(fields[15]).replace(/\D/g, '')
                        const telefono = (telefonoRaw.startsWith('3') && telefonoRaw.length === 10) ? telefonoRaw : ''

                        const record: BdRecord = {
                            tipo_id: tipoId,
                            id: docId,
                            apellido1: limpiarCampo(fields[6]),
                            apellido2: limpiarCampo(fields[7]),
                            nombres: limpiarCampo(fields[8]),
                            sexo: limpiarCampo(fields[13]).toUpperCase(),
                            direccion: limpiarCampo(fields[14]),
                            telefono,
                            fecha_nacimiento: convertirFecha(limpiarCampo(fields[16])),
                            estado: limpiarCampo(fields[20]).toUpperCase(),
                            municipio,
                            observaciones: limpiarCampo(fields[32]),
                            ips_primaria: limpiarCampo(fields[1]),
                            tipo_cotizante: limpiarCampo(fields[10]),
                            departamento,
                            rango: pafCodigo,
                            email: '',
                            regimen,
                            eps: 'NUEVA EPS',
                        }

                        // Tracking de distribuciones
                        tipoIdDistribucion.set(tipoId, (tipoIdDistribucion.get(tipoId) || 0) + 1)
                        if (record.estado) estadoDistribucion.set(record.estado, (estadoDistribucion.get(record.estado) || 0) + 1)
                        if (regimen) regimenDistribucion.set(regimen, (regimenDistribucion.get(regimen) || 0) + 1)

                        // Dedup: ultimo gana
                        deduplicados.set(`${tipoId}|${docId}`, record)
                    }

                    const pct = 42 + Math.round(((csvIdx + 1) / csvTexts.length) * 28)
                    send({
                        phase: 'parse',
                        status: `Parseando CSV ${csvIdx + 1}/${csvTexts.length}... (${deduplicados.size} registros unicos)`,
                        pct,
                    })
                }

                const registros = Array.from(deduplicados.values())
                const duplicados = totalLineas - lineasDescartadas - registros.length

                send({
                    phase: 'parse',
                    status: `${registros.length} registros unicos de ${totalLineas} lineas (${lineasDescartadas} descartadas, ${duplicados} duplicados)`,
                    pct: 70,
                })

                if (registros.length === 0) {
                    const noRecResult = {
                        success: 0, errors: 0, duplicates: duplicados, totalProcessed: totalLineas,
                        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
                        errorMessage: `${totalLineas} lineas procesadas pero todas fueron descartadas o duplicadas`,
                    }
                    send({ phase: 'done', status: 'No se encontraron registros validos en los CSVs', pct: 100, result: noRecResult })
                    if (jobId) {
                        await supabase.from('import_jobs').update({
                            status: 'completed', progress_pct: 100,
                            progress_status: 'Sin registros validos',
                            result: noRecResult, updated_at: new Date().toISOString(),
                        }).eq('id', jobId)
                    }
                    clearInterval(heartbeatInterval)
                    controller.close()
                    return
                }

                // Fase 8: Enviar batches a RPC
                send({ phase: 'upsert', status: 'Iniciando carga a base de datos...', pct: 72 })

                let totalInsertados = 0
                let totalActualizados = 0
                let totalComplementados = 0
                let totalErrores = 0
                const totalBatches = Math.ceil(registros.length / BATCH_SIZE)

                for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
                    const batch = registros.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE)

                    try {
                        const { data: rpcResult, error: rpcError } = await supabase.rpc('upsert_bd_batch', {
                            registros: batch,
                            p_fuente: 'BD_NEPS',
                        })

                        if (rpcError) {
                            console.error(`Error en batch ${batchIdx + 1}:`, rpcError.message)
                            totalErrores += batch.length
                        } else if (rpcResult) {
                            totalInsertados += rpcResult.insertados || 0
                            totalActualizados += rpcResult.actualizados || 0
                            totalComplementados += rpcResult.complementados || 0
                        }
                    } catch (err) {
                        console.error(`Excepcion en batch ${batchIdx + 1}:`, err)
                        totalErrores += batch.length
                    }

                    const pct = 72 + Math.round(((batchIdx + 1) / totalBatches) * 13)
                    send({
                        phase: 'upsert',
                        status: `Batch ${batchIdx + 1}/${totalBatches} (${totalInsertados + totalActualizados} procesados)`,
                        pct,
                    })
                }

                // Fase 9: Marcar huerfanos
                send({ phase: 'orphans', status: 'Marcando registros huerfanos...', pct: 87 })

                let huerfanosMarcados = 0
                try {
                    const { data: orphanResult, error: orphanError } = await supabase.rpc('marcar_huerfanos_bd', {
                        p_fuente: 'BD_NEPS',
                        p_timestamp_inicio: timestampInicio,
                    })

                    if (orphanError) {
                        console.error('Error marcando huerfanos:', orphanError)
                    } else if (orphanResult) {
                        huerfanosMarcados = orphanResult.huerfanos_marcados || 0
                    }
                } catch (err) {
                    console.error('Excepcion marcando huerfanos:', err)
                }

                send({ phase: 'orphans', status: `${huerfanosMarcados} registros huerfanos marcados`, pct: 90 })

                // Fase 10: Eliminar TODOS los correos (procesados + viejos)
                const allIdsToDelete = [...processedMessageIds, ...oldMessageIds]
                send({ phase: 'cleanup', status: `Eliminando ${allIdsToDelete.length} correo(s) (${processedMessageIds.length} procesados + ${oldMessageIds.length} antiguos)...`, pct: 92 })

                let correosEliminados = 0
                for (const msgId of allIdsToDelete) {
                    try {
                        await deleteMessage(accessToken, msgId)
                        correosEliminados++
                    } catch (err) {
                        console.error(`Error eliminando correo ${msgId}:`, err)
                    }
                }

                send({ phase: 'cleanup', status: `${correosEliminados} correo(s) eliminado(s)`, pct: 95 })

                // Fase 11: Registrar en import_history
                send({ phase: 'history', status: 'Registrando en historial...', pct: 97 })

                const duracion = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
                const totalExitosos = totalInsertados + totalActualizados + totalComplementados

                try {
                    await supabase.from('import_history').insert({
                        usuario: 'import-bd-neps',
                        archivo_nombre: `Lote ${fechaLote}: ${zipBuffers.length} ZIP(s), ${csvTexts.length} CSV(s)`,
                        tipo_fuente: 'bd_neps',
                        total_registros: registros.length,
                        exitosos: totalExitosos,
                        fallidos: totalErrores,
                        duplicados: duplicados,
                        duracion: duracion,
                        detalles: {
                            fecha_lote: fechaLote,
                            insertados: totalInsertados,
                            actualizados: totalActualizados,
                            complementados: totalComplementados,
                            huerfanos_marcados: huerfanosMarcados,
                            correos_lote_procesados: processedMessageIds.length,
                            correos_antiguos_eliminados: oldMessageIds.length,
                            correos_eliminados_total: correosEliminados,
                            zips: zipBuffers.length,
                            csvs: csvTexts.length,
                            lineas_totales: totalLineas,
                            lineas_descartadas: lineasDescartadas,
                        },
                    })
                } catch (err) {
                    console.error('Error registrando historial:', err)
                }

                // Generar log informativo CSV
                const reportSections: string[] = []

                // Seccion 1: Resumen general
                const summaryRows = [
                    '=== SECCION: RESUMEN DE IMPORTACION BD NEPS ===',
                    `Fecha de lote,${fechaLote}`,
                    `Correos procesados,${processedMessageIds.length}`,
                    `Correos antiguos eliminados,${oldMessageIds.length}`,
                    `Archivos ZIP descargados,${zipBuffers.length}`,
                    `Archivos CSV extraidos,${csvTexts.length}`,
                    `Total lineas en CSVs,${totalLineas}`,
                    `Registros unicos (deduplicados),${registros.length}`,
                    `Duplicados en archivo,${duplicados}`,
                    `Insertados nuevos,${totalInsertados}`,
                    `Actualizados,${totalActualizados}`,
                    `Complementados (BD_ST_CERETE),${totalComplementados}`,
                    `Huerfanos marcados,${huerfanosMarcados}`,
                    `Descartados total,${lineasDescartadas}`,
                    `  - Por pocos campos (<33),${descartadasPorCampos}`,
                    `  - Por tipo_id no resuelto,${descartadasPorTipoId}`,
                    `  - Por documento vacio,${descartadasPorDocId}`,
                    `Errores de procesamiento,${totalErrores}`,
                    `Correos eliminados,${correosEliminados}`,
                    `Duracion,${duracion}`,
                ]
                reportSections.push(summaryRows.join('\n'))

                // Seccion 2: Distribucion por tipo de documento
                if (tipoIdDistribucion.size > 0) {
                    const tipoIdRows = ['\n=== SECCION: DISTRIBUCION POR TIPO DE DOCUMENTO ===', 'Tipo documento,Cantidad']
                    for (const [tid, cnt] of Array.from(tipoIdDistribucion.entries()).sort((a, b) => b[1] - a[1])) {
                        tipoIdRows.push(`${tid},${cnt}`)
                    }
                    reportSections.push(tipoIdRows.join('\n'))
                }

                // Seccion 3: Distribucion por estado
                if (estadoDistribucion.size > 0) {
                    const estadoRows = ['\n=== SECCION: DISTRIBUCION POR ESTADO ===', 'Estado,Cantidad']
                    for (const [est, cnt] of Array.from(estadoDistribucion.entries()).sort((a, b) => b[1] - a[1])) {
                        estadoRows.push(`${est},${cnt}`)
                    }
                    reportSections.push(estadoRows.join('\n'))
                }

                // Seccion 4: Distribucion por regimen
                if (regimenDistribucion.size > 0) {
                    const regimenRows = ['\n=== SECCION: DISTRIBUCION POR REGIMEN ===', 'Regimen,Cantidad']
                    for (const [reg, cnt] of Array.from(regimenDistribucion.entries()).sort((a, b) => b[1] - a[1])) {
                        regimenRows.push(`${reg},${cnt}`)
                    }
                    reportSections.push(regimenRows.join('\n'))
                }

                // Seccion 5: Codigos tipo_id no resueltos
                if (tipoIdNoResueltos.size > 0) {
                    const noResRows = ['\n=== SECCION: CODIGOS TIPO ID NO RESUELTOS ===', 'Codigo AFI_TID,Cantidad']
                    for (const [cod, cnt] of Array.from(tipoIdNoResueltos.entries()).sort((a, b) => b[1] - a[1])) {
                        noResRows.push(`${cod},${cnt}`)
                    }
                    reportSections.push(noResRows.join('\n'))
                }

                const infoReport = reportSections.join('\n\n')

                // Resultado final
                const finalResult = {
                    success: totalExitosos,
                    errors: totalErrores,
                    duplicates: duplicados,
                    totalProcessed: registros.length,
                    duration: duracion,
                    infoReport,
                }

                send({
                    phase: 'done',
                    status: 'Importacion completada',
                    pct: 100,
                    result: finalResult,
                })

                // Marcar job como completado en BD (modo polling)
                if (jobId) {
                    try {
                        await supabase.from('import_jobs').update({
                            status: 'completed',
                            progress_pct: 100,
                            progress_status: 'Importacion completada',
                            result: finalResult,
                            updated_at: new Date().toISOString(),
                        }).eq('id', jobId)
                    } catch (e) {
                        console.error('[BD_NEPS] Error marcando job como completado:', e)
                    }
                }

                // Enviar correo de notificacion (solo registrar error, no bloquear)
                try {
                    await enviarCorreoNotificacion(supabase, {
                        fechaLote,
                        totalExitosos,
                        totalErrores,
                        totalInsertados,
                        totalActualizados,
                        totalComplementados,
                        huerfanosMarcados,
                        duplicados,
                        totalLineas,
                        lineasDescartadas,
                        registrosUnicos: registros.length,
                        duracion,
                        zips: zipBuffers.length,
                        csvs: csvTexts.length,
                        correosEliminados,
                        infoReport,
                    })
                } catch (emailErr) {
                    console.error('Error enviando correo notificacion:', emailErr instanceof Error ? emailErr.message : emailErr)
                }

            } catch (error) {
                console.error('[BD_NEPS] Error critico:', error instanceof Error ? error.message : error)

                const errorMsg = error instanceof Error ? error.message : 'Error desconocido en importacion BD NEPS'

                // Marcar job como fallido en BD (modo polling)
                if (jobId) {
                    try {
                        const supabaseErr = createClient(supabaseUrl, supabaseServiceKey)
                        await supabaseErr.from('import_jobs').update({
                            status: 'failed',
                            error_message: errorMsg,
                            updated_at: new Date().toISOString(),
                        }).eq('id', jobId)
                    } catch (e) {
                        console.error('[BD_NEPS] Error marcando job como fallido:', e)
                    }
                }

                try {
                    await notifyCriticalError({
                        category: 'INTEGRATION_ERROR',
                        errorMessage: `Fallo importacion BD NEPS: ${errorMsg}`,
                        feature: FEATURE_NAME,
                        severity: 'HIGH',
                        error: error instanceof Error ? error : undefined,
                    })
                } catch (notifyErr) {
                    console.error('[BD_NEPS] Error notificando error critico:', notifyErr)
                }

                send({
                    phase: 'error',
                    error: errorMsg,
                    pct: 0,
                })
            }

            clearInterval(heartbeatInterval)
            controller.close()
        },
    })

    return new Response(stream, {
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
            'X-Content-Type-Options': 'nosniff',
        },
    })
})
