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
    /**
     * Obtener usuarios con paginación y filtros
     */
    async getAll(
        page: number = 1,
        pageSize: number = 10,
        filters?: {
            search?: string
            rol?: string
            activo?: string
        }
    ): Promise<{ data: UsuarioPortal[] | null; count: number | null; error: string | null }> {
        try {
            let query = supabase
                .from('usuarios_portal')
                .select('*', { count: 'exact' })

            // Filtros
            if (filters?.search) {
                const term = filters.search.toLowerCase()
                query = query.or(`nombre_completo.ilike.%${term}%,identificacion.ilike.%${term}%,email_institucional.ilike.%${term}%`)
            }

            if (filters?.rol && filters.rol !== 'all') {
                query = query.eq('rol', filters.rol)
            }

            if (filters?.activo && filters.activo !== 'all') {
                const isActive = filters.activo === 'active'
                query = query.eq('activo', isActive)
            }

            // Paginación
            const from = (page - 1) * pageSize
            const to = from + pageSize - 1

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(from, to)

            if (error) {
                console.error('Error obteniendo usuarios:', error)
                return { data: null, count: 0, error: error.message }
            }

            return { data, count, error: null }
        } catch (err: any) {
            return { data: null, count: 0, error: err.message }
        }
    },

    /**
     * Obtener todos los usuarios para exportar (sin paginación)
     */
    async getAllForExport(
        filters?: {
            search?: string
            rol?: string
            activo?: string
        }
    ): Promise<{ data: UsuarioPortal[] | null; error: string | null }> {
        try {
            let query = supabase
                .from('usuarios_portal')
                .select('*')

            // Filtros
            if (filters?.search) {
                const term = filters.search.toLowerCase()
                query = query.or(`nombre_completo.ilike.%${term}%,identificacion.ilike.%${term}%,email_institucional.ilike.%${term}%`)
            }

            if (filters?.rol && filters.rol !== 'all') {
                query = query.eq('rol', filters.rol)
            }

            if (filters?.activo && filters.activo !== 'all') {
                const isActive = filters.activo === 'active'
                query = query.eq('activo', isActive)
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error obteniendo usuarios para exportar:', error)
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
    },

    /**
     * Obtener estadísticas de roles
     */
    async getRoleStats(): Promise<{ stats: Record<string, number>; total: number; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('usuarios_portal')
                .select('rol')

            if (error) {
                return { stats: {}, total: 0, error: error.message }
            }

            const stats: Record<string, number> = {}
            let total = 0

            data?.forEach((user) => {
                const rol = user.rol || 'unknown'
                stats[rol] = (stats[rol] || 0) + 1
                total++
            })

            return { stats, total, error: null }
        } catch (err: any) {
            return { stats: {}, total: 0, error: err.message }
        }
    }
}

export default usuariosPortalService
