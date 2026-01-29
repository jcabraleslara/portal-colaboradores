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
     * Obtener conteos rápidos para las cards
     */
    async obtenerConteos(): Promise<ApiResponse<{ porEstado: Record<string, number>, porRuta: Record<string, number> }>> {
        try {
            // No hay RPC específico para Rutas, hacemos query manual
            // Podríamos optimizar con RPC futuro si es lento
            const { data, error } = await supabase
                .from('back')
                .select('estado_radicado, ruta')
                .eq('tipo_solicitud', 'Activación de Ruta')
                .eq('estado_radicado', 'Pendiente') // Solo conteos de pendientes nos interesan para alertas? O todos?
            // Generalmente los tableros muestran pendientes. Si quieres totales, quita el filtro.
            // Asumiremos pendientes para las cards de "Atención requerida"

            if (error) throw error

            const porEstado: Record<string, number> = {}
            const porRuta: Record<string, number> = {}

            data?.forEach(row => {
                if (row.estado_radicado) {
                    porEstado[row.estado_radicado] = (porEstado[row.estado_radicado] || 0) + 1
                }
                if (row.ruta) {
                    porRuta[row.ruta] = (porRuta[row.ruta] || 0) + 1
                }
            })

            return { success: true, data: { porEstado, porRuta } }
        } catch (error) {
            console.error('Error conteos rutas:', error)
            return { success: false, error: 'Error cargando estadísticas' }
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
    }
}
