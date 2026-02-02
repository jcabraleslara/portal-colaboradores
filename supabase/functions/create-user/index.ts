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
import { sendGmailEmail, type InlineImage } from '../_shared/gmail-utils.ts'
import { GESTAR_LOGO_BASE64 } from '../_shared/email-templates.ts'

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

// Constantes de diseno - Paleta de colores GESTAR SALUD
const COLORS = {
    primary: '#0095EB',      // Azul principal
    primaryDark: '#0077BC',  // Azul oscuro
    primaryLight: '#E6F4FD', // Azul claro
    accent: '#F3585D',       // Coral/Rojo (corazon del logo)
    accentDark: '#E82D33',   // Coral oscuro
    success: '#85C54C',      // Verde
    successDark: '#6BA83B',  // Verde oscuro
    successLight: '#F4FAF0', // Verde claro
    slate50: '#F8FAFC',
    slate100: '#F1F5F9',
    slate500: '#64748B',
    slate600: '#475569',
    slate800: '#1E293B',
    slate900: '#0F172A',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    error: '#DC2626',
    errorLight: '#FEF2F2',
}

const PORTAL_URL = 'https://colaboradores.gestarsaludips.com.co'

/**
 * Genera template de correo para usuarios INTERNOS (colaboradores)
 * Usa cid:logo-gestar para imagen inline
 */
function generarTemplateInterno(
    nombre: string,
    email: string,
    password: string,
    rol: string
): string {
    const rolLabel = ROL_LABELS[rol] || rol

    return `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: ${COLORS.slate800}; max-width: 600px; margin: 0 auto; background-color: ${COLORS.slate50};">
            <!-- Header con logo -->
            <div style="background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <img src="cid:logo-gestar" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 15px;" />
                <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: white;">Bienvenido al equipo</h1>
                <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; color: white;">Portal de Colaboradores</p>
            </div>

            <div style="padding: 30px; background-color: #ffffff;">
                <p style="font-size: 16px; margin-bottom: 20px; color: ${COLORS.slate800};">Hola <strong>${nombre}</strong>,</p>

                <p style="line-height: 1.7; color: ${COLORS.slate600};">
                    Te damos la bienvenida al equipo de <strong style="color: ${COLORS.primary};">Gestar Salud IPS</strong>.
                    Se ha creado tu cuenta en el Portal de Colaboradores, donde podras acceder a las
                    herramientas y recursos necesarios para tu labor.
                </p>

                <!-- Credenciales -->
                <div style="background: linear-gradient(135deg, ${COLORS.primaryLight} 0%, #CCE9FB 100%); border-left: 4px solid ${COLORS.primary}; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                    <h3 style="color: ${COLORS.primaryDark}; margin: 0 0 15px 0; font-size: 16px;">Tus credenciales de acceso</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: ${COLORS.slate500}; width: 130px;">Usuario:</td>
                            <td style="padding: 8px 0; font-weight: 600; color: ${COLORS.primaryDark};">${email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: ${COLORS.slate500};">Contrasena:</td>
                            <td style="padding: 8px 0;"><span style="font-family: 'Consolas', monospace; background-color: ${COLORS.warningLight}; padding: 6px 12px; border-radius: 4px; font-weight: 600; color: #92400e;">${password}</span></td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: ${COLORS.slate500};">Rol asignado:</td>
                            <td style="padding: 8px 0; font-weight: 500; color: ${COLORS.slate800};">${rolLabel}</td>
                        </tr>
                    </table>
                </div>

                <!-- Alerta de seguridad -->
                <div style="background-color: ${COLORS.errorLight}; border: 1px solid #FECACA; border-left: 4px solid ${COLORS.accent}; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0;">
                    <p style="margin: 0; color: #991B1B; font-size: 14px;">
                        <strong>&#9888; Importante:</strong> Por seguridad, debes cambiar tu contrasena en el primer inicio de sesion.
                    </p>
                </div>

                <!-- Boton CTA -->
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${PORTAL_URL}"
                       style="display: inline-block; background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%); color: white; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 15px rgba(0, 149, 235, 0.35);">
                        Acceder al Portal
                    </a>
                </div>

                <!-- Recomendaciones -->
                <div style="background-color: ${COLORS.slate100}; padding: 20px; border-radius: 8px; margin-top: 25px;">
                    <h4 style="margin: 0 0 12px 0; color: ${COLORS.slate600}; font-size: 14px;">Recomendaciones de uso responsable:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: ${COLORS.slate500}; font-size: 13px; line-height: 1.9;">
                        <li>Manten tus credenciales seguras y no las compartas con terceros</li>
                        <li>Cierra sesion al terminar tu jornada laboral</li>
                        <li>Reporta cualquier anomalia al area de sistemas</li>
                        <li>Utiliza el portal solo para fines laborales autorizados</li>
                    </ul>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: ${COLORS.slate800}; color: ${COLORS.slate500}; padding: 25px; text-align: center; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #94A3B8;">
                    Este es un mensaje automatico del Portal de Colaboradores.
                </p>
                <p style="margin: 0; font-size: 12px; color: ${COLORS.slate500};">
                    <strong style="color: ${COLORS.primary};">Gestar Salud IPS</strong> - Comprometidos con tu bienestar
                </p>
            </div>
        </div>
    `
}

