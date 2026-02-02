/**
 * Supabase Edge Function: Crear Usuario del Portal
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * POST /functions/v1/create-user
 *
 * Este endpoint crea usuarios tanto en Supabase Auth como en usuarios_portal.
 * Solo accesible para usuarios autenticados con rol superadmin.
 * Envia correo de bienvenida diferenciado segun el rol (interno vs externo).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { sendGmailEmail } from '../_shared/gmail-utils.ts'

interface CreateUserRequest {
    identificacion: string
    nombre_completo: string
    email_institucional: string
    rol: 'operativo' | 'admin' | 'superadmin' | 'gerencia' | 'auditor' | 'asistencial' | 'externo'
    password: string
    contacto_id?: string | null
}

// Mapeo de roles a nombres amigables
const ROL_LABELS: Record<string, string> = {
    operativo: 'Operativo',
    admin: 'Administrador',
    superadmin: 'Super Administrador',
    gerencia: 'Gerencia',
    auditor: 'Auditor',
    asistencial: 'Asistencial',
    externo: 'Usuario Externo'
}

/**
 * Genera template de correo para usuarios INTERNOS (colaboradores)
 */
function generarTemplateInterno(
    nombre: string,
    email: string,
    password: string,
    rol: string
): string {
    const rolLabel = ROL_LABELS[rol] || rol
    const portalUrl = 'https://colaboradores.gestarsaludips.com.co'

    return `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="margin: 0; font-size: 26px; font-weight: 600;">Bienvenido a Gestar Salud IPS</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 15px;">Portal de Colaboradores</p>
            </div>

            <div style="padding: 30px; background-color: #ffffff;">
                <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${nombre}</strong>,</p>

                <p style="line-height: 1.6;">
                    Te damos la bienvenida al equipo de <strong>Gestar Salud IPS</strong>.
                    Se ha creado tu cuenta en el Portal de Colaboradores, donde podras acceder a las
                    herramientas y recursos necesarios para tu labor.
                </p>

                <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 4px solid #0284c7; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                    <h3 style="color: #0369a1; margin: 0 0 15px 0; font-size: 16px;">Tus credenciales de acceso</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; width: 120px;">Usuario:</td>
                            <td style="padding: 8px 0; font-weight: 600; color: #1e40af;">${email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;">Contraseña:</td>
                            <td style="padding: 8px 0; font-family: 'Consolas', monospace; background-color: #fef3c7; padding: 6px 12px; border-radius: 4px; display: inline-block; font-weight: 600; color: #92400e;">${password}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;">Rol asignado:</td>
                            <td style="padding: 8px 0; font-weight: 500;">${rolLabel}</td>
                        </tr>
                    </table>
                </div>

                <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; color: #991b1b; font-size: 14px;">
                        <strong>Importante:</strong> Por seguridad, debes cambiar tu contraseña en el primer inicio de sesion.
                    </p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${portalUrl}"
                       style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.3);">
                        Acceder al Portal
                    </a>
                </div>

                <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin-top: 25px;">
                    <h4 style="margin: 0 0 10px 0; color: #475569; font-size: 14px;">Recomendaciones de uso responsable:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: #64748b; font-size: 13px; line-height: 1.8;">
                        <li>Mantén tus credenciales seguras y no las compartas con terceros</li>
                        <li>Cierra sesion al terminar tu jornada laboral</li>
                        <li>Reporta cualquier anomalia al area de sistemas</li>
                        <li>Utiliza el portal solo para fines laborales autorizados</li>
                    </ul>
                </div>
            </div>

            <div style="background-color: #1e293b; color: #94a3b8; padding: 25px; text-align: center; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 10px 0; font-size: 13px;">
                    Este es un mensaje automatico del Portal de Colaboradores.
                </p>
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                    Gestar Salud IPS - Comprometidos con tu bienestar
                </p>
            </div>
        </div>
    `
}

/**
 * Genera template de correo para usuarios EXTERNOS (no colaboradores)
 */
function generarTemplateExterno(
    nombre: string,
    email: string,
    password: string
): string {
    const portalUrl = 'https://colaboradores.gestarsaludips.com.co'

    return `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="margin: 0; font-size: 26px; font-weight: 600;">Bienvenido al Portal</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 15px;">Gestar Salud IPS</p>
            </div>

            <div style="padding: 30px; background-color: #ffffff;">
                <p style="font-size: 16px; margin-bottom: 20px;">Estimado(a) <strong>${nombre}</strong>,</p>

                <p style="line-height: 1.6;">
                    Se ha creado una cuenta para que puedas acceder al Portal Web de <strong>Gestar Salud IPS</strong>.
                    A traves de este portal podras realizar las gestiones autorizadas segun tu perfil de usuario.
                </p>

                <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid #16a34a; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                    <h3 style="color: #15803d; margin: 0 0 15px 0; font-size: 16px;">Datos de acceso</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; width: 120px;">Usuario:</td>
                            <td style="padding: 8px 0; font-weight: 600; color: #166534;">${email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;">Contraseña:</td>
                            <td style="padding: 8px 0; font-family: 'Consolas', monospace; background-color: #fef3c7; padding: 6px 12px; border-radius: 4px; display: inline-block; font-weight: 600; color: #92400e;">${password}</td>
                        </tr>
                    </table>
                </div>

                <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; color: #991b1b; font-size: 14px;">
                        <strong>Importante:</strong> Por seguridad, te recomendamos cambiar tu contraseña en el primer inicio de sesion.
                    </p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${portalUrl}"
                       style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);">
                        Ingresar al Portal
                    </a>
                </div>

                <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin-top: 25px;">
                    <h4 style="margin: 0 0 10px 0; color: #475569; font-size: 14px;">Condiciones de uso:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: #64748b; font-size: 13px; line-height: 1.8;">
                        <li>Tus credenciales son personales e intransferibles</li>
                        <li>El acceso al portal esta limitado a las funciones autorizadas</li>
                        <li>Toda actividad queda registrada para efectos de auditoria</li>
                    </ul>
                </div>
            </div>

            <div style="background-color: #1e293b; color: #94a3b8; padding: 25px; text-align: center; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 10px 0; font-size: 13px;">
                    Este es un mensaje automatico del Portal de Gestar Salud IPS.
                </p>
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                    Si tienes dudas, contacta al administrador del sistema.
                </p>
            </div>
        </div>
    `
}

/**
 * Envia correo de bienvenida segun el tipo de usuario
 */
async function enviarCorreoBienvenida(
    nombre: string,
    email: string,
    password: string,
    rol: string
): Promise<void> {
    const esExterno = rol === 'externo'

    const subject = esExterno
        ? 'Bienvenido al Portal de Gestar Salud IPS'
        : 'Bienvenido al Portal de Colaboradores - Gestar Salud IPS'

    const htmlBody = esExterno
        ? generarTemplateExterno(nombre, email, password)
        : generarTemplateInterno(nombre, email, password, rol)

    await sendGmailEmail({
        to: email,
        subject,
        htmlBody
    })
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

        // 8. Enviar correo de bienvenida
        try {
            await enviarCorreoBienvenida(nombre_completo, email_institucional, password, rol)
            console.log(`Correo de bienvenida enviado a: ${email_institucional}`)
        } catch (emailError) {
            // No fallamos la creacion si el correo no se envia
            console.error('Error enviando correo de bienvenida:', emailError)
        }

        // 9. Respuesta exitosa
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
