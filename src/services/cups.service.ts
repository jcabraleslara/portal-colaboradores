/**
 * Servicio para consulta y gestión de CUPS
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { supabase } from '@/config/supabase.config'
import type { ApiResponse, Cups } from '@/types'

// Opciones disponibles para el campo Pertinencia
export const PERTINENCIA_OPTIONS = [
    'Médico General',
    'Médico Especialista',
] as const

export type PertinenciaOption = typeof PERTINENCIA_OPTIONS[number]

/**
 * Servicio de CUPS
 */
export const cupsService = {
    /**
     * Buscar CUPS por código o descripción
     * Soporta búsqueda de palabras en cualquier orden
     */
    async buscar(query: string): Promise<ApiResponse<Cups[]>> {
        try {
            const trimmedQuery = query.trim()

            if (!trimmedQuery) {
                return { success: true, data: [] }
            }

            // Tokenizar la búsqueda para búsqueda flexible
            const tokens = trimmedQuery.toLowerCase().split(/\s+/).filter(Boolean)

            // Construir query base
            let supabaseQuery = supabase
                .from('cups')
                .select('*')

            // Si es un código numérico, buscar por código exacto o parcial
            if (/^\d+$/.test(trimmedQuery)) {
                supabaseQuery = supabaseQuery.ilike('cups', `%${trimmedQuery}%`)
            } else {
                // Búsqueda por descripción con tokens (todas las palabras deben coincidir)
                for (const token of tokens) {
                    supabaseQuery = supabaseQuery.ilike('descripcion', `%${token}%`)
                }
            }

            const { data, error } = await supabaseQuery
                .order('cups', { ascending: true })
                .limit(100)

            if (error) {
                console.error('Error buscando CUPS:', error)
                return { success: false, error: 'Error al buscar CUPS' }
            }

            return { success: true, data: data as Cups[] }
        } catch (error) {
            console.error('Error inesperado buscando CUPS:', error)
            return { success: false, error: 'Error inesperado al buscar CUPS' }
        }
    },

    /**
     * Obtener un CUPS específico por código
     */
    async obtenerPorCodigo(codigo: string): Promise<ApiResponse<Cups>> {
        try {
            const { data, error } = await supabase
                .from('cups')
                .select('*')
                .eq('cups', codigo)
                .single()

            if (error) {
                console.error('Error obteniendo CUPS:', error)
                return { success: false, error: 'CUPS no encontrado' }
            }

            return { success: true, data: data as Cups }
        } catch (error) {
            console.error('Error inesperado obteniendo CUPS:', error)
            return { success: false, error: 'Error inesperado' }
        }
    },

    /**
     * Actualizar un CUPS (solo superadmin)
     */
    async actualizar(codigo: string, datos: Partial<Cups>): Promise<ApiResponse<Cups>> {
        try {
            // Remover el código del objeto de actualización
            const { cups: _, ...datosActualizar } = datos

            const { data, error } = await supabase
                .from('cups')
                .update(datosActualizar)
                .eq('cups', codigo)
                .select()
                .single()

            if (error) {
                console.error('Error actualizando CUPS:', error)
                return { success: false, error: 'Error al actualizar CUPS' }
            }

            return { success: true, data: data as Cups }
        } catch (error) {
            console.error('Error inesperado actualizando CUPS:', error)
            return { success: false, error: 'Error inesperado' }
        }
    },
}

export default cupsService
