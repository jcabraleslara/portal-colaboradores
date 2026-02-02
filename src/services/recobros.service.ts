/**
 * Servicio de Recobros
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * Gestiona operaciones CRUD en la tabla public.recobros
 * y subida de archivos al bucket soportes-recobros.
 */

import { supabase } from '@/config/supabase.config'
import { ERROR_MESSAGES } from '@/config/constants'
import { ApiResponse } from '@/types'
import {
    Recobro,
    RecobroRaw,
    CrearRecobroData,
    FiltrosRecobros,
    ActualizarRecobroData,
    EstadoRecobro,
} from '@/types/recobros.types'

/**
 * Transformar respuesta de DB (snake_case) a camelCase
 */
function transformRecobro(raw: RecobroRaw): Recobro {
    return {
        id: raw.id,
        consecutivo: raw.consecutivo,
        pacienteId: raw.paciente_id,
        pacienteTipoId: raw.paciente_tipo_id,
        pacienteNombres: raw.paciente_nombres,
        cupsData: raw.cups_data || [],
        justificacion: raw.justificacion,
        soportesUrls: raw.soportes_urls || [],
        estado: raw.estado,
        respuestaAuditor: raw.respuesta_auditor,
        radicadorEmail: raw.radicador_email,
        radicadorNombre: raw.radicador_nombre,
        pdfAprobacionUrl: raw.pdf_aprobacion_url,
        createdAt: new Date(raw.created_at),
        updatedAt: new Date(raw.updated_at),
    }
}

