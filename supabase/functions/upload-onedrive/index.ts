/**
 * Supabase Edge Function: Sincronizacion con OneDrive
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * POST /functions/v1/upload-onedrive
 * Body: { radicado: string }
 *
 * Sincroniza archivos de soportes de facturacion con OneDrive usando Microsoft Graph API.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { notifyAuthenticationError, notifyServiceUnavailable } from '../_shared/critical-error-utils.ts'

// Tipos para Microsoft Graph
interface GraphTokenResponse {
    access_token: string
    expires_in: number
    token_type: string
}

interface GraphDriveItem {
    id: string
    name: string
    webUrl: string
}

/**
 * Obtener access token de Microsoft Graph usando Client Credentials flow
 */
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
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
    })

    if (!response.ok) {
        const errorText = await response.text()

        if (response.status === 401 || response.status === 403 || response.status === 400) {
            console.error('ERROR CRITICO: Credenciales de Azure OAuth2 invalidas o expiradas')
            await notifyAuthenticationError(
                'Azure AD (Microsoft Graph)',
                'Sincronizacion con OneDrive',
                response.status
            )
        }

        throw new Error(`Error obteniendo token de Graph: ${response.status} - ${errorText}`)
    }

    const data: GraphTokenResponse = await response.json()
    return data.access_token
}

/**
 * Obtener ID de carpeta por path
 */
async function obtenerIdPorPath(
    accessToken: string,
    folderPath: string
): Promise<string> {
    const driveUrl = 'https://graph.microsoft.com/v1.0/users/coordinacionmedica@gestarsaludips.com/drive'
    const url = `${driveUrl}/root:${folderPath}`

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    })

    if (!response.ok) {
        if (response.status >= 500) {
            await notifyServiceUnavailable(
                'Microsoft Graph API',
                'Sincronizacion con OneDrive',
                response.status
            )
        }
        throw new Error(`Error obteniendo carpeta por path: ${response.status}`)
    }

    const driveItem: GraphDriveItem = await response.json()
    return driveItem.id
}

/**
 * Crear carpeta en OneDrive dentro de una carpeta padre especifica
 */
async function crearCarpetaOneDrive(
    accessToken: string,
    nombreCarpeta: string,
    parentFolderId: string
): Promise<GraphDriveItem> {
    const driveUrl = 'https://graph.microsoft.com/v1.0/users/coordinacionmedica@gestarsaludips.com/drive'
    const url = `${driveUrl}/items/${parentFolderId}/children`

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: nombreCarpeta,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename',
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()

        if (response.status >= 500) {
            await notifyServiceUnavailable(
                'Microsoft Graph API',
                'Sincronizacion con OneDrive - Crear Carpeta',
                response.status
            )
        }

        throw new Error(`Error creando carpeta: ${response.status} - ${errorText}`)
    }

    return response.json()
}

/**
 * Subir archivo a OneDrive
 */
async function subirArchivoOneDrive(
    accessToken: string,
    folderId: string,
    nombreArchivo: string,
    contenido: ArrayBuffer
): Promise<GraphDriveItem> {
    const driveUrl = 'https://graph.microsoft.com/v1.0/users/coordinacionmedica@gestarsaludips.com/drive'
    const url = `${driveUrl}/items/${folderId}:/${nombreArchivo}:/content`

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
        },
        body: contenido,
    })

    if (!response.ok) {
        const errorText = await response.text()

        if (response.status >= 500) {
            await notifyServiceUnavailable(
                'Microsoft Graph API',
                'Sincronizacion con OneDrive - Subir Archivo',
                response.status
            )
        }

        throw new Error(`Error subiendo archivo: ${response.status} - ${errorText}`)
    }

    return response.json()
}

/**
 * Generar nombre de carpeta segun nomenclatura
 */
function generarNombreCarpeta(soporte: Record<string, unknown>): string {
    const radicado = soporte.radicado as string || 'FACT0000'
    const fecha = new Date(soporte.fecha_atencion as string)
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const dia = String(fecha.getDate()).padStart(2, '0')

    const epsCorta: Record<string, string> = {
        'NUEVA EPS': 'NEPS',
        'SALUD TOTAL': 'STOT',
        'MUTUAL SER': 'MSER',
        'FAMILIAR': 'FAMI',
    }

    const regimenCorto: Record<string, string> = {
        'CONTRIBUTIVO': 'CON',
        'SUBSIDIADO': 'SUB',
    }

    const servicioCorto: Record<string, string> = {
        'Laboratorio': 'Lab',
        'Imagenes': 'Img',
        'Consulta Especializada': 'ConsultaEsp',
        'Procedimiento': 'Proc',
        'Cirugia': 'Cir',
        'Hospitalizacion': 'Hosp',
        'Urgencias': 'Urg',
        'Terapias': 'Ter',
    }

    const eps = epsCorta[soporte.eps as string] || 'EPS'
    const regimen = regimenCorto[soporte.regimen as string] || 'REG'
    const servicio = servicioCorto[soporte.servicio_prestado as string] || 'Serv'

    return `${radicado}_${mes}${dia}_${eps}_${regimen}_${servicio}`
}

