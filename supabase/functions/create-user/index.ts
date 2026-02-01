/**
 * Supabase Edge Function: Crear Usuario del Portal
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * POST /functions/v1/create-user
 *
 * Este endpoint crea usuarios tanto en Supabase Auth como en usuarios_portal.
 * Solo accesible para usuarios autenticados con rol superadmin.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface CreateUserRequest {
    identificacion: string
    nombre_completo: string
    email_institucional: string
    rol: 'operativo' | 'admin' | 'superadmin' | 'gerencia' | 'auditor' | 'asistencial' | 'externo'
    password: string
    contacto_id?: string | null
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
            JSON.stringify({
                error: 'Configuracion incompleta en el servidor',
                details: `Faltan: ${!supabaseUrl ? 'URL ' : ''}${!serviceRoleKey ? 'ServiceKey ' : ''}${!anonKey ? 'AnonKey' : ''}`,
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
    const supabaseAnon = createClient(supabaseUrl, anonKey)

    try {
        // 1. Verificar que el usuario este autenticado
        const authHeader = req.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(
                JSON.stringify({ error: 'No autorizado: token no proporcionado' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const token = authHeader.split(' ')[1]

        // Verificar el token usando el cliente anonimo
        const { data: { user: authUser }, error: authError } = await supabaseAnon.auth.getUser(token)

        if (authError || !authUser) {
            console.error('Error de autenticacion:', authError)
            return new Response(
                JSON.stringify({
                    error: 'No autorizado: token invalido',
                    details: authError?.message || 'Error de red al validar token',
                }),
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
                JSON.stringify({ error: 'Acceso denegado: solo superadmin puede crear usuarios' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Validar datos de entrada
        const body = await req.json() as CreateUserRequest
        const { identificacion, nombre_completo, email_institucional, rol, password, contacto_id } = body

        if (!identificacion || !nombre_completo || !email_institucional || !rol || !password) {
            return new Response(
                JSON.stringify({ error: 'Faltan campos requeridos' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (password.length < 6) {
            return new Response(
                JSON.stringify({ error: 'La contrasena debe tener al menos 6 caracteres' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 4. Verificar que no exista el usuario
        const { data: existing } = await supabaseAdmin
            .from('usuarios_portal')
            .select('id')
            .or(`identificacion.eq.${identificacion},email_institucional.eq.${email_institucional}`)
            .single()

        if (existing) {
            return new Response(
                JSON.stringify({ error: 'Ya existe un usuario con esa identificacion o email' }),
                { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 5. Crear usuario en Supabase Auth
        const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
            email: email_institucional,
            password: password,
            email_confirm: true,
            user_metadata: {
                identificacion,
                primer_login: true
            }
        })

        if (createAuthError) {
            console.error('Error creando usuario en auth:', createAuthError)
            return new Response(
                JSON.stringify({ error: `Error creando credenciales: ${createAuthError.message}` }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 6. Crear registro en usuarios_portal
        const { data: usuarioPortal, error: portalError } = await supabaseAdmin
            .from('usuarios_portal')
            .insert({
                identificacion,
                nombre_completo,
                email_institucional,
                rol,
                contacto_id: contacto_id || null,
                activo: true,
                created_by: authUser.id
            })
            .select()
            .single()

        if (portalError) {
            console.error('Error creando usuario_portal:', portalError)
            // Rollback: eliminar usuario de auth
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
            return new Response(
                JSON.stringify({ error: `Error creando perfil: ${portalError.message}` }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 7. Actualizar datos del contacto si es necesario
        if (contacto_id) {
            try {
                const { data: contactData } = await supabaseAdmin
                    .from('contactos')
                    .select('email_personal, email_institucional')
                    .eq('id', contacto_id)
                    .single()

                if (contactData) {
                    if (!contactData.email_institucional && contactData.email_personal === email_institucional) {
                        await supabaseAdmin
                            .from('contactos')
                            .update({
                                email_institucional: email_institucional,
                                email_personal: null
                            })
                            .eq('id', contacto_id)
                    } else if (!contactData.email_institucional) {
                        await supabaseAdmin
                            .from('contactos')
                            .update({ email_institucional: email_institucional })
                            .eq('id', contacto_id)
                    }
                }
            } catch (contactUpdateError) {
                console.error('Error actualizando contacto:', contactUpdateError)
            }
        }

        // 8. Respuesta exitosa
        return new Response(
            JSON.stringify({
                success: true,
                message: 'Usuario creado exitosamente',
                usuario: usuarioPortal
            }),
            { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