export const recobrosService = {
    /**
     * Generar consecutivo TRIAN-XXXX usando la secuencia de BD
     */
    async generarConsecutivo(): Promise<string> {
        const { data, error } = await supabase.rpc('nextval', { seq_name: 'recobros_consecutivo_seq' })

        if (error) {
            console.error('Error generando consecutivo:', error)
            // Fallback con timestamp si falla
            const timestamp = Date.now().toString().slice(-4)
            return `TRIAN-${timestamp}`
        }

        return `TRIAN-${data}`
    },

    /**
     * Subir soportes al bucket soportes-recobros
     * @returns Array de URLs firmadas
     */
    async subirSoportes(archivos: File[], consecutivo: string): Promise<string[]> {
        const urls: string[] = []

        for (let i = 0; i < archivos.length; i++) {
            const archivo = archivos[i]
            const extension = archivo.name.split('.').pop()?.toLowerCase() || 'pdf'
            const nombreArchivo = `${consecutivo}_soporte_${i + 1}.${extension}`
            const ruta = `${consecutivo}/${nombreArchivo}`

            const { error } = await supabase.storage
                .from('soportes-recobros')
                .upload(ruta, archivo, {
                    cacheControl: '3600',
                    upsert: true,
                })

            if (error) {
                console.error(`Error subiendo archivo ${nombreArchivo}:`, error)
                throw new Error(`Error subiendo ${archivo.name}: ${error.message}`)
            }

            // Generar URL firmada (válida por 1 año)
            const { data: urlData } = await supabase.storage
                .from('soportes-recobros')
                .createSignedUrl(ruta, 31536000)

            if (urlData?.signedUrl) {
                urls.push(urlData.signedUrl)
            }
        }

        return urls
    },

    /**
     * Crear un nuevo recobro
     */
    async crearRecobro(data: CrearRecobroData): Promise<ApiResponse<Recobro>> {
        try {
            // 1. Generar consecutivo
            const consecutivo = await this.generarConsecutivo()

            // 2. Subir soportes
            let soportesUrls: string[] = []
            if (data.soportes.length > 0) {
                soportesUrls = await this.subirSoportes(data.soportes, consecutivo)
            }

            // 3. Insertar registro
            const insertData = {
                consecutivo,
                paciente_id: data.pacienteId,
                paciente_tipo_id: data.pacienteTipoId || null,
                paciente_nombres: data.pacienteNombres || null,
                cups_data: data.cupsData,
                justificacion: data.justificacion || null,
                soportes_urls: soportesUrls,
                estado: 'Pendiente' as EstadoRecobro,
                radicador_email: data.radicadorEmail,
                radicador_nombre: data.radicadorNombre || null,
            }

            const { data: registro, error: insertError } = await supabase
                .from('recobros')
                .insert(insertData)
                .select()
                .single()

            if (insertError) {
                console.error('Error insertando recobro:', insertError)
                return {
                    success: false,
                    error: 'Error al crear el recobro: ' + insertError.message,
                }
            }

            const recobroCreado = transformRecobro(registro as RecobroRaw)

            return {
                success: true,
                data: recobroCreado,
                message: `Recobro ${consecutivo} creado exitosamente`,
            }
        } catch (error) {
            console.error('Error en crearRecobro:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Obtener lista de recobros con filtros y paginación
     */
    async obtenerListaFiltrada(
        filtros: FiltrosRecobros,
        offset = 0,
        limit = 10
    ): Promise<ApiResponse<{ recobros: Recobro[]; total: number }>> {
        try {
            let query = supabase
                .from('recobros')
                .select('*', { count: 'exact' })

            // Aplicar filtros
            if (filtros.estado && filtros.estado !== 'Todos') {
                query = query.eq('estado', filtros.estado)
            }

            if (filtros.radicadorEmail) {
                query = query.eq('radicador_email', filtros.radicadorEmail)
            }

            if (filtros.fechaInicio) {
                query = query.gte('created_at', filtros.fechaInicio)
            }

            if (filtros.fechaFin) {
                query = query.lte('created_at', filtros.fechaFin + 'T23:59:59')
            }

            // Búsqueda por consecutivo, nombre o identificación
            if (filtros.busqueda && filtros.busqueda.trim()) {
                const termino = filtros.busqueda.trim()
                query = query.or(`consecutivo.ilike.%${termino}%,paciente_id.ilike.%${termino}%,paciente_nombres.ilike.%${termino}%`)
            }

            // Ordenamiento
            if (filtros.sortBy) {
                const sortMapping: Record<string, string> = {
                    'consecutivo': 'consecutivo',
                    'createdAt': 'created_at',
                    'estado': 'estado',
                    'pacienteNombres': 'paciente_nombres',
                }
                const column = sortMapping[filtros.sortBy] || 'created_at'
                const ascending = filtros.sortOrder === 'asc'
                query = query.order(column, { ascending })
            } else {
                query = query.order('created_at', { ascending: false })
            }

            // Paginación
            query = query.range(offset, offset + limit - 1)

            const { data, error, count } = await query

            if (error) {
                console.error('Error obteniendo lista filtrada:', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            const recobros = (data as RecobroRaw[]).map(transformRecobro)

            return {
                success: true,
                data: { recobros, total: count || 0 },
            }
        } catch (error) {
            console.error('Error en obtenerListaFiltrada:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Obtener conteos por estado para dashboard
     */
    async obtenerConteosPorEstado(): Promise<ApiResponse<Record<string, number>>> {
        try {
            const estados: EstadoRecobro[] = ['Pendiente', 'En gestión', 'Aprobado', 'Devuelto']

            const promises = estados.map(estado =>
                supabase
                    .from('recobros')
                    .select('*', { count: 'exact', head: true })
                    .eq('estado', estado)
            )

            const results = await Promise.all(promises)

            const conteos: Record<string, number> = {
                'Pendiente': 0,
                'En gestión': 0,
                'Aprobado': 0,
                'Devuelto': 0,
            }

            results.forEach((result, index) => {
                const estado = estados[index]
                if (result.error) {
                    console.error(`Error contando estado ${estado}:`, result.error)
                }
                conteos[estado] = result.count || 0
            })

            return { success: true, data: conteos }
        } catch (error) {
            console.error('Error en obtenerConteosPorEstado:', error)
            return { success: false, error: ERROR_MESSAGES.SERVER_ERROR }
        }
    },

    /**
     * Obtener recobro por ID
     */
    async obtenerPorId(id: string): Promise<ApiResponse<Recobro>> {
        try {
            const { data, error } = await supabase
                .from('recobros')
                .select('*')
                .eq('id', id)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    return {
                        success: false,
                        error: 'Recobro no encontrado',
                    }
                }
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            return {
                success: true,
                data: transformRecobro(data as RecobroRaw),
            }
        } catch (error) {
            console.error('Error en obtenerPorId:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Obtener recobro por consecutivo
     */
    async obtenerPorConsecutivo(consecutivo: string): Promise<ApiResponse<Recobro>> {
        try {
            const { data, error } = await supabase
                .from('recobros')
                .select('*')
                .eq('consecutivo', consecutivo)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    return {
                        success: false,
                        error: `No se encontró el recobro ${consecutivo}`,
                    }
                }
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            return {
                success: true,
                data: transformRecobro(data as RecobroRaw),
            }
        } catch (error) {
            console.error('Error en obtenerPorConsecutivo:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Obtener historial de recobros por paciente
     */
    async obtenerHistorialPaciente(pacienteId: string): Promise<ApiResponse<Recobro[]>> {
        try {
            const { data, error } = await supabase
                .from('recobros')
                .select('*')
                .eq('paciente_id', pacienteId)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error obteniendo historial:', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            const recobros = (data as RecobroRaw[]).map(transformRecobro)

            return {
                success: true,
                data: recobros,
            }
        } catch (error) {
            console.error('Error en obtenerHistorialPaciente:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Actualizar un recobro (estado, respuesta, PDF)
     */
    async actualizarRecobro(
        id: string,
        datos: ActualizarRecobroData
    ): Promise<ApiResponse<Recobro>> {
        try {
            // Validar que si el estado es "Devuelto", la respuesta no esté vacía
            if (datos.estado === 'Devuelto' && (!datos.respuestaAuditor || !datos.respuestaAuditor.trim())) {
                return {
                    success: false,
                    error: 'Debe ingresar una respuesta/justificación para devolver el recobro',
                }
            }

            const updateData: Record<string, unknown> = {}

            if (datos.estado) {
                updateData.estado = datos.estado
            }
            if (datos.respuestaAuditor !== undefined) {
                updateData.respuesta_auditor = datos.respuestaAuditor
            }
            if (datos.pdfAprobacionUrl) {
                updateData.pdf_aprobacion_url = datos.pdfAprobacionUrl
            }

            const { data, error } = await supabase
                .from('recobros')
                .update(updateData)
                .eq('id', id)
                .select()
                .single()

            if (error) {
                console.error('Error actualizando recobro:', error)
                return {
                    success: false,
                    error: 'Error al actualizar el recobro: ' + error.message,
                }
            }

            const recobroActualizado = transformRecobro(data as RecobroRaw)

            // Si el estado es "Devuelto", enviar correo de notificación
            if (datos.estado === 'Devuelto' && recobroActualizado.radicadorEmail) {
                try {
                    const { emailService } = await import('./email.service')

                    await emailService.enviarNotificacionDevolucionRecobro(
                        recobroActualizado.radicadorEmail,
                        recobroActualizado.consecutivo,
                        datos.respuestaAuditor || '',
                        {
                            pacienteNombre: recobroActualizado.pacienteNombres || 'No especificado',
                            pacienteId: recobroActualizado.pacienteId,
                            cupsData: recobroActualizado.cupsData,
                        }
                    )
                } catch (emailError) {
                    console.error('Error enviando correo de devolución:', emailError)
                    // No fallar la operación si el correo falla
                }
            }

            return {
                success: true,
                data: recobroActualizado,
                message: 'Recobro actualizado exitosamente',
            }
        } catch (error) {
            console.error('Error en actualizarRecobro:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Eliminar un recobro (solo superadmin)
     * Elimina archivos de Storage y registro de BD
     */
    async eliminarRecobro(id: string): Promise<ApiResponse<null>> {
        try {
            // 1. Obtener datos del recobro
            const { data: registro, error: fetchError } = await supabase
                .from('recobros')
                .select('*')
                .eq('id', id)
                .single()

            if (fetchError || !registro) {
                return {
                    success: false,
                    error: 'Recobro no encontrado',
                }
            }

            const consecutivo = (registro as RecobroRaw).consecutivo

            // 2. Eliminar archivos de Storage
            try {
                const { data: files } = await supabase.storage
                    .from('soportes-recobros')
                    .list(consecutivo)

                if (files && files.length > 0) {
                    const filesToRemove = files.map(f => `${consecutivo}/${f.name}`)
                    await supabase.storage
                        .from('soportes-recobros')
                        .remove(filesToRemove)
                }
            } catch (storageError) {
                console.warn('Error eliminando archivos de Storage:', storageError)
            }

            // 3. Eliminar registro de BD
            const { data: deletedRows, error: dbError } = await supabase
                .from('recobros')
                .delete()
                .eq('id', id)
                .select()

            if (dbError) {
                console.error('Error eliminando de BD:', dbError)
                return {
                    success: false,
                    error: 'Error al eliminar el recobro: ' + dbError.message,
                }
            }

            if (!deletedRows || deletedRows.length === 0) {
                return {
                    success: false,
                    error: 'No se pudo eliminar el recobro. Verifique sus permisos.',
                }
            }

            return {
                success: true,
                message: `Recobro ${consecutivo} eliminado exitosamente`,
            }
        } catch (error) {
            console.error('Error en eliminarRecobro:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Subir PDF de aprobación generado
     */
    async subirPdfAprobacion(consecutivo: string, pdfBlob: Blob): Promise<string | null> {
        try {
            const nombreArchivo = `${consecutivo}_aprobacion.pdf`
            const ruta = `${consecutivo}/${nombreArchivo}`

            const { error } = await supabase.storage
                .from('soportes-recobros')
                .upload(ruta, pdfBlob, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: 'application/pdf',
                })

            if (error) {
                console.error('Error subiendo PDF de aprobación:', error)
                return null
            }

            // Generar URL firmada
            const { data: urlData } = await supabase.storage
                .from('soportes-recobros')
                .createSignedUrl(ruta, 31536000)

            return urlData?.signedUrl || null
        } catch (error) {
            console.error('Error en subirPdfAprobacion:', error)
            return null
        }
    },
}

export default recobrosService
