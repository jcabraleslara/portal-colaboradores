/**
 * Servicio para gestión de Anexo 8
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Recetario Oficial para Medicamentos de Control Especial (FNE)
 */

import { supabase } from '@/config/supabase.config'
import {
    Anexo8Record,
    Anexo8CreateData,
    Anexo8Filtros,
    MedicoData
} from '@/types/anexo8.types'
import { ApiResponse } from '@/types'

// Roles permitidos para usar este módulo
export const ROLES_PERMITIDOS_ANEXO8 = ['superadmin', 'administrador', 'asistencial', 'auditor', 'gerencia'] as const

/**
 * Servicio principal de Anexo 8
 */
export const anexo8Service = {
    /**
     * Verificar si un rol tiene acceso al módulo
     */
    tieneAcceso(rol: string): boolean {
        return ROLES_PERMITIDOS_ANEXO8.includes(rol as typeof ROLES_PERMITIDOS_ANEXO8[number])
    },

    /**
     * Obtener próximo número de recetario (para preview)
     */
    async obtenerProximoNumero(): Promise<ApiResponse<string>> {
        try {
            // Obtener el valor actual de la secuencia sin incrementar
            const { data, error } = await supabase
                .rpc('currval', { seq_name: 'anexo_8_numero_seq' })

            if (error) {
                // Si la secuencia nunca ha sido usada, retornar el valor inicial
                return { success: true, data: 'M-2227' }
            }

            const siguiente = (data || 2226) + 1
            return { success: true, data: `M-${siguiente}` }
        } catch {
            return { success: true, data: 'M-2227' }
        }
    },

    /**
     * Crear un nuevo registro de Anexo 8
     */
    async crearAnexo8(datos: Anexo8CreateData): Promise<ApiResponse<Anexo8Record>> {
        try {
            const { data, error } = await supabase
                .from('anexo_8')
                .insert({
                    ...datos,
                    // numero_recetario se genera automáticamente por el trigger
                    numero_recetario: '' // Será reemplazado por el trigger
                })
                .select()
                .single()

            if (error) {
                console.error('Error creando Anexo 8:', error)
                return { success: false, error: error.message }
            }

            return { success: true, data: data as Anexo8Record }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido'
            return { success: false, error: message }
        }
    },

    /**
     * Crear múltiples registros (para fórmulas posfechadas)
     */
    async crearAnexos8Multiples(
        datosBase: Anexo8CreateData,
        totalMeses: number
    ): Promise<ApiResponse<Anexo8Record[]>> {
        try {
            const registros: Anexo8Record[] = []
            let formulaPadreId: string | null = null

            // Parsear fecha inicial
            const fechaBase = new Date(datosBase.fecha_prescripcion)

            console.log('🔍 DEBUG Servicio: totalMeses=', totalMeses, 'tipo:', typeof totalMeses)

            for (let mes = 1; mes <= totalMeses; mes++) {
                console.log(`🔍 Iteración ${mes} de ${totalMeses}`)
                // Calcular fecha posfechada sumando 30 días por cada mes
                const fechaPosfechada = new Date(fechaBase)
                const diasASumar = (mes - 1) * 30
                fechaPosfechada.setDate(fechaPosfechada.getDate() + diasASumar)

                const datosRegistro: Anexo8CreateData = {
                    ...datosBase,
                    fecha_prescripcion: fechaPosfechada.toISOString().split('T')[0],
                    mes_posfechado: mes,
                    total_meses_formula: totalMeses,
                    formula_padre_id: formulaPadreId
                }

                const resultado = await this.crearAnexo8(datosRegistro)

                if (!resultado.success || !resultado.data) {
                    // Si falla alguno, retornar error
                    return {
                        success: false,
                        error: `Error al crear mes ${mes}: ${resultado.error}`
                    }
                }

                // El primer registro se convierte en el padre
                if (mes === 1) {
                    formulaPadreId = resultado.data.id
                }

                registros.push(resultado.data)
            }

            return { success: true, data: registros }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido'
            return { success: false, error: message }
        }
    },

    /**
     * Obtener historial de Anexos 8 con filtros
     */
    async obtenerHistorial(
        filtros?: Anexo8Filtros,
        limite = 50
    ): Promise<ApiResponse<Anexo8Record[]>> {
        try {
            let query = supabase
                .from('anexo_8')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limite)

            if (filtros?.pacienteDocumento) {
                query = query.eq('paciente_documento', filtros.pacienteDocumento)
            }

            if (filtros?.medicoId) {
                query = query.eq('medico_id', filtros.medicoId)
            }

            if (filtros?.medicamento) {
                query = query.eq('medicamento_nombre', filtros.medicamento)
            }

            if (filtros?.fechaDesde) {
                query = query.gte('fecha_prescripcion', filtros.fechaDesde)
            }

            if (filtros?.fechaHasta) {
                query = query.lte('fecha_prescripcion', filtros.fechaHasta)
            }

            const { data, error } = await query

            if (error) {
                console.error('Error obteniendo historial Anexo 8:', error)
                return { success: false, error: error.message }
            }

            return { success: true, data: data as Anexo8Record[] }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido'
            return { success: false, error: message }
        }
    },

    /**
     * Obtener historial paginado de Anexos 8
     */
    async obtenerHistorialPaginado(
        filtros?: Anexo8Filtros,
        offset = 0,
        limit = 20
    ): Promise<ApiResponse<{ soportes: Anexo8Record[], total: number }>> {
        try {
            // Consulta base
            let query = supabase
                .from('anexo_8')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1)

            // Aplicar filtros
            if (filtros?.pacienteDocumento) {
                query = query.ilike('paciente_documento', `%${filtros.pacienteDocumento}%`)
            }

            if (filtros?.medicoId) {
                query = query.eq('medico_id', filtros.medicoId)
            }

            if (filtros?.medicamento) {
                query = query.eq('medicamento_nombre', filtros.medicamento)
            }

            if (filtros?.fechaDesde) {
                query = query.gte('fecha_prescripcion', filtros.fechaDesde)
            }

            if (filtros?.fechaHasta) {
                query = query.lte('fecha_prescripcion', filtros.fechaHasta)
            }

            const { data, count, error } = await query

            if (error) {
                console.error('Error obteniendo historial paginado Anexo 8:', error)
                return { success: false, error: error.message }
            }

            return {
                success: true,
                data: {
                    soportes: (data as Anexo8Record[]) || [],
                    total: count || 0
                }
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido'
            return { success: false, error: message }
        }
    },

    /**
     * Obtener un Anexo 8 por ID
     */
    async obtenerPorId(id: string): Promise<ApiResponse<Anexo8Record>> {
        try {
            const { data, error } = await supabase
                .from('anexo_8')
                .select('*')
                .eq('id', id)
                .single()

            if (error) {
                return { success: false, error: error.message }
            }

            return { success: true, data: data as Anexo8Record }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido'
            return { success: false, error: message }
        }
    },

    /**
     * Actualizar URL del PDF después de subir
     */
    async actualizarPdfUrl(
        id: string,
        pdfUrl: string,
        pdfNombre: string
    ): Promise<ApiResponse<Anexo8Record>> {
        try {
            const { data, error } = await supabase
                .from('anexo_8')
                .update({
                    pdf_url: pdfUrl,
                    pdf_nombre: pdfNombre,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single()

            if (error) {
                console.error('Error actualizando PDF URL:', error)
                return { success: false, error: error.message }
            }

            return { success: true, data: data as Anexo8Record }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido'
            return { success: false, error: message }
        }
    },

    /**
     * Subir PDF al bucket anexo-8
     */
    async subirPdf(
        archivo: Blob | File,
        nombreArchivo: string
    ): Promise<ApiResponse<string>> {
        try {
            const { data, error } = await supabase.storage
                .from('anexo-8')
                .upload(nombreArchivo, archivo, {
                    contentType: 'application/pdf',
                    upsert: false
                })

            if (error) {
                console.error('Error subiendo PDF:', error)
                return { success: false, error: error.message }
            }

            // Obtener URL pública
            const { data: urlData } = supabase.storage
                .from('anexo-8')
                .getPublicUrl(data.path)

            return { success: true, data: urlData.publicUrl }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido'
            return { success: false, error: message }
        }
    },

    /**
     * Obtener datos del médico desde usuarios_portal + contactos
     */
    async obtenerDatosMedico(usuarioId: string): Promise<ApiResponse<MedicoData>> {
        try {
            // Primero obtener el usuario del portal
            const { data: usuario, error: errorUsuario } = await supabase
                .from('usuarios_portal')
                .select('id, identificacion, nombre_completo, contacto_id')
                .eq('id', usuarioId)
                .single()

            if (errorUsuario || !usuario) {
                return { success: false, error: 'Usuario no encontrado' }
            }

            // Si tiene contacto_id, obtener datos adicionales del contacto
            let contacto = null
            if (usuario.contacto_id) {
                const { data: contactoData } = await supabase
                    .from('contactos')
                    .select('puesto, ciudad, firma_url')
                    .eq('id', usuario.contacto_id)
                    .single()

                contacto = contactoData
            }

            const medicoData: MedicoData = {
                id: usuario.id,
                documento: usuario.identificacion,
                nombreCompleto: usuario.nombre_completo,
                especialidad: contacto?.puesto || null,
                ciudad: contacto?.ciudad || null,
                firmaUrl: contacto?.firma_url || null
            }

            return { success: true, data: medicoData }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido'
            return { success: false, error: message }
        }
    },

    /**
     * Obtener lista de médicos (usuarios con rol asistencial)
     */
    async obtenerMedicos(): Promise<ApiResponse<MedicoData[]>> {
        try {
            const { data: usuarios, error } = await supabase
                .from('usuarios_portal')
                .select('id, identificacion, nombre_completo, contacto_id')
                .eq('rol', 'asistencial')
                .eq('activo', true)
                .order('nombre_completo')

            if (error) {
                console.error('Error obteniendo médicos:', error)
                return { success: false, error: error.message }
            }

            // Obtener datos de contactos para los que tienen contacto_id
            const contactoIds = usuarios
                ?.filter(u => u.contacto_id)
                .map(u => u.contacto_id) || []

            let contactosMap = new Map<string, {
                puesto: string | null
                ciudad: string | null
                firma_url: string | null
            }>()

            if (contactoIds.length > 0) {
                const { data: contactos } = await supabase
                    .from('contactos')
                    .select('id, puesto, ciudad, firma_url')
                    .in('id', contactoIds)

                if (contactos) {
                    contactosMap = new Map(contactos.map(c => [c.id, c]))
                }
            }

            const medicos: MedicoData[] = (usuarios || []).map(u => {
                const contacto = u.contacto_id ? contactosMap.get(u.contacto_id) : null
                return {
                    id: u.id,
                    documento: u.identificacion,
                    nombreCompleto: u.nombre_completo,
                    especialidad: contacto?.puesto || null,
                    ciudad: contacto?.ciudad || null,
                    firmaUrl: contacto?.firma_url || null
                }
            })

            return { success: true, data: medicos }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido'
            return { success: false, error: message }
        }
    }
}

export default anexo8Service
