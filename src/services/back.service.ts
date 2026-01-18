/**
 * Servicio de Radicaciones (Back Office)
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Gestiona operaciones CRUD en la tabla public.back
 * y subida de archivos al bucket soportes-back.
 */

import { supabase } from '@/config/supabase.config'
import { ERROR_MESSAGES } from '@/config/constants'
import { ApiResponse } from '@/types'
import {
    BackRadicacion,
    BackRadicacionRaw,
    CrearRadicacionData,
    CrearAfiliadoData,
    BackRadicacionExtendido,
    FiltrosCasosBack,

    ConteosCasosBack,
} from '@/types/back.types'
import { ragService } from './rag.service'
import { smsService } from './sms.service'

/**
 * Normalizar texto a mayúsculas sin tildes
 */
function normalizarTexto(texto: string): string {
    return texto
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

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
        tipoSolicitud: raw.tipo_solicitud as BackRadicacion['tipoSolicitud'],
        soportes: raw.soportes,
        estadoRadicado: raw.estado_radicado as BackRadicacion['estadoRadicado'],
        direccionamiento: raw.direccionamiento as BackRadicacion['direccionamiento'],
        respuestaBack: raw.respuesta_back,
        createdAt: new Date(raw.created_at),
        updatedAt: new Date(raw.updated_at),
    }
}

