/**
 * Utilidad compartida para resolución DIVIPOLA
 * Convierte nombres de municipio/departamento a códigos DANE
 */

import { supabase } from '@/config/supabase.config'

/** Mapa: nombre_municipio (UPPER) → cod_municipio (5 dígitos) */
let municipioCache: Map<string, string> | null = null

/** Mapa: nombre_departamento (UPPER) → cod_departamento (2 dígitos) */
let departamentoCache: Map<string, string> | null = null

/**
 * Carga el mapa municipio → cod_municipio desde tabla divipola
 * Se cachea en memoria para reutilización dentro de la misma importación
 */
export async function cargarMunicipioMap(): Promise<Map<string, string>> {
    if (municipioCache) return municipioCache

    const { data, error } = await supabase
        .from('divipola')
        .select('nombre_municipio, cod_municipio')

    if (error) throw new Error(`Error cargando DIVIPOLA municipios: ${error.message}`)

    municipioCache = new Map<string, string>()
    for (const row of data || []) {
        if (row.nombre_municipio && row.cod_municipio) {
            municipioCache.set(row.nombre_municipio.toUpperCase().trim(), row.cod_municipio)
        }
    }

    return municipioCache
}

/**
 * Carga el mapa nombre_departamento → cod_departamento desde tabla divipola_dep
 */
export async function cargarDepartamentoMap(): Promise<Map<string, string>> {
    if (departamentoCache) return departamentoCache

    const { data, error } = await supabase
        .from('divipola_dep')
        .select('nombre_departamento, cod_departamento')

    if (error) throw new Error(`Error cargando DIVIPOLA departamentos: ${error.message}`)

    departamentoCache = new Map<string, string>()
    for (const row of data || []) {
        if (row.nombre_departamento && row.cod_departamento) {
            departamentoCache.set(row.nombre_departamento.toUpperCase().trim(), row.cod_departamento)
        }
    }

    return departamentoCache
}

/**
 * Resuelve código de departamento (2 dígitos) a partir del nombre de municipio
 * Búsqueda: exacta → parcial (includes) → default '23' (Córdoba)
 */
export function obtenerCodigoDepartamento(
    municipio: string,
    municipioMap: Map<string, string>
): string {
    if (!municipio) return '23'
    const upper = municipio.toUpperCase().trim()

    // Búsqueda exacta
    const codMunicipio = municipioMap.get(upper)
    if (codMunicipio) return codMunicipio.substring(0, 2)

    // Búsqueda parcial
    for (const [nombre, cod] of municipioMap) {
        if (nombre.includes(upper) || upper.includes(nombre)) {
            return cod.substring(0, 2)
        }
    }

    return '23' // Default: Córdoba
}

/**
 * Resuelve código de departamento desde nombre de departamento
 * Útil para archivos PGP que tienen columna DepartamentoRes
 */
export function obtenerCodigoDepartamentoPorNombre(
    departamento: string,
    departamentoMap: Map<string, string>
): string {
    if (!departamento) return '23'
    const upper = departamento.toUpperCase().trim()

    const cod = departamentoMap.get(upper)
    if (cod) return cod

    // Búsqueda parcial
    for (const [nombre, codDep] of departamentoMap) {
        if (nombre.includes(upper) || upper.includes(nombre)) {
            return codDep
        }
    }

    return '23'
}

/**
 * Limpia caches (útil entre importaciones)
 */
export function limpiarCacheDivipola(): void {
    municipioCache = null
    departamentoCache = null
}
