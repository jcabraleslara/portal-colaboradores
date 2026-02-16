/**
 * Servicio para consulta de Medicamentos (tabla MAPIISS)
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { supabase } from '@/config/supabase.config'
import type { ApiResponse } from '@/types'

export interface Medicamento {
    mapiiss: string
    map_descripcion: string | null
    capitulo: string | null
}

/**
 * Servicio de Medicamentos
 */
export const medicamentosService = {
    /**
     * Buscar medicamentos por código MAPIISS o descripción
     * Soporta búsqueda de palabras en cualquier orden
     */
    async buscar(query: string): Promise<ApiResponse<Medicamento[]>> {
        try {
            const trimmedQuery = query.trim()

            if (!trimmedQuery) {
                return { success: true, data: [] }
            }

            const tokens = trimmedQuery.toLowerCase().split(/\s+/).filter(Boolean)

            let supabaseQuery = supabase
                .from('medicamentos')
                .select('*')

            // Si empieza con MD o es numérico puro, buscar por código
            if (/^(md)?\d+$/i.test(trimmedQuery)) {
                supabaseQuery = supabaseQuery.ilike('mapiiss', `%${trimmedQuery}%`)
            } else {
                // Búsqueda por descripción con tokens (todas las palabras deben coincidir)
                for (const token of tokens) {
                    supabaseQuery = supabaseQuery.ilike('map_descripcion', `%${token}%`)
                }
            }

            const { data, error } = await supabaseQuery
                .order('mapiiss', { ascending: true })
                .limit(100)

            if (error) {
                console.error('Error buscando medicamentos:', error)
                return { success: false, error: 'Error al buscar medicamentos' }
            }

            return { success: true, data: data as Medicamento[] }
        } catch (error) {
            console.error('Error inesperado buscando medicamentos:', error)
            return { success: false, error: 'Error inesperado al buscar medicamentos' }
        }
    },
}

export default medicamentosService
