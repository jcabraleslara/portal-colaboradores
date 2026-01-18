/**
 * Servicio para gestión de usuarios del portal
 * Solo accesible para superadmin
 */

import { supabase } from '@/config/supabase.config'

// Tipos
export interface UsuarioPortal {
    id: string
    contacto_id: string | null
    identificacion: string
    email_institucional: string
    nombre_completo: string
    rol: 'operativo' | 'admin' | 'superadmin' | 'gerencia' | 'auditor' | 'asistencial' | 'externo'
    activo: boolean
    last_sign_in_at: string | null
    created_at: string
    updated_at: string
    created_by: string | null
}

export interface CreateUserData {
    identificacion: string
    nombre_completo: string
    email_institucional: string
    rol: 'operativo' | 'admin' | 'superadmin' | 'gerencia' | 'auditor' | 'asistencial' | 'externo'
    password: string
    contacto_id?: string | null
}

export interface UpdateUserData {
    rol?: 'operativo' | 'admin' | 'superadmin' | 'gerencia' | 'auditor' | 'asistencial' | 'externo'
    activo?: boolean
    nombre_completo?: string
}

// Servicio
export const usuariosPortalService = {
    /**
     * Obtener todos los usuarios del portal
     */
    async getAll(): Promise<{ data: UsuarioPortal[] | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('usuarios_portal')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error obteniendo usuarios:', error)
                return { data: null, error: error.message }
            }

            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    },

    /**
     * Obtener un usuario por ID
     */
    async getById(id: string): Promise<{ data: UsuarioPortal | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('usuarios_portal')
                .select('*')
                .eq('id', id)
                .single()

            if (error) {
                return { data: null, error: error.message }
            }

            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    },

    /**
     * Crear nuevo usuario (requiere Edge Function o service_role)
     * Por ahora solo crea en usuarios_portal, el usuario de auth debe crearse por script
     */
    async create(userData: CreateUserData): Promise<{ data: UsuarioPortal | null; error: string | null }> {
        try {
            // Verificar que no exista
            const { data: existing } = await supabase
                .from('usuarios_portal')
                .select('id')
                .or(`identificacion.eq.${userData.identificacion},email_institucional.eq.${userData.email_institucional}`)
                .single()

            if (existing) {
                return { data: null, error: 'Ya existe un usuario con esa identificación o email' }
            }

            // Crear en usuarios_portal (el usuario de auth debe crearse por script)
            const { data, error } = await supabase
                .from('usuarios_portal')
                .insert({
                    identificacion: userData.identificacion,
                    nombre_completo: userData.nombre_completo,
                    email_institucional: userData.email_institucional,
                    rol: userData.rol,
                    contacto_id: userData.contacto_id || null,
                    activo: true
                })
                .select()
                .single()

            if (error) {
                console.error('Error creando usuario:', error)
                return { data: null, error: error.message }
            }

            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    },

    /**
     * Actualizar usuario
     */
    async update(id: string, updates: UpdateUserData): Promise<{ data: UsuarioPortal | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('usuarios_portal')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single()

            if (error) {
                console.error('Error actualizando usuario:', error)
                return { data: null, error: error.message }
            }

            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    },

    /**
     * Activar/Desactivar usuario
     */
    async toggleActive(id: string, activo: boolean): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase
                .from('usuarios_portal')
                .update({ activo, updated_at: new Date().toISOString() })
                .eq('id', id)

            if (error) {
                return { success: false, error: error.message }
            }

            return { success: true, error: null }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    },

    /**
     * Cambiar rol de usuario
     */
    async changeRole(id: string, rol: 'operativo' | 'admin' | 'superadmin' | 'gerencia' | 'auditor' | 'asistencial' | 'externo'): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase
                .from('usuarios_portal')
                .update({ rol, updated_at: new Date().toISOString() })
                .eq('id', id)

            if (error) {
                return { success: false, error: error.message }
            }

            return { success: true, error: null }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    },

    /**
     * Eliminar usuario (solo de usuarios_portal, no de auth)
     */
    async delete(id: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase
                .from('usuarios_portal')
                .delete()
                .eq('id', id)

            if (error) {
                return { success: false, error: error.message }
            }

            return { success: true, error: null }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    }
}

export default usuariosPortalService
