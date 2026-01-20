/**
 * Servicio de Soportes de Facturación
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Gestiona operaciones CRUD en la tabla public.soportes_facturacion
 * y subida de archivos al bucket soportes-facturacion.
 */

import { supabase } from '@/config/supabase.config'
import { ERROR_MESSAGES } from '@/config/constants'
import { ApiResponse } from '@/types'
import {
    SoporteFacturacion,
    SoporteFacturacionRaw,
    CrearSoporteFacturacionData,
    FiltrosSoportesFacturacion,
    CategoriaArchivo,
    CATEGORIAS_ARCHIVOS,
    EpsFacturacion,
} from '@/types/soportesFacturacion.types'

/**
 * Transformar respuesta de DB (snake_case) a camelCase
 */
function transformSoporte(raw: SoporteFacturacionRaw): SoporteFacturacion {
    return {
        id: raw.id,
        radicado: raw.radicado,
        fechaRadicacion: new Date(raw.fecha_radicacion),
        radicadorEmail: raw.radicador_email,
        radicadorNombre: raw.radicador_nombre,
        eps: raw.eps as SoporteFacturacion['eps'],
        regimen: raw.regimen as SoporteFacturacion['regimen'],
        servicioPrestado: raw.servicio_prestado as SoporteFacturacion['servicioPrestado'],
        fechaAtencion: new Date(raw.fecha_atencion),
        tipoId: raw.tipo_id,
        identificacion: raw.identificacion,
        nombresCompletos: raw.nombres_completos,
        bdId: raw.bd_id,
        estado: raw.estado as SoporteFacturacion['estado'],
        observacionesFacturacion: raw.observaciones_facturacion,
        urlsValidacionDerechos: raw.urls_validacion_derechos || [],
        urlsAutorizacion: raw.urls_autorizacion || [],
        urlsSoporteClinico: raw.urls_soporte_clinico || [],
        urlsComprobanteRecibo: raw.urls_comprobante_recibo || [],
        urlsOrdenMedica: raw.urls_orden_medica || [],
        urlsDescripcionQuirurgica: raw.urls_descripcion_quirurgica || [],
        urlsRegistroAnestesia: raw.urls_registro_anestesia || [],
        urlsHojaMedicamentos: raw.urls_hoja_medicamentos || [],
        urlsNotasEnfermeria: raw.urls_notas_enfermeria || [],
        onedriveFolderId: raw.onedrive_folder_id,
        onedriveFolderUrl: raw.onedrive_folder_url,
        onedriveSyncStatus: raw.onedrive_sync_status as SoporteFacturacion['onedriveSyncStatus'],
        onedriveSyncAt: raw.onedrive_sync_at ? new Date(raw.onedrive_sync_at) : null,
        createdAt: new Date(raw.created_at),
        updatedAt: new Date(raw.updated_at),
    }
}

/**
 * Mapear categoría a nombre de columna en DB
 */
function getCategoriaColumnName(categoria: CategoriaArchivo): string {
    const mapping: Record<CategoriaArchivo, string> = {
        'validacion_derechos': 'urls_validacion_derechos',
        'autorizacion': 'urls_autorizacion',
        'soporte_clinico': 'urls_soporte_clinico',
        'comprobante_recibo': 'urls_comprobante_recibo',
        'orden_medica': 'urls_orden_medica',
        'descripcion_quirurgica': 'urls_descripcion_quirurgica',
        'registro_anestesia': 'urls_registro_anestesia',
        'hoja_medicamentos': 'urls_hoja_medicamentos',
        'notas_enfermeria': 'urls_notas_enfermeria',
    }
    return mapping[categoria]
}

/**
 * Obtener prefijo de archivo según EPS y categoría
 */
function getPrefijoArchivo(eps: EpsFacturacion, categoria: CategoriaArchivo): string {
    const config = CATEGORIAS_ARCHIVOS.find(c => c.id === categoria)
    if (!config) return ''
    return config.prefijos[eps] || ''
}

