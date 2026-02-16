/**
 * Servicio de CIE-10
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * Búsqueda de diagnósticos en tabla public.cie10
 */

import { supabase } from '@/config/supabase.config'
import type { ApiResponse } from '@/types'

export interface Cie10 {
    cie10: string
    cie10_descripcion: string
    st_dias_incapacidad?: number | null
    neps_dias_incapacidad?: number | null
}

interface Cie10Result {
    success: boolean
    data?: Cie10[]
    error?: string
}

/**
 * Buscar diagnósticos CIE-10 por código o descripción (búsqueda ligera para autocomplete)
 * Usa índice trigram para búsqueda eficiente
 */
export async function buscarCie10(texto: string, limite = 15): Promise<Cie10Result> {
    try {
        if (texto.length < 2) {
            return { success: true, data: [] }
        }

        const textoUpper = texto.toUpperCase()
        const textoLower = texto.toLowerCase()

        // Buscar por código exacto primero, luego por descripción con ilike
        const { data, error } = await supabase
            .from('cie10')
            .select('cie10, cie10_descripcion, st_dias_incapacidad, neps_dias_incapacidad')
            .or(`cie10.ilike.${textoUpper}%,cie10_descripcion.ilike.%${textoLower}%`)
            .order('cie10')
            .limit(limite)

        if (error) {
            console.error('Error buscando CIE-10:', error)
            return { success: false, error: error.message }
        }

        return { success: true, data: data as Cie10[] }
    } catch (err) {
        console.error('Error en buscarCie10:', err)
        return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' }
    }
}

/**
 * Obtener un diagnóstico CIE-10 específico por código
 */
export async function obtenerCie10(codigo: string): Promise<{ success: boolean; data?: Cie10; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('cie10')
            .select('cie10, cie10_descripcion, st_dias_incapacidad, neps_dias_incapacidad')
            .eq('cie10', codigo.toUpperCase())
            .single()

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, data: data as Cie10 }
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' }
    }
}

/**
 * Búsqueda avanzada de CIE-10 con soporte de tokens (misma lógica que CUPS)
 * Para el módulo Consultar Tablas
 */
export async function buscarCie10Avanzado(query: string): Promise<ApiResponse<Cie10[]>> {
    try {
        const trimmedQuery = query.trim()

        if (!trimmedQuery) {
            return { success: true, data: [] }
        }

        const tokens = trimmedQuery.toLowerCase().split(/\s+/).filter(Boolean)

        let supabaseQuery = supabase
            .from('cie10')
            .select('*')

        // Si parece código CIE-10 (letra seguida de dígitos, ej: A00, M54, J11)
        if (/^[a-zA-Z]\d/i.test(trimmedQuery)) {
            supabaseQuery = supabaseQuery.ilike('cie10', `${trimmedQuery.toUpperCase()}%`)
        } else {
            // Búsqueda por descripción con tokens (todas las palabras deben coincidir)
            for (const token of tokens) {
                supabaseQuery = supabaseQuery.ilike('cie10_descripcion', `%${token}%`)
            }
        }

        const { data, error } = await supabaseQuery
            .order('cie10', { ascending: true })
            .limit(100)

        if (error) {
            console.error('Error buscando CIE-10:', error)
            return { success: false, error: 'Error al buscar diagnósticos CIE-10' }
        }

        return { success: true, data: data as Cie10[] }
    } catch (error) {
        console.error('Error inesperado buscando CIE-10:', error)
        return { success: false, error: 'Error inesperado al buscar CIE-10' }
    }
}

export const cie10Service = {
    buscarCie10,
    buscarCie10Avanzado,
    obtenerCie10
}

export default cie10Service