Deno.serve(async (req) => {
    // Manejar preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Solo permitir POST
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Metodo no permitido' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const clientId = Deno.env.get('AZURE_CLIENT_ID')
    const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET')
    const tenantId = Deno.env.get('AZURE_TENANT_ID')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const onedriveFolderId = Deno.env.get('ONEDRIVE_FOLDER_ID') || ''
    const onedriveFolderPath = Deno.env.get('ONEDRIVE_FOLDER_PATH') || '/Documents/Soportes Facturacion'

    // Verificar configuracion
    if (!clientId || !clientSecret || !tenantId) {
        return new Response(
            JSON.stringify({ error: 'Credenciales de Azure no configuradas' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    if (!supabaseUrl || !supabaseServiceKey) {
        return new Response(
            JSON.stringify({ error: 'Configuracion de Supabase no disponible' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        const { radicado } = await req.json()

        if (!radicado) {
            return new Response(
                JSON.stringify({ error: 'Radicado es requerido' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Crear cliente Supabase con service role para acceso total
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Obtener datos del soporte
        const { data: soporte, error: soporteError } = await supabase
            .from('soportes_facturacion')
            .select('*')
            .eq('radicado', radicado)
            .single()

        if (soporteError || !soporte) {
            return new Response(
                JSON.stringify({ error: `No se encontro el radicado ${radicado}` }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Obtener access token de Microsoft Graph
        try {
            const accessToken = await getGraphAccessToken()

            // Obtener ID de la carpeta base (Soportes Facturacion)
            let carpetaBaseId = onedriveFolderId
            if (!carpetaBaseId) {
                carpetaBaseId = await obtenerIdPorPath(accessToken, onedriveFolderPath)
            }

            // Crear subcarpeta para este radicado
            const nombreCarpeta = generarNombreCarpeta(soporte)
            const carpeta = await crearCarpetaOneDrive(accessToken, nombreCarpeta, carpetaBaseId)

            // Recopilar todas las URLs de archivos
            const categorias = [
                'urls_validacion_derechos',
                'urls_autorizacion',
                'urls_soporte_clinico',
                'urls_comprobante_recibo',
                'urls_recibo_caja',
                'urls_orden_medica',
                'urls_descripcion_quirurgica',
                'urls_registro_anestesia',
                'urls_hoja_medicamentos',
                'urls_notas_enfermeria',
            ]

            let archivosSubidos = 0

            for (const categoriaDb of categorias) {
                const urls: string[] = soporte[categoriaDb] || []
                const categoriaId = categoriaDb.replace('urls_', '')

                for (let i = 0; i < urls.length; i++) {
                    const url = urls[i]

                    try {
                        // Descargar archivo de Supabase
                        const archivoResponse = await fetch(url)
                        if (!archivoResponse.ok) continue

                        const contenido = await archivoResponse.arrayBuffer()

                        // Extraer nombre del archivo de la URL
                        let nombreArchivo = ''
                        try {
                            const urlObj = new URL(url)
                            const pathName = decodeURIComponent(urlObj.pathname)
                            nombreArchivo = pathName.split('/').pop() || ''
                        } catch {
                            // URL malformada
                        }

                        // Fallback de seguridad
                        if (!nombreArchivo) {
                            nombreArchivo = `DOC_${radicado}_${categoriaId}_${i + 1}.pdf`
                        }

                        // Subir a OneDrive
                        await subirArchivoOneDrive(accessToken, carpeta.id, nombreArchivo, contenido)
                        archivosSubidos++
                    } catch (uploadError) {
                        console.error(`Error subiendo archivo de ${categoriaId}:`, uploadError)
                    }
                }
            }

            // Actualizar registro en Supabase
            await supabase
                .from('soportes_facturacion')
                .update({
                    onedrive_folder_id: carpeta.id,
                    onedrive_folder_url: carpeta.webUrl,
                    onedrive_sync_status: 'synced',
                    onedrive_sync_at: new Date().toISOString(),
                })
                .eq('radicado', radicado)

            return new Response(
                JSON.stringify({
                    success: true,
                    folderId: carpeta.id,
                    folderUrl: carpeta.webUrl,
                    archivosSubidos,
                    message: `Sincronizado exitosamente: ${archivosSubidos} archivo(s) en carpeta ${nombreCarpeta}`
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )

        } catch (onedriveError) {
            console.error('Error especifico de OneDrive:', onedriveError)

            // Actualizar estado a 'failed'
            await supabase
                .from('soportes_facturacion')
                .update({
                    onedrive_sync_status: 'failed',
                    onedrive_sync_at: new Date().toISOString(),
                })
                .eq('radicado', radicado)

            return new Response(
                JSON.stringify({
                    success: false,
                    warning: true,
                    message: 'Radicado procesado, pero fallo la sincronizacion con OneDrive. Se reintentara luego.',
                    errorDetails: onedriveError instanceof Error ? onedriveError.message : 'Error desconocido de OneDrive'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

    } catch (error) {
        console.error('Error general en upload-onedrive:', error)
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Error interno del servidor',
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
