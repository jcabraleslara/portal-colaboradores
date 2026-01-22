
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Configuración - Reutilizamos las mismas variables
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || ''
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || ''
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || ''
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

interface GraphTokenResponse {
    access_token: string
}

/**
 * Obtener access token de Microsoft Graph
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
        throw new Error(`Error obteniendo token de Graph: ${response.status}`)
    }

    const data: GraphTokenResponse = await response.json()
    return data.access_token
}

/**
 * Eliminar item (archivo/carpeta) en OneDrive
 */
async function eliminarItemOneDrive(accessToken: string, itemId: string): Promise<void> {
    const driveUrl = 'https://graph.microsoft.com/v1.0/users/coordinacionmedica@gestarsaludips.com/drive'
    const url = `${driveUrl}/items/${itemId}`

    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    })

    if (!response.ok && response.status !== 404) {
        // Ignoramos 404 porque significa que ya no existe (que es lo que queremos)
        const errorText = await response.text()
        throw new Error(`Error eliminando item en OneDrive: ${response.status} - ${errorText}`)
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' })
    }

    if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_TENANT_ID) {
        return res.status(500).json({ error: 'Credenciales de Azure no configuradas' })
    }

    try {
        const { radicado, folderId } = req.body

        if (!radicado && !folderId) {
            return res.status(400).json({ error: 'Radicado o FolderID requeridos' })
        }

        let targetFolderId = folderId

        // Si no nos dieron el ID, lo buscamos en BD
        if (!targetFolderId && radicado) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
            const { data, error } = await supabase
                .from('soportes_facturacion')
                .select('onedrive_folder_id')
                .eq('radicado', radicado)
                .single()

            if (data?.onedrive_folder_id) {
                targetFolderId = data.onedrive_folder_id
            }
        }

        if (!targetFolderId) {
            // No hay nada que borrar en OneDrive
            return res.status(200).json({
                success: true,
                message: 'No se encontró ID de carpeta en OneDrive, se omitió eliminación remota.'
            })
        }

        // Proceder a eliminar de OneDrive
        const accessToken = await getGraphAccessToken()
        await eliminarItemOneDrive(accessToken, targetFolderId)

        return res.status(200).json({
            success: true,
            message: 'Carpeta eliminada de OneDrive exitosamente',
        })

    } catch (error) {
        console.error('Error eliminando de OneDrive:', error)
        // No devolvemos 500 para no bloquear la eliminación local si falla la remota
        // pero avisamos en el cuerpo
        return res.status(200).json({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido',
            message: 'Falló la eliminación en OneDrive, pero se puede continuar con la eliminación local'
        })
    }
}