/**
 * Genera template de correo para usuarios EXTERNOS (no colaboradores)
 * Usa cid:logo-gestar para imagen inline
 */
function generarTemplateExterno(
    nombre: string,
    email: string,
    password: string
): string {
    return `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: ${COLORS.slate800}; max-width: 600px; margin: 0 auto; background-color: ${COLORS.slate50};">
            <!-- Header con logo -->
            <div style="background: linear-gradient(135deg, ${COLORS.success} 0%, ${COLORS.successDark} 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <img src="cid:logo-gestar" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 15px;" />
                <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: white;">Bienvenido al Portal</h1>
                <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; color: white;">Gestar Salud IPS</p>
            </div>

            <div style="padding: 30px; background-color: #ffffff;">
                <p style="font-size: 16px; margin-bottom: 20px; color: ${COLORS.slate800};">Estimado(a) <strong>${nombre}</strong>,</p>

                <p style="line-height: 1.7; color: ${COLORS.slate600};">
                    Se ha creado una cuenta para que puedas acceder al Portal Web de <strong style="color: ${COLORS.success};">Gestar Salud IPS</strong>.
                    A traves de este portal podras realizar las gestiones autorizadas segun tu perfil de usuario.
                </p>

                <!-- Credenciales -->
                <div style="background: linear-gradient(135deg, ${COLORS.successLight} 0%, #DCFCE7 100%); border-left: 4px solid ${COLORS.success}; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                    <h3 style="color: ${COLORS.successDark}; margin: 0 0 15px 0; font-size: 16px;">Datos de acceso</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: ${COLORS.slate500}; width: 130px;">Usuario:</td>
                            <td style="padding: 8px 0; font-weight: 600; color: ${COLORS.successDark};">${email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: ${COLORS.slate500};">Contrasena:</td>
                            <td style="padding: 8px 0;"><span style="font-family: 'Consolas', monospace; background-color: ${COLORS.warningLight}; padding: 6px 12px; border-radius: 4px; font-weight: 600; color: #92400e;">${password}</span></td>
                        </tr>
                    </table>
                </div>

                <!-- Alerta de seguridad -->
                <div style="background-color: ${COLORS.errorLight}; border: 1px solid #FECACA; border-left: 4px solid ${COLORS.accent}; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0;">
                    <p style="margin: 0; color: #991B1B; font-size: 14px;">
                        <strong>&#9888; Importante:</strong> Por seguridad, te recomendamos cambiar tu contrasena en el primer inicio de sesion.
                    </p>
                </div>

                <!-- Boton CTA -->
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${PORTAL_URL}"
                       style="display: inline-block; background: linear-gradient(135deg, ${COLORS.success} 0%, ${COLORS.successDark} 100%); color: white; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 15px rgba(133, 197, 76, 0.35);">
                        Ingresar al Portal
                    </a>
                </div>

                <!-- Condiciones de uso -->
                <div style="background-color: ${COLORS.slate100}; padding: 20px; border-radius: 8px; margin-top: 25px;">
                    <h4 style="margin: 0 0 12px 0; color: ${COLORS.slate600}; font-size: 14px;">Condiciones de uso:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: ${COLORS.slate500}; font-size: 13px; line-height: 1.9;">
                        <li>Tus credenciales son personales e intransferibles</li>
                        <li>El acceso al portal esta limitado a las funciones autorizadas</li>
                        <li>Toda actividad queda registrada para efectos de auditoria</li>
                    </ul>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: ${COLORS.slate800}; color: ${COLORS.slate500}; padding: 25px; text-align: center; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #94A3B8;">
                    Este es un mensaje automatico del Portal de Gestar Salud IPS.
                </p>
                <p style="margin: 0; font-size: 12px; color: ${COLORS.slate500};">
                    Si tienes dudas, contacta al administrador del sistema.
                </p>
            </div>
        </div>
    `
}

/**
 * Envia correo de bienvenida segun el tipo de usuario
 * Incluye logo embebido como imagen inline (CID)
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

    // Logo embebido como imagen inline
    const inlineImages: InlineImage[] = [{
        cid: 'logo-gestar',
        content: GESTAR_LOGO_BASE64,
        mimeType: 'image/png'
    }]

    await sendGmailEmail({
        to: email,
        subject,
        htmlBody,
        inlineImages
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
