/**
 * Servicio de Autenticación con Supabase Auth
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Usa el sistema nativo de autenticación de Supabase
 * con bcrypt, rate limiting y refresh tokens automáticos.
 */

import { supabase } from '@/config/supabase.config'
import { ERROR_MESSAGES } from '@/config/constants'
import { AuthUser, LoginResult, LoginCredentials, ChangePasswordData } from '@/types'

// ========================================
// SERVICIO PRINCIPAL
// ========================================

// Helper para timeouts de Supabase (evitar bucles infinitos)
const TIMEOUT_MS = 15000 // 15 segundos máximo
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withTimeout = <T>(promise: PromiseLike<T>, operationName: string): Promise<T> => {
    return Promise.race([
        promise as Promise<T>,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`TIMEOUT: La operación ${operationName} tardó demasiado.`)), TIMEOUT_MS)
        )
    ])
}

export const authService = {
    /**
     * Intentar login con credenciales usando Supabase Auth
     */
    async login(credentials: LoginCredentials): Promise<LoginResult> {
        const { identificacion, password } = credentials

        try {
            console.log(`🔐 Iniciando login para: ${identificacion}`)

            // signInWithPassword() reemplaza cualquier sesión existente automáticamente.
            // NO llamar signOut() aquí: dispara eventos SIGNED_OUT espurios que
            // interfieren con el flujo de login y causan cierres de sesión inesperados.

            // 1. Buscar el usuario en usuarios_portal por identificación
            // Usamos .then(res => res) para convertir el PostgrestBuilder en una Promise real compatible con withTimeout
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: usuarioPortal, error: usuarioError } = await withTimeout<any>(
                supabase
                    .from('usuarios_portal')
                    .select('identificacion, nombre_completo, email_institucional, rol, activo')
                    .eq('identificacion', identificacion)
                    .single()
                    .then(res => res),
                'buscar_usuario_portal'
            )

            if (usuarioError || !usuarioPortal) {
                console.info('Login fallido: usuario no encontrado en usuarios_portal', { identificacion })
                return {
                    success: false,
                    error: ERROR_MESSAGES.INVALID_CREDENTIALS,
                }
            }

            // Validar que el usuario esté activo
            if (!usuarioPortal.activo) {
                console.info('Login fallido: usuario desactivado', { identificacion })
                return {
                    success: false,
                    error: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
                }
            }

            // El email institucional es requerido para Supabase Auth
            if (!usuarioPortal.email_institucional) {
                console.info('Login fallido: usuario sin email institucional', { identificacion })
                return {
                    success: false,
                    error: 'Este usuario no tiene email institucional configurado. Contacta al administrador.',
                }
            }

            // 2. Intentar login con Supabase Auth
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: authData, error: authError } = await withTimeout<any>(
                supabase.auth.signInWithPassword({
                    email: usuarioPortal.email_institucional,
                    password: password,
                }),
                'supabase_auth_signin'
            )

            if (authError) {
                console.info('Login fallido:', authError.message)

                if (authError.message.includes('Invalid login credentials')) {
                    return {
                        success: false,
                        error: ERROR_MESSAGES.INVALID_CREDENTIALS,
                    }
                }
                if (authError.message.includes('Email not confirmed')) {
                    return {
                        success: false,
                        error: 'Tu correo no ha sido confirmado. Revisa tu bandeja de entrada.',
                    }
                }
                if (authError.message.includes('rate limit')) {
                    return {
                        success: false,
                        error: ERROR_MESSAGES.ACCOUNT_LOCKED,
                    }
                }

                return {
                    success: false,
                    error: authError.message,
                }
            }

            if (!authData.user) {
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            // 3. El rol viene directamente de la tabla usuarios_portal
            const rol = usuarioPortal.rol || 'operativo'
            // primer_login es true SOLO si está explícitamente en true.
            // Si es null/undefined (usuarios pre-existentes), se asume que ya cambiaron contraseña.
            const primerLogin = authData.user.user_metadata?.primer_login === true

            // 4. Construir objeto de usuario (nombre ya viene concatenado de usuarios_portal)
            const user: AuthUser = {
                identificacion: usuarioPortal.identificacion,
                nombreCompleto: usuarioPortal.nombre_completo,
                email: usuarioPortal.email_institucional,
                rol,
                primerLogin,
                ultimoLogin: authData.user.last_sign_in_at
                    ? new Date(authData.user.last_sign_in_at)
                    : null,
            }

            console.info('Login exitoso via Supabase Auth', { identificacion, rol })

            return {
                success: true,
                user,
                requiresPasswordChange: primerLogin,
            }
        } catch (error: any) {
            console.error('Error crítico en login:', error)

            // Mensaje específico para timeout
            if (error?.message?.includes('TIMEOUT')) {
                return {
                    success: false,
                    error: 'El servidor tardó demasiado en responder. Verifica tu conexión a internet.'
                }
            }

            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Cambiar contraseña del usuario actual
     */
    async changePassword(
        _identificacion: string,
        data: ChangePasswordData
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Validar que las contraseñas coincidan
            if (data.newPassword !== data.confirmPassword) {
                return { success: false, error: ERROR_MESSAGES.PASSWORDS_DONT_MATCH }
            }

            // Validar fortaleza
            const validation = this.validatePasswordStrength(data.newPassword)
            if (!validation.valid) {
                return { success: false, error: validation.error }
            }

            // Cambiar contraseña via Supabase Auth
            const { error } = await supabase.auth.updateUser({
                password: data.newPassword,
            })

            if (error) {
                console.error('Error cambiando contraseña:', error)
                return { success: false, error: error.message }
            }

            // Actualizar metadata para marcar que ya no es primer login
            await supabase.auth.updateUser({
                data: { primer_login: false }
            })

            console.info('Contraseña cambiada exitosamente')
            return { success: true }
        } catch (error) {
            console.error('Error en cambio de contraseña', { error })
            return { success: false, error: ERROR_MESSAGES.SERVER_ERROR }
        }
    },

    /**
     * Validar fortaleza de contraseña
     */
    validatePasswordStrength(password: string): { valid: boolean; error?: string } {
        if (password.length < 8) {
            return { valid: false, error: ERROR_MESSAGES.PASSWORD_TOO_SHORT }
        }

        if (!/[A-Z]/.test(password)) {
            return { valid: false, error: ERROR_MESSAGES.PASSWORD_NEEDS_UPPERCASE }
        }

        if (!/[0-9]/.test(password)) {
            return { valid: false, error: ERROR_MESSAGES.PASSWORD_NEEDS_NUMBER }
        }

        return { valid: true }
    },

    /**
     * Cerrar sesión
     */
    async logout(): Promise<void> {
        await supabase.auth.signOut()
    },

    /**
     * Obtener sesión actual
     */
    async getSession() {
        const { data: { session } } = await supabase.auth.getSession()
        return session
    },

    /**
     * Obtener usuario actual
     */
    async getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser()
        return user
    },

    /**
     * Crear usuario (para administradores)
     * Nota: Requiere service_role key, mejor hacerlo via Edge Function
     */
    async createUser(
        email: string,
        password: string,
        metadata: { identificacion: string; rol: string }
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Esto solo funciona con service_role, no con anon key
            // En producción, usar una Edge Function
            const { error } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    ...metadata,
                    primer_login: true,
                }
            })

            if (error) {
                return { success: false, error: error.message }
            }

            return { success: true }
        } catch (error) {
            console.error('Error creando usuario', { error })
            return { success: false, error: ERROR_MESSAGES.SERVER_ERROR }
        }
    },
}

export default authService
