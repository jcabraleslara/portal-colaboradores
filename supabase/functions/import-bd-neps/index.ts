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

interface MailAttachment {
    id: string
    name: string
    contentType: string
    contentBytes: string
    size: number
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

async function getMessageAttachments(token: string, messageId: string): Promise<MailAttachment[]> {
    const url = `${GRAPH_BASE}/users/${EMAIL_USER}/messages/${messageId}/attachments?$select=id,name,contentType,contentBytes,size`
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
        throw new Error(`Error obteniendo adjuntos del mensaje ${messageId}: ${res.status}`)
    }

    const data = await res.json()
    return (data.value || []) as MailAttachment[]
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

    const encoder = new TextEncoder()
    const startTime = Date.now()

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
            }

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
                    send({
                        phase: 'done',
                        status: 'No hay correos en la carpeta BD',
                        pct: 100,
                        result: {
                            success: 0, errors: 0, duplicates: 0, totalProcessed: 0,
                            duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
                            errorMessage: 'No se encontraron correos en la carpeta BD',
                        },
                    })
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

                // Fase 4: Descargar adjuntos ZIP solo del lote mas reciente
                send({ phase: 'download', status: `Descargando ZIPs del lote ${fechaLote}...`, pct: 17 })
                const zipBuffers: { data: Uint8Array; msgId: string; name: string }[] = []
                const processedMessageIds: string[] = []

                for (let i = 0; i < loteConAdjuntos.length; i++) {
                    const msg = loteConAdjuntos[i]
                    const attachments = await getMessageAttachments(accessToken, msg.id)

                    const zipAttachments = attachments.filter(
                        att => att.name.toLowerCase().endsWith('.zip') && att.contentBytes
                    )

                    for (const att of zipAttachments) {
                        // Decodificar base64 a Uint8Array
                        const binaryStr = atob(att.contentBytes)
                        const bytes = new Uint8Array(binaryStr.length)
                        for (let j = 0; j < binaryStr.length; j++) {
                            bytes[j] = binaryStr.charCodeAt(j)
                        }
                        zipBuffers.push({ data: bytes, msgId: msg.id, name: att.name })
                    }

                    if (zipAttachments.length > 0) {
                        processedMessageIds.push(msg.id)
                    }

                    const pct = 17 + Math.round((i / loteConAdjuntos.length) * 8)
                    send({ phase: 'download', status: `Descargando ${i + 1}/${loteConAdjuntos.length} correos...`, pct })
                }

                // IDs de correos viejos para eliminar sin procesar
                const oldMessageIds = correosViejos.map(m => m.id)

                if (zipBuffers.length === 0) {
                    // Aunque no hay ZIPs, igualmente eliminar correos viejos
                    for (const msgId of oldMessageIds) {
                        try { await deleteMessage(accessToken, msgId) } catch { /* silent */ }
                    }
                    send({
                        phase: 'done',
                        status: 'No se encontraron archivos ZIP en el lote mas reciente',
                        pct: 100,
                        result: {
                            success: 0, errors: 0, duplicates: 0, totalProcessed: 0,
                            duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
                            errorMessage: `Lote ${fechaLote}: sin archivos ZIP. ${oldMessageIds.length} correo(s) antiguo(s) eliminados.`,
                        },
                    })
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
                        const zip = await JSZip.loadAsync(data)
                        const csvFiles = Object.keys(zip.files).filter(
                            f => f.toLowerCase().endsWith('.csv') && !zip.files[f].dir
                        )

                        for (const csvFile of csvFiles) {
                            const csvBytes = await zip.files[csvFile].async('uint8array')
                            const csvText = decodificarTexto(csvBytes)
                            csvTexts.push(csvText)
                        }
                    } catch (err) {
                        console.error(`Error extrayendo ZIP ${name}:`, err)
                    }

                    const pct = 27 + Math.round((i / zipBuffers.length) * 8)
                    send({ phase: 'extract', status: `Extrayendo ${i + 1}/${zipBuffers.length} ZIPs...`, pct })
                }

                if (csvTexts.length === 0) {
                    send({
                        phase: 'done',
                        status: 'No se encontraron archivos CSV dentro de los ZIP',
                        pct: 100,
                        result: {
                            success: 0, errors: 0, duplicates: 0, totalProcessed: 0,
                            duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
                            errorMessage: 'Los archivos ZIP no contienen CSVs validos',
                        },
                    })
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

                const { data: divipolaRows, error: divipolaErr } = await supabase
                    .from('divipola')
                    .select('cod_municipio, nombre_departamento, nombre_municipio')
                if (divipolaErr) throw new Error(`Error cargando divipola: ${divipolaErr.message}`)

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

                for (let csvIdx = 0; csvIdx < csvTexts.length; csvIdx++) {
                    const lines = csvTexts[csvIdx].split('\n')
                    // Saltar header
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim()
                        if (!line) continue
                        totalLineas++

                        const fields = line.split(';')
                        if (fields.length < 33) {
                            lineasDescartadas++
                            continue
                        }

                        // Resolver tipo_id via tabla tipoid
                        const afiTidCodigo = limpiarCampo(fields[4])
                        const tipoId = tipoIdMap.get(afiTidCodigo) || ''
                        const docId = limpiarCampo(fields[5])

                        if (!tipoId || !docId) {
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
                    send({
                        phase: 'done',
                        status: 'No se encontraron registros validos en los CSVs',
                        pct: 100,
                        result: {
                            success: 0, errors: 0, duplicates: duplicados, totalProcessed: totalLineas,
                            duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
                            errorMessage: `${totalLineas} lineas procesadas pero todas fueron descartadas o duplicadas`,
                        },
                    })
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
                            registros: JSON.stringify(batch),
                            p_fuente: 'BD_NEPS',
                        })

                        if (rpcError) {
                            console.error(`Error en batch ${batchIdx + 1}:`, rpcError)
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
                        tipo_fuente: 'bd-neps',
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

                // Resultado final
                send({
                    phase: 'done',
                    status: 'Importacion completada',
                    pct: 100,
                    result: {
                        success: totalExitosos,
                        errors: totalErrores,
                        duplicates: duplicados,
                        totalProcessed: registros.length,
                        duration: duracion,
                    },
                })

            } catch (error) {
                console.error('Error en pipeline import-bd-neps:', error)

                await notifyCriticalError({
                    category: 'INTEGRATION_ERROR',
                    errorMessage: `Fallo importacion BD NEPS: ${error instanceof Error ? error.message : String(error)}`,
                    feature: FEATURE_NAME,
                    severity: 'HIGH',
                    error: error instanceof Error ? error : undefined,
                })

                send({
                    phase: 'error',
                    error: error instanceof Error ? error.message : 'Error desconocido en importacion BD NEPS',
                    pct: 0,
                })
            }

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
