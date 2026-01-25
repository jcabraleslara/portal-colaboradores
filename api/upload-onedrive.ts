/**
 * API Serverless: Sincronización con OneDrive
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Sincroniza archivos de soportes de facturación con OneDrive usando Microsoft Graph API.
 * Este endpoint descarga los archivos de Supabase Storage y los sube a OneDrive
 * en una carpeta organizada según la nomenclatura definida.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { notifyAuthenticationError, notifyServiceUnavailable } from './_utils/critical-error-utils.js'

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

// Configuración
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || ''
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || ''
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || ''
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ID de la carpeta destino en OneDrive (configurar en variables de entorno)
// Si no está configurado, se buscará por ruta
const ONEDRIVE_FOLDER_ID = process.env.ONEDRIVE_FOLDER_ID || ''
const ONEDRIVE_FOLDER_PATH = process.env.ONEDRIVE_FOLDER_PATH || '/Documents/Soportes Facturación'




/**
 * Obtener access token de Microsoft Graph usando Client Credentials flow
 */
async function getGraphAccessToken(): Promise<string> {
    const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`

    const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
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

        // Si es error de autenticación (401/403/400), notificar al equipo técnico
        if (response.status === 401 || response.status === 403 || response.status === 400) {
            console.error('⚠️ ERROR CRÍTICO: Credenciales de Azure OAuth2 inválidas o expiradas')

            // Notificar error crítico de autenticación
            await notifyAuthenticationError(
                'Azure AD (Microsoft Graph)',
                'Sincronización con OneDrive',
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
        // Si es error de servicio, notificar
        if (response.status >= 500) {
            await notifyServiceUnavailable(
                'Microsoft Graph API',
                'Sincronización con OneDrive',
                response.status
            )
        }

        throw new Error(`Error obteniendo carpeta por path: ${response.status}`)
    }

    const driveItem: GraphDriveItem = await response.json()
    return driveItem.id
}

/**
 * Crear carpeta en OneDrive dentro de una carpeta padre específica
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

        // Si es error de servicio, notificar
        if (response.status >= 500) {
            await notifyServiceUnavailable(
                'Microsoft Graph API',
                'Sincronización con OneDrive - Crear Carpeta',
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

        // Si es error de servicio, notificar
        if (response.status >= 500) {
            await notifyServiceUnavailable(
                'Microsoft Graph API',
                'Sincronización con OneDrive - Subir Archivo',
                response.status
            )
        }

        throw new Error(`Error subiendo archivo: ${response.status} - ${errorText}`)
    }

    return response.json()
}

/**
 * Generar nombre de carpeta según nomenclatura
 * Ejemplo: FACT0001_0120_NEPS_CON_ConsultaEsp
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
        'Imágenes': 'Img',
        'Consulta Especializada': 'ConsultaEsp',
        'Procedimiento': 'Proc',
        'Cirugía': 'Cir',
        'Hospitalización': 'Hosp',
        'Urgencias': 'Urg',
        'Terapias': 'Ter',
    }

    const eps = epsCorta[soporte.eps as string] || 'EPS'
    const regimen = regimenCorto[soporte.regimen as string] || 'REG'
    const servicio = servicioCorto[soporte.servicio_prestado as string] || 'Serv'

    return `${radicado}_${mes}${dia}_${eps}_${regimen}_${servicio}`
}

/**
 * Handler principal de la API
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Solo permitir POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' })
    }

    // Verificar configuración
    if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_TENANT_ID) {
        return res.status(500).json({ error: 'Credenciales de Azure no configuradas' })
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Configuración de Supabase no disponible' })
    }

    try {
        const { radicado } = req.body

        if (!radicado) {
            return res.status(400).json({ error: 'Radicado es requerido' })
        }

        // Crear cliente Supabase con service role para acceso total
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

        // Obtener datos del soporte
        const { data: soporte, error: soporteError } = await supabase
            .from('soportes_facturacion')
            .select('*')
            .eq('radicado', radicado)
            .single()

        if (soporteError || !soporte) {
            return res.status(404).json({ error: `No se encontró el radicado ${radicado}` })
        }

        // Obtener access token de Microsoft Graph
        let onedriveResult = { success: false, message: '' }
        try {
            const accessToken = await getGraphAccessToken()

            // Obtener ID de la carpeta base (Soportes Facturación)
            let carpetaBaseId = ONEDRIVE_FOLDER_ID
            if (!carpetaBaseId) {
                // Si no hay ID configurado, buscar por path
                carpetaBaseId = await obtenerIdPorPath(accessToken, ONEDRIVE_FOLDER_PATH)
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

                        // ESTRATEGIA DE NOMBRADO: USAR EL NOMBRE REAL DE SUPABASE
                        // La URL firmada contiene el path real: .../soportes-facturacion/RADICADO/NOMBRE_CORRECTO.pdf?...
                        // Debemos extraer ese nombre para mantener la consistencia total entre Supabase y OneDrive.

                        let nombreArchivo = ''
                        try {
                            // 1. Obtener path sin query params
                            const urlObj = new URL(url)
                            const pathName = urlObj.pathname // /storage/v1/object/sign/soportes-facturacion/RAD/...

                            // 2. Decodificar caracteres especiales (espacios, tildes, etc)
                            const decodedPath = decodeURIComponent(pathName)

                            // 3. Extraer el último segmento (nombre del archivo)
                            nombreArchivo = decodedPath.split('/').pop() || ''
                        } catch (e) {
                            console.warn('Error parseando URL de archivo:', e)
                        }

                        // Fallback de seguridad si falla el parseo (muy raro)
                        if (!nombreArchivo) {
                            const extension = 'pdf'
                            const prefijoFallback = 'DOC_'
                            nombreArchivo = `${prefijoFallback}${radicado}_${categoriaId}_${i + 1}.${extension}`
                        }

                        // Subir a OneDrive con el nombre EXACTO que tiene en Supabase
                        await subirArchivoOneDrive(accessToken, carpeta.id, nombreArchivo, contenido)
                        archivosSubidos++
                    } catch (uploadError) {
                        console.error(`Error subiendo archivo de ${categoriaId}:`, uploadError)
                        // Continuar con otros archivos
                    }
                }
            }

            // Actualizar registro en Supabase solo si hubo éxito en OneDrive
            await supabase
                .from('soportes_facturacion')
                .update({
                    onedrive_folder_id: carpeta.id,
                    onedrive_folder_url: carpeta.webUrl,
                    onedrive_sync_status: 'synced',
                    onedrive_sync_at: new Date().toISOString(),
                })
                .eq('radicado', radicado)

            onedriveResult = {
                success: true,
                message: `Sincronizado exitosamente: ${archivosSubidos} archivo(s) en carpeta ${nombreCarpeta}`
            }

            return res.status(200).json({
                success: true,
                folderId: carpeta.id,
                folderUrl: carpeta.webUrl,
                archivosSubidos,
                message: onedriveResult.message,
            })

        } catch (onedriveError) {
            console.error('Error específico de OneDrive:', onedriveError)

            // Si falla OneDrive, no fallamos toda la petición, pero notificamos
            // Actualizamos estado a 'failed'
            await supabase
                .from('soportes_facturacion')
                .update({
                    onedrive_sync_status: 'failed',
                    onedrive_sync_at: new Date().toISOString(),
                })
                .eq('radicado', radicado)

            return res.status(200).json({
                success: false, // Indicamos que la sincro falló
                warning: true,
                message: 'Radicado procesado, pero falló la sincronización con OneDrive. Se reintentará luego.',
                errorDetails: onedriveError instanceof Error ? onedriveError.message : 'Error desconocido de OneDrive'
            })
        }

    } catch (error) {
        console.error('Error general en upload-onedrive:', error)
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Error interno del servidor',
        })
    }
}
