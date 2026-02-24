/**
 * Supabase Edge Function: Resetear Contraseña de Usuario
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * POST /functions/v1/reset-password
 *
 * Resetea la contraseña de un usuario a su número de identificación.
 * Solo accesible para usuarios autenticados con rol superadmin.
 * Marca primer_login: true para forzar cambio de contraseña.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface ResetPasswordRequest {
    usuario_portal_id: string
}

Deno.serve(async (req) => {
    // Manejar preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Solo permitir POST
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Inicializar clientes
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
        return new Response(
            JSON.stringify({ error: 'Configuracion incompleta en el servidor' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
    const supabaseAnon = createClient(supabaseUrl, anonKey)

    try {
        // 1. Verificar que el usuario esté autenticado
        const authHeader = req.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(
                JSON.stringify({ error: 'No autorizado: token no proporcionado' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const token = authHeader.split(' ')[1]

        const { data: { user: authUser }, error: authError } = await supabaseAnon.auth.getUser(token)

        if (authError || !authUser) {
            return new Response(
                JSON.stringify({ error: 'No autorizado: token invalido' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Verificar que el usuario sea superadmin
        const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('usuarios_portal')
            .select('rol')
            .eq('email_institucional', authUser.email)
            .single()

        if (profileError || !userProfile || userProfile.rol !== 'superadmin') {
            return new Response(
                JSON.stringify({ error: 'Acceso denegado: solo superadmin puede resetear contraseñas' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Validar datos de entrada
        const body = await req.json() as ResetPasswordRequest
        const { usuario_portal_id } = body

        if (!usuario_portal_id) {
            return new Response(
                JSON.stringify({ error: 'Falta el ID del usuario' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 4. Obtener datos del usuario objetivo
        const { data: targetUser, error: targetError } = await supabaseAdmin
            .from('usuarios_portal')
            .select('identificacion, email_institucional, nombre_completo')
            .eq('id', usuario_portal_id)
            .single()

        if (targetError || !targetUser) {
            return new Response(
                JSON.stringify({ error: 'Usuario no encontrado' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 5. Buscar el auth user ID por email via SQL (más eficiente que listUsers)
        const { data: authLookup, error: lookupError } = await supabaseAdmin
            .rpc('get_auth_user_id_by_email', { target_email: targetUser.email_institucional })

        if (lookupError || !authLookup) {
            return new Response(
                JSON.stringify({ error: 'Usuario no encontrado en el sistema de autenticacion' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const authUserId = authLookup as string

        // 6. Resetear la contraseña al número de identificación
        const newPassword = targetUser.identificacion

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            authUserId,
            {
                password: newPassword,
                user_metadata: {
                    primer_login: true
                }
            }
        )

        if (updateError) {
            return new Response(
                JSON.stringify({ error: `Error reseteando contraseña: ${updateError.message}` }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`Contraseña reseteada para ${targetUser.email_institucional} por ${authUser.email}`)

        // 7. Respuesta exitosa
        return new Response(
            JSON.stringify({
                success: true,
                message: `Contraseña reseteada exitosamente para ${targetUser.nombre_completo}. La nueva contraseña es su número de identificación.`
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error inesperado:', error)
        return new Response(
            JSON.stringify({
                error: 'Error interno del servidor',
                details: error instanceof Error ? error.message : 'Unknown error'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
