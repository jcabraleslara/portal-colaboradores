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
import { criticalErrorService } from './criticalError.service'

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

                // Notificar error crítico de Storage
                await criticalErrorService.reportStorageFailure(
                    'upload',
                    'Soportes de Facturación',
                    'soportes-facturacion',
                    error as Error
                )

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
            let onedriveFolderUrl: string | undefined
            try {
                console.log(`🔄 Sincronizando ${radicado} con OneDrive...`)
                const syncResult = await this.sincronizarOneDrive(radicado)
                if (syncResult.success && syncResult.data) {
                    onedriveFolderUrl = syncResult.data.folderUrl
                }
                console.log(`✅ ${radicado} sincronizado con OneDrive`)
            } catch (oneDriveError) {
                console.warn(`⚠️ Error sincronizando ${radicado} con OneDrive:`, oneDriveError)

                // Notificar error de integración con OneDrive
                await criticalErrorService.reportIntegrationError(
                    'OneDrive',
                    'Soportes de Facturación',
                    'Sincronización automática',
                    oneDriveError instanceof Error ? oneDriveError : undefined
                )

                // NO fallar la radicación si OneDrive falla
                // El usuario puede re-sincronizar manualmente después
            }

            // Enviar correo de confirmación de radicación
            try {
                const { emailService } = await import('./email.service')

                // Preparar datos para el correo
                const archivos = [
                    { categoria: 'Validación de Derechos', urls: soporteCreado.urlsValidacionDerechos },
                    { categoria: 'Autorización', urls: soporteCreado.urlsAutorizacion },
                    { categoria: 'Soporte Clínico', urls: soporteCreado.urlsSoporteClinico },
                    { categoria: 'Comprobante de Recibo', urls: soporteCreado.urlsComprobanteRecibo },
                    { categoria: 'Orden Médica', urls: soporteCreado.urlsOrdenMedica },
                    { categoria: 'Descripción Quirúrgica', urls: soporteCreado.urlsDescripcionQuirurgica },
                    { categoria: 'Registro de Anestesia', urls: soporteCreado.urlsRegistroAnestesia },
                    { categoria: 'Hoja de Medicamentos', urls: soporteCreado.urlsHojaMedicamentos },
                    { categoria: 'Notas de Enfermería', urls: soporteCreado.urlsNotasEnfermeria }
                ]

                const datosRadicacion = {
                    eps: soporteCreado.eps,
                    regimen: soporteCreado.regimen,
                    servicioPrestado: soporteCreado.servicioPrestado,
                    fechaAtencion: soporteCreado.fechaAtencion.toISOString().split('T')[0],
                    pacienteNombre: soporteCreado.nombresCompletos || 'No especificado',
                    pacienteIdentificacion: soporteCreado.identificacion || 'No especificado',
                    archivos,
                    onedriveFolderUrl
                }

                const emailEnviado = await emailService.enviarNotificacionRadicacionExitosa(
                    soporteCreado.radicadorEmail,
                    radicado,
                    datosRadicacion
                )

                if (emailEnviado) {
                    console.log(`📧 Correo de confirmación enviado a ${soporteCreado.radicadorEmail}`)
                } else {
                    console.warn('No se pudo enviar el correo de confirmación, pero la radicación se creó exitosamente')
                }
            } catch (emailError) {
                console.error('Error enviando correo de confirmación:', emailError)
                // No fallar la operación si el correo falla
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

            if (filtros.radicadorEmail) {
                query = query.eq('radicador_email', filtros.radicadorEmail)
            }

            if (filtros.servicioPrestado) {
                query = query.eq('servicio_prestado', filtros.servicioPrestado)
            }

            if (filtros.fechaInicio) {
                query = query.gte('fecha_radicacion', filtros.fechaInicio)
            }

            if (filtros.fechaFin) {
                query = query.lte('fecha_radicacion', filtros.fechaFin + 'T23:59:59')
            }

            // Filtro por fecha de atención
            if (filtros.fechaAtencionInicio) {
                query = query.gte('fecha_atencion', filtros.fechaAtencionInicio)
            }

            if (filtros.fechaAtencionFin) {
                query = query.lte('fecha_atencion', filtros.fechaAtencionFin + 'T23:59:59')
            }

            // Búsqueda por radicado o identificación
            if (filtros.busqueda && filtros.busqueda.trim()) {
                const termino = filtros.busqueda.trim()
                query = query.or(`radicado.ilike.%${termino}%,identificacion.ilike.%${termino}%,nombres_completos.ilike.%${termino}%`)
            }

            // Ordenamiento
            if (filtros.sortBy) {
                const sortMapping: Record<string, string> = {
                    'fechaRadicacion': 'fecha_radicacion',
                    'fechaAtencion': 'fecha_atencion',
                    'radicado': 'radicado',
                    'estado': 'estado',
                    'servicioPrestado': 'servicio_prestado',
                    'eps': 'eps',
                    'radicadorEmail': 'radicador_email'
                }
                const column = sortMapping[filtros.sortBy] || 'created_at'
                const ascending = filtros.sortOrder === 'asc'
                query = query.order(column, { ascending })
            } else {
                query = query.order('created_at', { ascending: false })
            }

            // Paginación
            query = query
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
            // Validar que si el estado es "Rechazado", las observaciones no estén vacías
            if (estado === 'Rechazado' && (!observaciones || !observaciones.trim())) {
                return {
                    success: false,
                    error: 'Debe ingresar observaciones de facturación para rechazar el radicado',
                }
            }

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

            const soporteActualizado = transformSoporte(data as SoporteFacturacionRaw)

            // Si el estado es "Rechazado", enviar correo de notificación
            if (estado === 'Rechazado' && soporteActualizado.radicadorEmail) {
                try {
                    // Importar dinámicamente el servicio de email
                    const { emailService } = await import('./email.service')

                    // Preparar datos para el correo
                    const archivos = [
                        { categoria: 'Validación de Derechos', urls: soporteActualizado.urlsValidacionDerechos },
                        { categoria: 'Autorización', urls: soporteActualizado.urlsAutorizacion },
                        { categoria: 'Soporte Clínico', urls: soporteActualizado.urlsSoporteClinico },
                        { categoria: 'Comprobante de Recibo', urls: soporteActualizado.urlsComprobanteRecibo },
                        { categoria: 'Orden Médica', urls: soporteActualizado.urlsOrdenMedica },
                        { categoria: 'Descripción Quirúrgica', urls: soporteActualizado.urlsDescripcionQuirurgica },
                        { categoria: 'Registro de Anestesia', urls: soporteActualizado.urlsRegistroAnestesia },
                        { categoria: 'Hoja de Medicamentos', urls: soporteActualizado.urlsHojaMedicamentos },
                        { categoria: 'Notas de Enfermería', urls: soporteActualizado.urlsNotasEnfermeria }
                    ]

                    const datosRadicacion = {
                        eps: soporteActualizado.eps,
                        regimen: soporteActualizado.regimen,
                        servicioPrestado: soporteActualizado.servicioPrestado,
                        fechaAtencion: soporteActualizado.fechaAtencion.toISOString().split('T')[0],
                        pacienteNombre: soporteActualizado.nombresCompletos || 'No especificado',
                        pacienteIdentificacion: soporteActualizado.identificacion || 'No especificado',
                        pacienteTipoId: soporteActualizado.tipoId || 'No especificado',
                        archivos,
                        fechaRadicacion: soporteActualizado.fechaRadicacion.toISOString()
                    }

                    const emailEnviado = await emailService.enviarNotificacionRechazo(
                        soporteActualizado.radicadorEmail,
                        radicado,
                        observaciones || '',
                        datosRadicacion
                    )

                    if (!emailEnviado) {
                        console.warn('No se pudo enviar el correo de rechazo, pero el estado se actualizó correctamente')
                    }
                } catch (emailError) {
                    console.error('Error enviando correo de rechazo:', emailError)
                    // No fallar la operación si el correo falla
                }
            }

            return {
                success: true,
                data: soporteActualizado,
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

    /**
     * Renombrar archivo en Supabase Storage y actualizar URL en base de datos
     */
    async renombrarArchivo(
        radicado: string,
        categoria: CategoriaArchivo,
        rutaActual: string,
        nuevoNombre: string
    ): Promise<ApiResponse<{ nuevaUrl: string }>> {
        try {
            // Validar que el nuevo nombre tenga extensión .pdf
            if (!nuevoNombre.toLowerCase().endsWith('.pdf')) {
                nuevoNombre += '.pdf'
            }

            // Construir nueva ruta
            const nuevaRuta = `${radicado}/${nuevoNombre}`

            // Mover (renombrar) archivo en Storage
            const { error: moveError } = await supabase.storage
                .from('soportes-facturacion')
                .move(rutaActual, nuevaRuta)

            if (moveError) {
                console.error('Error renombrando archivo en Storage:', moveError)
                return {
                    success: false,
                    error: `Error al renombrar archivo: ${moveError.message}`,
                }
            }

            // Generar nueva URL firmada (válida por 1 año)
            const { data: urlData, error: urlError } = await supabase.storage
                .from('soportes-facturacion')
                .createSignedUrl(nuevaRuta, 31536000) // 1 año

            if (urlError || !urlData?.signedUrl) {
                // Intentar revertir el cambio
                await supabase.storage
                    .from('soportes-facturacion')
                    .move(nuevaRuta, rutaActual)

                return {
                    success: false,
                    error: 'Error generando URL firmada para el archivo renombrado',
                }
            }

            const nuevaUrl = urlData.signedUrl

            // Actualizar URL en base de datos
            const columnName = getCategoriaColumnName(categoria)

            // Obtener registro actual
            const { data: registro, error: fetchError } = await supabase
                .from('soportes_facturacion')
                .select(columnName)
                .eq('radicado', radicado)
                .single()

            if (fetchError || !registro) {
                // Revertir cambio en Storage
                await supabase.storage
                    .from('soportes-facturacion')
                    .move(nuevaRuta, rutaActual)

                return {
                    success: false,
                    error: 'Error obteniendo registro de la base de datos',
                }
            }

            // Actualizar array de URLs reemplazando la antigua por la nueva
            const urlsActuales = ((registro as unknown as Record<string, unknown>)[columnName] || []) as string[]
            const urlsActualizadas = urlsActuales.map(url => {
                // Buscar si esta URL corresponde al archivo renombrado
                // Comparamos por la ruta dentro de la URL
                if (url.includes(encodeURIComponent(rutaActual.split('/').pop() || ''))) {
                    return nuevaUrl
                }
                return url
            })

            // Actualizar en base de datos
            const { error: updateError } = await supabase
                .from('soportes_facturacion')
                .update({ [columnName]: urlsActualizadas })
                .eq('radicado', radicado)

            if (updateError) {
                console.error('Error actualizando URLs en BD:', updateError)
                // Intentar revertir cambio en Storage
                await supabase.storage
                    .from('soportes-facturacion')
                    .move(nuevaRuta, rutaActual)

                return {
                    success: false,
                    error: 'Error actualizando URLs en base de datos',
                }
            }

            return {
                success: true,
                data: { nuevaUrl },
                message: 'Archivo renombrado exitosamente',
            }
        } catch (error) {
            console.error('Error en renombrarArchivo:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },
    /**
     * Eliminar una radicación (Solo admin/superadmin)
     */
    /**
     * Eliminar una radicación (Solo admin/superadmin)
     * Elimina:
     * 1. Carpeta en OneDrive (si existe)
     * 2. Archivos en Supabase Storage
     * 3. Registro en base de datos
     */
    async eliminarRadicado(radicado: string): Promise<ApiResponse<null>> {
        try {
            console.log(`🗑️ Iniciando proceso de eliminación para ${radicado}...`)

            // 1. Obtener información del radicado para saber ID de OneDrive y confirmar existencia
            const { data: registro, error: fetchError } = await supabase
                .from('soportes_facturacion')
                .select('*')
                .eq('radicado', radicado)
                .single()

            if (fetchError || !registro) {
                console.error('Error buscando radicado para eliminar:', fetchError)
                return { success: false, error: 'No se encontró el radicado o no tiene permisos' }
            }

            const folderId = (registro as any).onedrive_folder_id

            // 2. Eliminar de OneDrive (Serverless Function)
            if (folderId) {
                try {
                    console.log(`☁️ Eliminando carpeta de OneDrive (${folderId})...`)
                    await fetch('/api/delete-onedrive', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folderId, radicado }),
                    })
                } catch (odError) {
                    console.warn('⚠️ Error eliminando de OneDrive (no bloqueante):', odError)
                }
            }

            // 3. Eliminar archivos de Supabase Storage
            try {
                console.log(`📦 Eliminando archivos de Storage para ${radicado}...`)
                // Listar archivos en la carpeta del radicado
                const { data: files } = await supabase.storage
                    .from('soportes-facturacion')
                    .list(radicado)

                if (files && files.length > 0) {
                    const filesToRemove = files.map(f => `${radicado}/${f.name}`)
                    const { error: storageError } = await supabase.storage
                        .from('soportes-facturacion')
                        .remove(filesToRemove)

                    if (storageError) {
                        console.warn('⚠️ Error eliminando archivos de Storage:', storageError)
                    }
                }
            } catch (storageEx) {
                console.warn('⚠️ Excepción eliminando stored files:', storageEx)
            }

            // 4. Eliminar registro de Base de Datos
            console.log(`🗄️ Eliminando registro DB: ${radicado}...`)
            const { data: deletedRows, error: dbError } = await supabase
                .from('soportes_facturacion')
                .delete()
                .eq('radicado', radicado)
                .select()

            if (dbError) {
                console.error('Error eliminando de BD:', dbError)
                return {
                    success: false,
                    error: 'Error al eliminar el registro en base de datos: ' + dbError.message,
                }
            }

            // Validar que realmente se haya eliminado algo (RLS puede mostrar éxito con 0 borrados)
            if (!deletedRows || deletedRows.length === 0) {
                console.error('La operación de eliminación retornó 0 filas. Posible falta de permisos o registro inexistente.')
                return {
                    success: false,
                    error: 'No se pudo eliminar el registro. Verifique sus permisos de administrador o si el radicado ya fue eliminado.',
                }
            }

            return {
                success: true,
                message: 'Radicado y archivos eliminados exitosamente',
            }
        } catch (error: any) {
            console.error('Error crítico en eliminarRadicado:', error)
            return {
                success: false,
                error: error.message || ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },
}


export default soportesFacturacionService