export const soportesFacturacionService = {
    /**
     * Subir archivos al bucket de soportes-facturacion
     * @returns Array de URLs firmadas de los archivos subidos
     */
    async subirArchivos(
        archivos: File[],
        categoria: CategoriaArchivo,
        radicado: string,
        eps: EpsFacturacion
    ): Promise<string[]> {
        const urls: string[] = []
        const prefijo = getPrefijoArchivo(eps, categoria)

        for (let i = 0; i < archivos.length; i++) {
            const archivo = archivos[i]
            const extension = archivo.name.split('.').pop()?.toLowerCase() || 'pdf'
            const nombreArchivo = `${prefijo}${radicado}_${categoria}_${i + 1}.${extension}`
            const ruta = `${radicado}/${nombreArchivo}`

            const { error } = await supabase.storage
                .from('soportes-facturacion')
                .upload(ruta, archivo, {
                    cacheControl: '3600',
                    upsert: false,
                })

            if (error) {
                console.error(`Error subiendo archivo ${nombreArchivo}:`, error)
                throw new Error(`Error subiendo ${archivo.name}: ${error.message}`)
            }

            // Generar URL firmada (válida por 1 año)
            const { data: urlData } = await supabase.storage
                .from('soportes-facturacion')
                .createSignedUrl(ruta, 31536000) // 1 año

            if (urlData?.signedUrl) {
                urls.push(urlData.signedUrl)
            }
        }

        return urls
    },

    /**
     * Crear una nueva radicación de soportes de facturación
     */
    async crearRadicacion(data: CrearSoporteFacturacionData): Promise<ApiResponse<SoporteFacturacion>> {
        try {
            // Preparar datos para inserción
            const insertData: Record<string, unknown> = {
                radicador_email: data.radicadorEmail,
                radicador_nombre: data.radicadorNombre || null,
                eps: data.eps,
                regimen: data.regimen,
                servicio_prestado: data.servicioPrestado,
                fecha_atencion: data.fechaAtencion,
                tipo_id: data.tipoId || null,
                identificacion: data.identificacion || null,
                nombres_completos: data.nombresCompletos || null,
                observaciones_facturacion: data.observaciones || null,
            }

            // Insertar registro (el trigger genera el radicado)
            const { data: registro, error: insertError } = await supabase
                .from('soportes_facturacion')
                .insert(insertData)
                .select()
                .single()

            if (insertError) {
                console.error('Error insertando radicación:', insertError)
                return {
                    success: false,
                    error: 'Error al crear la radicación: ' + insertError.message,
                }
            }

            const radicado = (registro as SoporteFacturacionRaw).radicado

            // Subir archivos por categoría
            const urlsUpdate: Record<string, string[]> = {}

            for (const grupo of data.archivos) {
                if (grupo.files.length > 0) {
                    try {
                        const urls = await this.subirArchivos(
                            grupo.files,
                            grupo.categoria,
                            radicado,
                            data.eps
                        )
                        const columnName = getCategoriaColumnName(grupo.categoria)
                        urlsUpdate[columnName] = urls
                    } catch (uploadError) {
                        console.error(`Error subiendo archivos de ${grupo.categoria}:`, uploadError)
                        // Continuar con otras categorías
                    }
                }
            }

            // Actualizar registro con URLs de archivos
            if (Object.keys(urlsUpdate).length > 0) {
                const { error: updateError } = await supabase
                    .from('soportes_facturacion')
                    .update(urlsUpdate)
                    .eq('radicado', radicado)

                if (updateError) {
                    console.warn('Error actualizando URLs:', updateError)
                }
            }

            // Obtener registro actualizado
            const { data: registroFinal } = await supabase
                .from('soportes_facturacion')
                .select('*')
                .eq('radicado', radicado)
                .single()

            const soporteCreado = transformSoporte(registroFinal as SoporteFacturacionRaw)

            // Sincronizar automáticamente con OneDrive (no bloqueante)
            try {
                console.log(`🔄 Sincronizando ${radicado} con OneDrive...`)
                await this.sincronizarOneDrive(radicado)
                console.log(`✅ ${radicado} sincronizado con OneDrive`)
            } catch (oneDriveError) {
                console.warn(`⚠️ Error sincronizando ${radicado} con OneDrive:`, oneDriveError)
                // NO fallar la radicación si OneDrive falla
                // El usuario puede re-sincronizar manualmente después
            }

            return {
                success: true,
                data: soporteCreado,
                message: `Radicación ${radicado} creada exitosamente`,
            }
        } catch (error) {
            console.error('Error en crearRadicacion:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Obtener historial de radicaciones por documento del paciente
     */
    async obtenerHistorialPorIdentificacion(identificacion: string): Promise<ApiResponse<SoporteFacturacion[]>> {
        try {
            const { data, error } = await supabase
                .from('soportes_facturacion')
                .select('*')
                .eq('identificacion', identificacion)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error obteniendo historial:', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            const soportes = (data as SoporteFacturacionRaw[]).map(transformSoporte)

            return {
                success: true,
                data: soportes,
            }
        } catch (error) {
            console.error('Error en obtenerHistorialPorIdentificacion:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Obtener radicación por número de radicado
     */
    async obtenerPorRadicado(radicado: string): Promise<ApiResponse<SoporteFacturacion>> {
        try {
            const { data, error } = await supabase
                .from('soportes_facturacion')
                .select('*')
                .eq('radicado', radicado)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    return {
                        success: false,
                        error: `No se encontró el radicado ${radicado}`,
                    }
                }
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            return {
                success: true,
                data: transformSoporte(data as SoporteFacturacionRaw),
            }
        } catch (error) {
            console.error('Error en obtenerPorRadicado:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Obtener lista de radicaciones con filtros y paginación
     */
    async obtenerListaFiltrada(
        filtros: FiltrosSoportesFacturacion,
        offset = 0,
        limit = 50
    ): Promise<ApiResponse<{ soportes: SoporteFacturacion[]; total: number }>> {
        try {
            let query = supabase
                .from('soportes_facturacion')
                .select('*', { count: 'exact' })

            // Aplicar filtros
            if (filtros.estado && filtros.estado !== 'Todos') {
                query = query.eq('estado', filtros.estado)
            }

            if (filtros.eps) {
                query = query.eq('eps', filtros.eps)
            }

            if (filtros.fechaInicio) {
                query = query.gte('fecha_radicacion', filtros.fechaInicio)
            }

            if (filtros.fechaFin) {
                query = query.lte('fecha_radicacion', filtros.fechaFin + 'T23:59:59')
            }

            // Búsqueda por radicado o identificación
            if (filtros.busqueda && filtros.busqueda.trim()) {
                const termino = filtros.busqueda.trim()
                query = query.or(`radicado.ilike.%${termino}%,identificacion.ilike.%${termino}%,nombres_completos.ilike.%${termino}%`)
            }

            // Ordenamiento y paginación
            query = query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1)

            const { data, error, count } = await query

            if (error) {
                console.error('Error obteniendo lista filtrada:', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            const soportes = (data as SoporteFacturacionRaw[]).map(transformSoporte)

            return {
                success: true,
                data: { soportes, total: count || 0 },
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
     * Actualizar estado de una radicación
     */
    async actualizarEstado(
        radicado: string,
        estado: SoporteFacturacion['estado'],
        observaciones?: string
    ): Promise<ApiResponse<SoporteFacturacion>> {
        try {
            const updateData: Record<string, unknown> = { estado }
            if (observaciones !== undefined) {
                updateData.observaciones_facturacion = observaciones
            }

            const { data, error } = await supabase
                .from('soportes_facturacion')
                .update(updateData)
                .eq('radicado', radicado)
                .select()
                .single()

            if (error) {
                console.error('Error actualizando estado:', error)
                return {
                    success: false,
                    error: 'Error al actualizar el estado: ' + error.message,
                }
            }

            return {
                success: true,
                data: transformSoporte(data as SoporteFacturacionRaw),
                message: 'Estado actualizado exitosamente',
            }
        } catch (error) {
            console.error('Error en actualizarEstado:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Sincronizar archivos con OneDrive (llamar API serverless)
     */
    async sincronizarOneDrive(radicado: string): Promise<ApiResponse<{ folderUrl: string }>> {
        try {
            const response = await fetch('/api/upload-onedrive', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ radicado }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                return {
                    success: false,
                    error: errorData.error || 'Error sincronizando con OneDrive',
                }
            }

            const result = await response.json()

            // Actualizar estado de sincronización en BD
            await supabase
                .from('soportes_facturacion')
                .update({
                    onedrive_folder_id: result.folderId,
                    onedrive_folder_url: result.folderUrl,
                    onedrive_sync_status: 'synced',
                    onedrive_sync_at: new Date().toISOString(),
                })
                .eq('radicado', radicado)

            return {
                success: true,
                data: { folderUrl: result.folderUrl },
                message: 'Archivos sincronizados con OneDrive exitosamente',
            }
        } catch (error) {
            console.error('Error en sincronizarOneDrive:', error)
            return {
                success: false,
                error: 'Error de conexión con el servicio de OneDrive',
            }
        }
    },

    /**
     * Obtener conteos por estado para dashboard
     */
    async obtenerConteosPorEstado(): Promise<ApiResponse<Record<string, number>>> {
        try {
            const { data, error } = await supabase
                .from('soportes_facturacion')
                .select('estado')

            if (error) {
                console.error('Error obteniendo conteos:', error)
                return { success: false, error: ERROR_MESSAGES.SERVER_ERROR }
            }

            const conteos: Record<string, number> = {}
            for (const registro of data) {
                const estado = registro.estado || 'Sin estado'
                conteos[estado] = (conteos[estado] || 0) + 1
            }

            return { success: true, data: conteos }
        } catch (error) {
            console.error('Error en obtenerConteosPorEstado:', error)
            return { success: false, error: ERROR_MESSAGES.SERVER_ERROR }
        }
    },
}

export default soportesFacturacionService
