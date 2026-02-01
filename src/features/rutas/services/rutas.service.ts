/**
 * Servicio de Gestión de Rutas
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { supabase } from '@/config/supabase.config'
import { ERROR_MESSAGES } from '@/config/constants'
import { ApiResponse } from '@/types'
import {
    BackRadicacionRaw,
    BackRadicacionExtendido,
    BackRadicacion
} from '@/types/back.types'

/**
 * Transformar respuesta de DB (snake_case) a camelCase
 */
function transformRadicacion(raw: BackRadicacionRaw): BackRadicacion {
    return {
        radicado: raw.radicado,
        radicador: raw.radicador,
        emailRadicador: raw.correo_radicador || null,
        cargoRadicador: null,
        id: raw.id,
        especialidad: raw.especialidad,
        ordenador: raw.ordenador,
        observaciones: raw.observaciones,
        tipoSolicitud: raw.tipo_solicitud as any, // Cast simple
        ruta: raw.ruta as any,
        soportes: raw.soportes,
        estadoRadicado: raw.estado_radicado as any,
        direccionamiento: raw.direccionamiento as any,
        respuestaBack: raw.respuesta_back,
        createdAt: new Date(raw.created_at),
        updatedAt: new Date(raw.updated_at),
    }
}

export interface RutaEmailConfig {
    id: string
    ruta: string
    eps: string
    destinatarios: string
    copias?: string | null
    provincia?: string[] | null
    estado: boolean
    created_at?: string
    updated_at?: string
}

// Lista de EPS disponibles en el sistema
export const EPS_DISPONIBLES = ['TODAS', 'NUEVA EPS', 'SALUD TOTAL', 'FAMILIAR DE COLOMBIA'] as const
export type EpsDisponible = typeof EPS_DISPONIBLES[number]