export const backService = {
    /**
     * Subir archivos PDF al bucket de soportes
     * @returns Array de URLs públicas de los archivos subidos
     */
    async subirSoportes(archivos: File[], radicado: string): Promise<string[]> {
        const urls: string[] = []

        for (let i = 0; i < archivos.length; i++) {
            const archivo = archivos[i]
            const extension = archivo.name.split('.').pop()?.toLowerCase() || 'pdf'
            const nombreArchivo = `${radicado}_soporte_${i + 1}.${extension}`
            const ruta = `${radicado}/${nombreArchivo}`

            const { error } = await supabase.storage
                .from('soportes-back')
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
                .from('soportes-back')
                .createSignedUrl(ruta, 31536000) // 1 año en segundos

            if (urlData?.signedUrl) {
                urls.push(urlData.signedUrl)
            }
        }

        return urls
    },

    /**
     * Crear una nueva radicación
     */
    async crearRadicacion(data: CrearRadicacionData): Promise<ApiResponse<BackRadicacion>> {
        try {
            // Primero insertar el registro (el trigger genera el radicado)
            const { data: insertData, error: insertError } = await supabase
                .from('back')
                .insert({
                    radicador: normalizarTexto(data.radicador),
                    id: data.id,
                    tipo_solicitud: data.tipoSolicitud,
                    especialidad: data.especialidad || null,
                    ordenador: data.ordenador ? normalizarTexto(data.ordenador) : null,
                    observaciones: data.observaciones || null,
                    soportes: [], // Se actualiza después de subir archivos
                })
                .select()
                .single()

            if (insertError) {
                console.error('Error insertando radicación:', insertError)
                return {
                    success: false,
                    error: 'Error al crear la radicación: ' + insertError.message,
                }
            }

            const radicado = (insertData as BackRadicacionRaw).radicado

            // Si hay archivos, subirlos y actualizar el registro
            if (data.archivos && data.archivos.length > 0) {
                try {
                    const urls = await this.subirSoportes(data.archivos, radicado)

                    // Actualizar el registro con las URLs
                    const { error: updateError } = await supabase
                        .from('back')
                        .update({ soportes: urls })
                        .eq('radicado', radicado)

                    if (updateError) {
                        console.warn('Error actualizando soportes:', updateError)
                    }

                    // Actualizar el objeto local
                    (insertData as any).soportes = urls

                    // Vectorizar PDFs automáticamente (solo si son PDFs)
                    // Se ejecuta en background para no bloquear la respuesta
                    for (const url of urls) {
                        if (url.toLowerCase().includes('.pdf')) {
                            ragService.vectorizarPdf(radicado, url)
                                .then(result => {
                                    if (result.success) {
                                        console.log(`[RAG] Vectorización automática completada: ${radicado}`)
                                    }
                                })
                                .catch(err => console.error('[RAG] Error vectorización:', err))
                        }
                    }

                } catch (uploadError) {
                    console.error('Error subiendo soportes:', uploadError)
                    // No fallar la radicación por error de upload
                }
            }

            return {
                success: true,
                data: transformRadicacion(insertData as BackRadicacionRaw),
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
    async obtenerHistorialPorId(documentoId: string): Promise<ApiResponse<BackRadicacion[]>> {
        try {
            const { data, error } = await supabase
                .from('back')
                .select('*')
                .eq('id', documentoId)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error obteniendo historial:', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            const radicaciones = (data as BackRadicacionRaw[]).map(transformRadicacion)

            return {
                success: true,
                data: radicaciones,
            }
        } catch (error) {
            console.error('Error en obtenerHistorialPorId:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Obtener una radicación por su número
     */
    async obtenerPorRadicado(radicado: string): Promise<ApiResponse<BackRadicacion>> {
        try {
            const { data, error } = await supabase
                .from('back')
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
                data: transformRadicacion(data as BackRadicacionRaw),
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
     * Crear un nuevo afiliado en la tabla bd
     * (para cuando no existe en el sistema)
     */
    async crearAfiliado(data: CrearAfiliadoData): Promise<ApiResponse<{ id: string }>> {
        try {
            const { error } = await supabase
                .from('bd')
                .insert({
                    tipo_id: normalizarTexto(data.tipoId),
                    id: data.id,
                    nombres: normalizarTexto(data.nombres),
                    apellido1: normalizarTexto(data.apellido1),
                    apellido2: data.apellido2 ? normalizarTexto(data.apellido2) : null,
                    sexo: data.sexo || null,
                    direccion: data.direccion ? normalizarTexto(data.direccion) : null,
                    telefono: data.telefono || null,
                    fecha_nacimiento: data.fechaNacimiento || null,
                    municipio: data.municipio || null,
                    departamento: data.departamento || null,
                    regimen: data.regimen || null,
                    ips_primaria: data.ipsPrimaria || null,
                    tipo_cotizante: data.tipoCotizante || null,
                    eps: data.eps || null,
                    fuente: 'PORTAL_COLABORADORES',
                    estado: 'ACTIVO',
                })

            if (error) {
                // Verificar si es duplicado
                if (error.code === '23505') {
                    return {
                        success: false,
                        error: 'Este afiliado ya existe en el sistema',
                    }
                }
                console.error('Error creando afiliado:', error)
                return {
                    success: false,
                    error: 'Error al crear el afiliado: ' + error.message,
                }
            }

            return {
                success: true,
                data: { id: data.id },
                message: 'Afiliado creado exitosamente',
            }
        } catch (error) {
            console.error('Error en crearAfiliado:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    // ========================================
    // MÉTODOS PARA GESTIÓN BACK Y AUDITORÍA
    // ========================================

    /**
     * Obtener casos filtrados con paginación (optimizado para grandes volúmenes)
     * Incluye datos del paciente mediante join con tabla bd
     */
    async obtenerCasosFiltrados(
        filtros: FiltrosCasosBack,
        offset = 0,
        limit = 50
    ): Promise<ApiResponse<{ casos: BackRadicacionExtendido[]; total: number }>> {
        try {
            // Query base SIN join (el join falla si no hay FK definida)
            let query = supabase
                .from('back')
                .select('*', { count: 'exact' })

            // Aplicar filtros
            if (filtros.estadoRadicado && filtros.estadoRadicado !== 'Todos') {
                query = query.eq('estado_radicado', filtros.estadoRadicado)
            }

            if (filtros.tipoSolicitud) {
                query = query.eq('tipo_solicitud', filtros.tipoSolicitud)
            }

            if (filtros.especialidad) {
                query = query.eq('especialidad', filtros.especialidad)
            }

            if (filtros.fechaInicio) {
                query = query.gte('created_at', filtros.fechaInicio)
            }

            if (filtros.fechaFin) {
                query = query.lte('created_at', filtros.fechaFin + 'T23:59:59')
            }

            // Búsqueda por radicado o id del paciente
            if (filtros.busqueda && filtros.busqueda.trim()) {
                const termino = filtros.busqueda.trim()
                query = query.or(`radicado.ilike.%${termino}%,id.ilike.%${termino}%`)
            }

            // Ordenamiento: pendientes primero (DESC por alfabeto P->G->D->C->A), luego por fecha descendente
            query = query
                .order('estado_radicado', { ascending: false, nullsFirst: false })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1)

            const { data, error, count } = await query

            if (error) {
                console.error('Error obteniendo casos filtrados:', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            // Obtener IDs únicos de pacientes para cargar sus datos
            const idsUnicos = [...new Set((data as BackRadicacionRaw[]).map(r => r.id))]

            // Cargar datos de pacientes desde la vista afiliados (ya cruzada)
            // UPDATE: Eliminado teléfono de la consulta
            // Cargar datos de pacientes desde la vista afiliados (ya cruzada)
            // UPDATE: Eliminado teléfono de la consulta
            const { data: pacientesData } = await supabase
                .from('afiliados')
                .select('id, nombres, apellido1, apellido2, tipo_id, municipio, direccion, ips_primaria, email, eps')
                .in('id', idsUnicos)

            // Obtener correos de radicadores para buscar sus cargos
            const emailsRadicadores = [...new Set((data as BackRadicacionRaw[]).map(r => r.correo_radicador).filter(Boolean) as string[])]

            let cargosMap = new Map<string, string>()

            if (emailsRadicadores.length > 0) {
                const { data: contactosData } = await supabase
                    .from('contactos')
                    .select('email_personal, puesto')
                    .in('email_personal', emailsRadicadores)

                if (contactosData) {
                    cargosMap = new Map(contactosData.map(c => [c.email_personal, c.puesto]))
                }
            }

            // Crear mapa de pacientes
            const pacientesMap = new Map(
                (pacientesData || []).map(p => [p.id, p])
            )

            // Transformar datos
            const casos: BackRadicacionExtendido[] = (data as BackRadicacionRaw[]).map(raw => {
                const pacienteRaw = pacientesMap.get(raw.id)
                const base = transformRadicacion(raw)
                // Asignar cargo del radicador si existe
                if (raw.correo_radicador) {
                    base.cargoRadicador = cargosMap.get(raw.correo_radicador) || null
                }

                return {
                    ...base,
                    paciente: pacienteRaw ? {
                        nombres: pacienteRaw.nombres,
                        apellido1: pacienteRaw.apellido1,
                        apellido2: pacienteRaw.apellido2,
                        tipoId: pacienteRaw.tipo_id,
                        telefono: null, // No cargado
                        municipio: pacienteRaw.municipio,
                        direccion: pacienteRaw.direccion,
                        ipsPrimaria: pacienteRaw.ips_primaria,
                        email: pacienteRaw.email,
                        eps: pacienteRaw.eps,
                    } : null,
                }
            })

            return {
                success: true,
                data: { casos, total: count || 0 },
            }
        } catch (error) {
            console.error('Error en obtenerCasosFiltrados:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Obtener conteos de casos pendientes agrupados por tipo y especialidad
     * Usado para las cards de estadísticas
     */
    async obtenerConteosPendientes(): Promise<ApiResponse<ConteosCasosBack>> {
        try {
            // Obtener todos los casos pendientes con sus tipos y especialidades
            const { data, error } = await supabase
                .from('back')
                .select('tipo_solicitud, especialidad')
                .or('estado_radicado.eq.Pendiente,estado_radicado.is.null')

            if (error) {
                console.error('Error obteniendo conteos:', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            // Agrupar por tipo de solicitud
            const conteoPorTipo: Record<string, number> = {}
            const conteoPorEspecialidad: Record<string, number> = {}

            for (const caso of data) {
                // Conteo por tipo
                const tipo = caso.tipo_solicitud || 'Sin clasificar'
                conteoPorTipo[tipo] = (conteoPorTipo[tipo] || 0) + 1

                // Conteo por especialidad (solo si tiene)
                if (caso.especialidad) {
                    conteoPorEspecialidad[caso.especialidad] = (conteoPorEspecialidad[caso.especialidad] || 0) + 1
                }
            }

            return {
                success: true,
                data: {
                    porTipoSolicitud: Object.entries(conteoPorTipo).map(([tipo, cantidad]) => ({ tipo, cantidad })),
                    porEspecialidad: Object.entries(conteoPorEspecialidad).map(([especialidad, cantidad]) => ({ especialidad, cantidad })),
                },
            }
        } catch (error) {
            console.error('Error en obtenerConteosPendientes:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Actualizar campos de un caso (direccionamiento, respuesta_back, estado_radicado)
     */
    async actualizarCaso(
        radicado: string,
        datos: {
            direccionamiento?: string | null
            respuesta_back?: string | null
            estado_radicado?: string
            tipo_solicitud?: string
        }
    ): Promise<ApiResponse<BackRadicacion>> {
        try {
            const updateData: Record<string, unknown> = {}

            if (datos.direccionamiento !== undefined) {
                updateData.direccionamiento = datos.direccionamiento
            }
            if (datos.respuesta_back !== undefined) {
                updateData.respuesta_back = datos.respuesta_back
            }
            if (datos.estado_radicado !== undefined) {
                updateData.estado_radicado = datos.estado_radicado
            }
            if (datos.tipo_solicitud !== undefined) {
                updateData.tipo_solicitud = datos.tipo_solicitud
            }

            const { data, error } = await supabase
                .from('back')
                .update(updateData)
                .eq('radicado', radicado)
                .select()
                .single()

            if (error) {
                console.error('Error actualizando caso:', error)
                return {
                    success: false,
                    error: 'Error al actualizar el caso: ' + error.message,
                }
            }

            // Notificar por SMS si el estado cambió
            if (datos.estado_radicado) {
                // Ejecutar en background (no esperar) para no bloquear la UI
                smsService.enviarNotificacionEstado(transformRadicacion(data as BackRadicacionRaw), datos.estado_radicado)
                    .catch(err => console.error('Error enviando SMS:', err))
            }

            return {
                success: true,
                data: transformRadicacion(data as BackRadicacionRaw),
                message: 'Caso actualizado exitosamente',
            }
        } catch (error) {
            console.error('Error en actualizarCaso:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Eliminar un caso (requiere permisos)
     */
    async eliminarCaso(radicado: string): Promise<ApiResponse<boolean>> {
        try {
            const { error } = await supabase
                .from('back')
                .delete()
                .eq('radicado', radicado)

            if (error) {
                console.error('Error eliminando caso:', error)
                return {
                    success: false,
                    error: 'Error al eliminar el caso. Verifica tus permisos.',
                }
            }

            return {
                success: true,
                data: true,
                message: 'Caso eliminado exitosamente',
            }
        } catch (error) {
            console.error('Error en eliminarCaso:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Refrescar URL firmada extraída de una URL posiblemente expirada
     */
    async refrescarUrlSoporte(url: string, radicado?: string, index?: number): Promise<string> {
        try {
            const bucketName = 'soportes-back'

            // CASO 1: Es una URL de Supabase (nuestra)
            if (url.includes(bucketName)) {
                let pathArchivo = ''
                try {
                    const urlObj = new URL(url)
                    const partes = urlObj.pathname.split(`/${bucketName}/`)
                    if (partes.length >= 2) {
                        pathArchivo = decodeURIComponent(partes[1])
                    }
                } catch (e) {
                    const pattern = new RegExp(`${bucketName}/(.+)`)
                    const match = url.match(pattern)
                    if (match && match[1]) {
                        pathArchivo = decodeURIComponent(match[1].split('?')[0])
                    }
                }

                if (pathArchivo) {
                    const { data } = await supabase.storage
                        .from(bucketName)
                        .createSignedUrl(pathArchivo, 3600)

                    if (data?.signedUrl) return data.signedUrl
                }
                return url
            }

            // CASO 2: Es URL Externa (Airtable/Jotform) y tenemos contexto para buscar en Supabase
            // Esto ayuda si se migraron los archivos pero no se actualizaron los links en BD
            if (radicado !== undefined && index !== undefined) {
                console.log(`URL externa detectada. Buscando respaldo en Supabase para ${radicado}...`)

                // Opción A: Buscar por convención de nombre exacta
                // const extension = url.split('.').pop()?.split('?')[0] || 'pdf' // La ext de airtable puede ser compleja
                // Mejor listamos los archivos del folder

                const { data: archivos } = await supabase.storage
                    .from(bucketName)
                    .list(radicado)

                if (archivos && archivos.length > 0) {
                    // Ordenamos por nombre o fecha? Asumimos orden alfabético que suele coincidir con _1, _2
                    // Filtrar solo archivos (no folders)
                    const files = archivos.filter(f => f.name !== '.emptyFolderPlaceholder')

                    // Intentamos obtener el archivo correspondiente al índice
                    // Ojo: index es 0-based.
                    // Si el orden coincide:
                    const archivoEncontrado = files[index]

                    if (archivoEncontrado) {
                        const pathEncontrado = `${radicado}/${archivoEncontrado.name}`
                        console.log('Archivo de respaldo encontrado:', pathEncontrado)

                        const { data } = await supabase.storage
                            .from(bucketName)
                            .createSignedUrl(pathEncontrado, 3600)

                        if (data?.signedUrl) return data.signedUrl
                    }
                }
            }

            // Si no se pudo recuperar, devolver original
            return url
        } catch (error) {
            console.error('Error refrescando URL:', error)
            return url
        }
    },
}

export default backService
