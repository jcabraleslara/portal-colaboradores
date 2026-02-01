/**
 * Supabase Edge Function: Eliminar carpetas de OneDrive
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * POST /functions/v1/delete-onedrive
 * Body: { radicado?: string, folderId?: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface GraphTokenResponse {
    access_token: string
}

/**
 * Obtener access token de Microsoft Graph
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
        const errorText = await response.text()
        throw new Error(`Error eliminando item en OneDrive: ${response.status} - ${errorText}`)
    }
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

    if (!clientId || !clientSecret || !tenantId) {
        return new Response(
            JSON.stringify({ error: 'Credenciales de Azure no configuradas' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        const { radicado, folderId } = await req.json()

        if (!radicado && !folderId) {
            return new Response(
                JSON.stringify({ error: 'Radicado o FolderID requeridos' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        let targetFolderId = folderId

        // Si no nos dieron el ID, lo buscamos en BD
        if (!targetFolderId && radicado) {
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
            const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            const supabase = createClient(supabaseUrl, serviceKey)

            const { data } = await supabase
                .from('soportes_facturacion')
                .select('onedrive_folder_id')
                .eq('radicado', radicado)
                .single()

            if (data?.onedrive_folder_id) {
                targetFolderId = data.onedrive_folder_id
            }
        }

        if (!targetFolderId) {
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'No se encontro ID de carpeta en OneDrive, se omitio eliminacion remota.'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Proceder a eliminar de OneDrive
        const accessToken = await getGraphAccessToken()
        await eliminarItemOneDrive(accessToken, targetFolderId)

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Carpeta eliminada de OneDrive exitosamente',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error eliminando de OneDrive:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido',
                message: 'Fallo la eliminacion en OneDrive, pero se puede continuar con la eliminacion local'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