export const rutasService = {
    /**
     * Obtener casos de RUTAS (tipo_solicitud = 'Activación de Ruta')
     */
    async obtenerRutasFiltradas(
        filtros: {
            estadoRadicado?: string
            ruta?: string
            busqueda?: string
            fechaInicio?: string
            fechaFin?: string
            sortField?: string
            sortOrder?: 'asc' | 'desc'
        },
        offset = 0,
        limit = 50
    ): Promise<ApiResponse<{ casos: BackRadicacionExtendido[]; total: number }>> {
        try {
            let query = supabase
                .from('back')
                .select('*', { count: 'exact' })
                .eq('tipo_solicitud', 'Activación de Ruta') // FILTRO BASE OBLIGATORIO

            // Filtros opcionales
            if (filtros.estadoRadicado && filtros.estadoRadicado !== 'Todos') {
                query = query.eq('estado_radicado', filtros.estadoRadicado)
            }

            if (filtros.ruta) {
                query = query.eq('ruta', filtros.ruta)
            }

            if (filtros.fechaInicio) {
                query = query.gte('created_at', filtros.fechaInicio)
            }

            if (filtros.fechaFin) {
                query = query.lte('created_at', filtros.fechaFin + 'T23:59:59')
            }

            if (filtros.busqueda && filtros.busqueda.trim()) {
                const termino = filtros.busqueda.trim()
                query = query.or(`radicado.ilike.%${termino}%,id.ilike.%${termino}%`)
            }

            // Ordenamiento
            if (filtros.sortField && filtros.sortOrder) {
                query = query.order(filtros.sortField, { ascending: filtros.sortOrder === 'asc' })
            } else {
                query = query
                    .order('estado_radicado', { ascending: false, nullsFirst: false })
                    .order('created_at', { ascending: false })
            }

            query = query.range(offset, offset + limit - 1)

            const { data, error, count } = await query

            if (error) {
                console.error('Error obteniendo rutas:', error)
                return { success: false, error: ERROR_MESSAGES.SERVER_ERROR }
            }

            const rawData = data as BackRadicacionRaw[]
            if (rawData.length === 0) {
                return { success: true, data: { casos: [], total: 0 } }
            }

            // Enriquecer datos (Pacientes) - Copiado de back.service logic
            const idsUnicos = [...new Set(rawData.map(r => r.id))]
            const { data: pacientes } = await supabase
                .from('afiliados')
                .select('id, nombres, apellido1, apellido2, tipo_id, municipio, direccion, ips_primaria, email, eps, telefono')
                .in('id', idsUnicos)

            const pacientesMap = new Map((pacientes || []).map((p: any) => [p.id, p]))

            const casos: BackRadicacionExtendido[] = rawData.map(raw => {
                const pacienteRaw = pacientesMap.get(raw.id)
                const base = transformRadicacion(raw)
                return {
                    ...base,
                    nombreRadicador: base.radicador,
                    paciente: pacienteRaw ? {
                        nombres: pacienteRaw.nombres,
                        apellido1: pacienteRaw.apellido1,
                        apellido2: pacienteRaw.apellido2,
                        tipoId: pacienteRaw.tipo_id,
                        telefono: pacienteRaw.telefono,
                        municipio: pacienteRaw.municipio,
                        direccion: pacienteRaw.direccion,
                        ipsPrimaria: pacienteRaw.ips_primaria,
                        email: pacienteRaw.email,
                        eps: pacienteRaw.eps,
                    } : null
                }
            })

            return { success: true, data: { casos, total: count || 0 } }
        } catch (error) {
            console.error('Error en obtenerRutasFiltradas:', error)
            return { success: false, error: ERROR_MESSAGES.SERVER_ERROR }
        }
    },

    /**
     * Obtener conteos dinámicos.
     * - porEstado: Conteo global de todos los casos de rutas (independiente del filtro actual).
     * - porRuta: Conteo filtrado por el estado seleccionado (para que coincida con lo que ve el usuario).
     */
    /**
     * Obtener datos base para estadísticas (Optimización: Una sola llamada a red)
     * Retorna solo las columnas necesarias para calcular conteos en cliente.
     */
    async obtenerDatosEstadisticosBase(): Promise<ApiResponse<Pick<BackRadicacionRaw, 'estado_radicado' | 'ruta'>[]>> {
        try {
            const { data, error } = await supabase
                .from('back')
                .select('estado_radicado, ruta')
                .eq('tipo_solicitud', 'Activación de Ruta')

            if (error) throw error
            return { success: true, data: data || [] }
        } catch (error) {
            console.error('Error fetching stats base:', error)
            return { success: false, error: 'Error cargando datos base de estadísticas' }
        }
    },

    /**
     * Calcular conteos de forma síncrona en memoria (Zero Latency)
     * @param rawData Datos crudos obtenidos de obtenerDatosEstadisticosBase
     * @param estadoFiltro Filtro de estado actual aplicar a las rutas
     */
    calcularConteosLocales(
        rawData: Pick<BackRadicacionRaw, 'estado_radicado' | 'ruta'>[],
        estadoFiltro?: string
    ): { porEstado: Record<string, number>, porRuta: Record<string, number> } {
        const porEstado: Record<string, number> = {}
        const porRuta: Record<string, number> = {}

        rawData.forEach(row => {
            // 1. Conteo Global por Estado
            if (row.estado_radicado) {
                porEstado[row.estado_radicado] = (porEstado[row.estado_radicado] || 0) + 1
            }

            // 2. Conteo Dinámico por Ruta (basado en filtro)
            if (row.ruta) {
                const cumpleFiltro = !estadoFiltro || estadoFiltro === 'Todos' || row.estado_radicado === estadoFiltro
                if (cumpleFiltro) {
                    porRuta[row.ruta] = (porRuta[row.ruta] || 0) + 1
                }
            }
        })

        return { porEstado, porRuta }
    },

    /**
     * Wrapper legado o para usos simples directos
     */
    async obtenerConteos(estadoFiltro?: string): Promise<ApiResponse<{ porEstado: Record<string, number>, porRuta: Record<string, number> }>> {
        const result = await this.obtenerDatosEstadisticosBase()
        if (!result.success || !result.data) return { success: false, error: result.error, data: { porEstado: {}, porRuta: {} } }

        return {
            success: true,
            data: this.calcularConteosLocales(result.data, estadoFiltro)
        }
    },

    // ==========================================
    // CONFIGURACIÓN DE EMAILS
    // ==========================================

    async obtenerConfigEmails(): Promise<ApiResponse<RutaEmailConfig[]>> {
        const { data, error } = await supabase
            .from('config_rutas_emails')
            .select('*')
            .order('ruta')
            .order('eps')

        if (error) return { success: false, error: error.message }
        return { success: true, data }
    },

    async guardarConfigEmail(config: Partial<RutaEmailConfig>): Promise<ApiResponse<RutaEmailConfig>> {
        if (config.id) {
            // Update
            const { data, error } = await supabase
                .from('config_rutas_emails')
                .update({
                    ruta: config.ruta,
                    eps: config.eps || 'TODAS',
                    destinatarios: config.destinatarios,
                    copias: config.copias || null,
                    provincia: config.provincia || null,
                    estado: config.estado
                })
                .eq('id', config.id)
                .select()
                .single()

            if (error) return { success: false, error: error.message }
            return { success: true, data }
        } else {
            // Insert
            const { data, error } = await supabase
                .from('config_rutas_emails')
                .insert({
                    ruta: config.ruta,
                    eps: config.eps || 'TODAS',
                    destinatarios: config.destinatarios,
                    copias: config.copias || null,
                    provincia: config.provincia || null,
                    estado: config.estado ?? true
                })
                .select()
                .single()

            if (error) return { success: false, error: error.message }
            return { success: true, data }
        }
    },

    async eliminarConfigEmail(id: string): Promise<ApiResponse<boolean>> {
        const { error } = await supabase
            .from('config_rutas_emails')
            .delete()
            .eq('id', id)

        if (error) return { success: false, error: error.message }
        return { success: true, data: true }
    },

    /**
     * Obtener lista de Provincias disponibles
     */
    async obtenerProvincias(): Promise<ApiResponse<string[]>> {
        const { data, error } = await supabase
            .from('red')
            .select('provincia')
            .order('provincia', { ascending: true })

        if (error) return { success: false, error: error.message, data: [] }

        // Filtrar únicos y no nulos
        const provincias = [...new Set((data || [])
            .map((item: any) => item.provincia)
            .filter(Boolean))]

        return { success: true, data: provincias }
    }
}
