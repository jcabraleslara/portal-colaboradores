/**
 * API Serverless - Crear Usuario del Portal
 * Endpoint: POST /api/create-user
 * 
 * Este endpoint crea usuarios tanto en Supabase Auth como en usuarios_portal.
 * Solo accesible para usuarios autenticados con rol superadmin.
 * 
 * Variables de entorno requeridas:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SUPABASE_ANON_KEY
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Crear cliente con service_role para operaciones admin
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

// Crear cliente anónimo para verificar el token del usuario
const supabaseAnon = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
)

interface CreateUserRequest {
    identificacion: string
    nombre_completo: string
    email_institucional: string
    rol: 'operativo' | 'admin' | 'superadmin' | 'gerencia' | 'auditor' | 'asistencial' | 'externo'
    password: string
    contacto_id?: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Solo permitir POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    // 0. Inicializar clientes dentro del handler para asegurar env vars frescas
    // Intentar obtener de SUPABASE_URL o VITE_SUPABASE_URL por compatibilidad
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
        return res.status(500).json({
            error: 'Configuración incompleta en el servidor',
            details: `Faltan: ${!supabaseUrl ? 'URL ' : ''}${!serviceRoleKey ? 'ServiceKey ' : ''}${!anonKey ? 'AnonKey' : ''}`,
            hint: 'Asegúrate de configurar SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y SUPABASE_ANON_KEY en Vercel'
        })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
    const supabaseAnon = createClient(supabaseUrl, anonKey)

    try {
        // 1. Verificar que el usuario esté autenticado
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No autorizado: token no proporcionado' })
        }

        const token = authHeader.split(' ')[1]

        // Verificar el token usando el cliente anónimo
        const { data: { user: authUser }, error: authError } = await supabaseAnon.auth.getUser(token)

        if (authError || !authUser) {
            console.error('Error de autenticación:', authError)
            return res.status(401).json({
                error: 'No autorizado: token inválido',
                details: authError?.message || 'Error de red al validar token',
                hint: `Verifica que el servidor pueda conectar a ${supabaseUrl}. Error: ${authError?.name || 'FetchError'}`
            })
        }

        // 2. Verificar que el usuario sea superadmin
        const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('usuarios_portal')
            .select('rol')
            .eq('email_institucional', authUser.email)
            .single()

        if (profileError || !userProfile || userProfile.rol !== 'superadmin') {
            return res.status(403).json({ error: 'Acceso denegado: solo superadmin puede crear usuarios' })
        }

        // 3. Validar datos de entrada
        const { identificacion, nombre_completo, email_institucional, rol, password, contacto_id } = req.body as CreateUserRequest

        if (!identificacion || !nombre_completo || !email_institucional || !rol || !password) {
            return res.status(400).json({ error: 'Faltan campos requeridos' })
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
        }

        // 4. Verificar que no exista el usuario
        const { data: existing } = await supabaseAdmin
            .from('usuarios_portal')
            .select('id')
            .or(`identificacion.eq.${identificacion},email_institucional.eq.${email_institucional}`)
            .single()

        if (existing) {
            return res.status(409).json({ error: 'Ya existe un usuario con esa identificación o email' })
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
            return res.status(500).json({ error: `Error creando credenciales: ${createAuthError.message}` })
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
            return res.status(500).json({ error: `Error creando perfil: ${portalError.message}` })
        }

        // 7. Actualizar datos del contacto si es necesario
        if (contacto_id) {
            try {
                // Obtener datos actuales del contacto
                const { data: contactData } = await supabaseAdmin
                    .from('contactos')
                    .select('email_personal, email_institucional')
                    .eq('id', contacto_id)
                    .single()

                if (contactData) {
                    // Si el email usado es el personal y no tiene institucional, lo movemos
                    if (!contactData.email_institucional && contactData.email_personal === email_institucional) {
                        await supabaseAdmin
                            .from('contactos')
                            .update({
                                email_institucional: email_institucional,
                                email_personal: null
                            })
                            .eq('id', contacto_id)
                    }
                    // Si no tiene institucional pero el personal es diferente, solo ponemos el institucional
                    else if (!contactData.email_institucional) {
                        await supabaseAdmin
                            .from('contactos')
                            .update({ email_institucional: email_institucional })
                            .eq('id', contacto_id)
                    }
                }
            } catch (contactUpdateError) {
                console.error('Error actualizando contacto:', contactUpdateError)
                // No detenemos el proceso si falla la actualización del contacto
                // ya que el usuario ya fue creado exitosamente
            }
        }

        // 8. Respuesta exitosa
        return res.status(201).json({
            success: true,
            message: 'Usuario creado exitosamente',
            usuario: usuarioPortal
        })

    } catch (error: any) {
        console.error('Error inesperado:', error)
        return res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        })
    }
}
