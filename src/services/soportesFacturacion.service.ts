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
import { EDGE_FUNCTIONS, getEdgeFunctionHeaders } from '@/config/api.config'
import {
    SoporteFacturacion,
    SoporteFacturacionRaw,
    CrearSoporteFacturacionData,
    FiltrosSoportesFacturacion,
    CategoriaArchivo,
    EpsFacturacion,
    ServicioPrestado,
    ESTADOS_SOPORTE_LISTA,
    RadicadorUnico
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
        identificacionesArchivos: raw.identificaciones_archivos || [],
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
 * Obtener prefijo de archivo según EPS, Servicio y Categoría
 * Reglas de negocio según Matriz de Renombrado
 */
export function getPrefijoArchivo(eps: EpsFacturacion, servicio: ServicioPrestado, categoria: CategoriaArchivo): string {
    // 1. Reglas Globales (Aplican por defecto salvo excepciones)
    // Autorización -> Generalmente OPF (Salud Total) o PDE (Nueva, Familiar)
    if (categoria === 'autorizacion') {
        if (eps === 'SALUD TOTAL') return 'OPF'
        return 'PDE'
    }

    // Comprobante -> CRC
    if (categoria === 'comprobante_recibo') return 'CRC'

    // Validación Derechos / Adres
    if (categoria === 'validacion_derechos') {
        if (eps === 'NUEVA EPS') return 'PDE2'
        if (eps === 'FAMILIAR') return 'OPF' // Ojo: Familiar usa OPF para Adres
        // Salud Total no suele pedir este documento según tabla, pero si lo pide, default OPF
        return 'OPF'
    }

    // Orden Médica
    if (categoria === 'orden_medica') {
        if (eps === 'FAMILIAR') return 'PDE2'
        return 'PDX' // Default cauto
    }

    // Cirugías específicos (Salud Total predominantemente)
    if (categoria === 'descripcion_quirurgica') return 'DQX'
    if (categoria === 'registro_anestesia') return 'RAN'
    if (categoria === 'hoja_medicamentos') return 'HAM'
    if (categoria === 'notas_enfermeria') return 'HEV' // Según tabla cirugía Salud Total, nota enfermería es HEV

    // 2. Reglas Dependientes del Servicio (Historia Clínica / Soporte / Resultados)
    // Categoría 'soporte_clinico' abarca: Historia, Soporte, Resultados, Evolución
    if (categoria === 'soporte_clinico') {
        const esImagenOLab = servicio === 'Imágenes Diagnósticas' || servicio === 'Laboratorio clínico'

        // SALUD TOTAL
        if (eps === 'SALUD TOTAL') {
            return esImagenOLab ? 'PDX' : 'HEV'
        }

        // NUEVA EPS
        if (eps === 'NUEVA EPS') {
            // Laboratorio en Nueva EPS -> Resultados = PDX
            // Imágenes en Nueva EPS -> Resultado = PDX
            return esImagenOLab ? 'PDX' : 'HEV'
        }

        // FAMILIAR
        if (eps === 'FAMILIAR') {
            // Imágenes -> Resultado = PDX
            if (servicio === 'Imágenes Diagnósticas') return 'PDX'
            return 'HEV'
        }
    }

    return 'DOC' // Fallback genérico si nada coincide
}

/**
 * Extraer Identificación válida del nombre del archivo original
 * Busca patrones tipo: (CC|TI|RC|CE|...)[Numero]
 * Ejemplo: "CC123456.pdf" -> "CC123456"
 * Ejemplo: "Soporte_TI987654321_Feb.pdf" -> "TI987654321"
 */
export function extraerIdentificacionArchivo(nombreArchivo: string): string | null {
    // Tipos de ID válidos según DB: CE, CN, SC, PE, PT, TI, CC, RC, ME, AS
    // Regex busca: (Límite de palabra o inicio)(TIPO_ID)(Dígitos)(Límite o fin no alfanumérico)
    // Se usa 'i' para case-insensitive
    const patron = /(?:^|[^a-zA-Z])(CC|TI|CE|CN|SC|PE|PT|RC|ME|AS)\s*(\d{1,13})(?:[^0-9]|$)/i
    const match = nombreArchivo.match(patron)

    if (match && match[1] && match[2]) {
        // Normalizar a mayúsculas y quitar espacios
        const tipoId = match[1].toUpperCase()
        const numero = match[2]

        // Validar límite superior numérico (1199999999)
        if (parseInt(numero, 10) <= 1199999999) {
            return `${tipoId}${numero}`
        }
    }
    return null
}

/**
 * Extraer identificaciones de un array de URLs firmadas
 * Para cada URL, decodifica el pathname y extrae la identificación del nombre del archivo
 * @returns Array de identificaciones únicas (con tipo y solo número)
 */
export function extraerIdentificacionesDeUrls(urls: string[]): string[] {
    const identificaciones = new Set<string>()
    for (const url of urls) {
        try {
            const urlObj = new URL(url)
            const pathName = decodeURIComponent(urlObj.pathname)
            const nombreArchivo = pathName.split('/').pop() || ''
            const id = extraerIdentificacionArchivo(nombreArchivo)
            if (id) {
                identificaciones.add(id)
                // También agregar solo el número para búsqueda flexible
                const soloNumero = id.replace(/^(CC|TI|CE|CN|SC|PE|PT|RC|ME|AS)/i, '')
                if (soloNumero) identificaciones.add(soloNumero)
            }
        } catch {
            // URL malformada, ignorar
        }
    }
    return Array.from(identificaciones)
}

/**
 * Ejecutar operación con reintentos y backoff exponencial
 * Útil para manejar errores transitorios como HTTP 502
 */
async function executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 1000
): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation()
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            // Si es último intento, no esperar
            if (attempt === maxRetries) break

            // Backoff exponencial: 1s, 2s, 4s...
            const delay = baseDelayMs * Math.pow(2, attempt)
            console.warn(`⚠️ Intento ${attempt + 1} falló, reintentando en ${delay}ms...`, lastError.message)
            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }

    throw lastError
}

export const soportesFacturacionService = {
    /**
     * Subir archivos al bucket de soportes-facturacion
     * Renombrado dinámico: [PREFIJO]_900842629_[ID_PACIENTE]_[CONSECUTIVO].pdf
     * Incluye reintentos automáticos para manejar errores transitorios (502, timeout)
     * @returns Objeto con URLs firmadas y las identificaciones extraídas de los archivos
     */
    async subirArchivos(
        archivos: File[],
        categoria: CategoriaArchivo,
        radicado: string,
        eps: EpsFacturacion,
        servicio?: ServicioPrestado
    ): Promise<{ urls: string[]; identificacionesExtraidas: string[] }> {
        const urls: string[] = []
        const identificacionesSet = new Set<string>()
        // NIT fijo para renombrado
        const NIT = '900842629'
        const prefijo = getPrefijoArchivo(eps, servicio || 'Consulta Ambulatoria', categoria) // Fallback seguro de servicio

        for (let i = 0; i < archivos.length; i++) {
            const archivo = archivos[i]
            // Siempre forzar extensión .pdf como buena práctica si el cliente lo prefiere,
            // pero mantenemos la original si es imagen, aunque el renombrado sugerido es .pdf
            // El usuario no especificó conversión, así que mantenemos extensión original.
            const extension = archivo.name.split('.').pop()?.toLowerCase() || 'pdf'

            // 1. Intentar obtener identificación del nombre del archivo
            const identificacionPaciente = extraerIdentificacionArchivo(archivo.name)

            let nombreFinal = ''

            if (identificacionPaciente) {
                // ESTRATEGIA A: Identificación encontrada
                // Formato: PREFIJO_NIT_IDPACIENTE.ext
                // Sin consecutivo - el nombre es estandarizado
                nombreFinal = `${prefijo}_${NIT}_${identificacionPaciente}.${extension}`

                // Acumular identificaciones extraídas para búsqueda
                identificacionesSet.add(identificacionPaciente)
                // También agregar solo el número para búsqueda flexible
                const soloNumero = identificacionPaciente.replace(/^(CC|TI|CE|CN|SC|PE|PT|RC|ME|AS)/i, '')
                if (soloNumero) identificacionesSet.add(soloNumero)

            } else {
                // ESTRATEGIA B: Fallback (No se halló ID en el nombre)
                // Usar Radicado como identificador único
                // Formato: PREFIJO_RADICADO_CATEGORIA.ext
                nombreFinal = `${prefijo}_${radicado}_${categoria}.${extension}`
            }

            const ruta = `${radicado}/${nombreFinal}`

            // Subida con reintentos automáticos para manejar errores transitorios (502, timeout)
            try {
                await executeWithRetry(async () => {
                    const { error } = await supabase.storage
                        .from('soportes-facturacion')
                        .upload(ruta, archivo, {
                            cacheControl: '3600',
                            upsert: true,
                        })

                    if (error) {
                        throw error
                    }
                }, 3, 1000)
            } catch (error) {
                console.error(`Error subiendo archivo ${nombreFinal} después de reintentos:`, error)

                // Notificar error crítico de Storage solo si todos los reintentos fallaron
                await criticalErrorService.reportStorageFailure(
                    'upload',
                    'Soportes de Facturación',
                    'soportes-facturacion',
                    error as Error
                )

                throw new Error(`Error subiendo ${archivo.name}: ${(error as Error).message}`)
            }

            // Generar URL firmada (válida por 1 año)
            const { data: urlData } = await supabase.storage
                .from('soportes-facturacion')
                .createSignedUrl(ruta, 31536000) // 1 año

            if (urlData?.signedUrl) {
                urls.push(urlData.signedUrl)
            }
        }

        return {
            urls,
            identificacionesExtraidas: Array.from(identificacionesSet)
        }
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
            const todasIdentificaciones = new Set<string>()

            for (const grupo of data.archivos) {
                if (grupo.files.length > 0) {
                    try {
                        const { urls, identificacionesExtraidas } = await this.subirArchivos(
                            grupo.files,
                            grupo.categoria,
                            radicado,
                            data.eps,
                            data.servicioPrestado
                        )
                        const columnName = getCategoriaColumnName(grupo.categoria)
                        urlsUpdate[columnName] = urls

                        // Acumular identificaciones extraídas de todos los archivos
                        for (const id of identificacionesExtraidas) {
                            todasIdentificaciones.add(id)
                        }
                    } catch (uploadError) {
                        console.error(`Error subiendo archivos de ${grupo.categoria}:`, uploadError)
                        // Continuar con otras categorías
                    }
                }
            }

            // Agregar identificaciones_archivos al update si hay identificaciones extraídas
            if (todasIdentificaciones.size > 0) {
                urlsUpdate['identificaciones_archivos'] = Array.from(todasIdentificaciones)
            }

            // Actualizar registro con URLs de archivos e identificaciones
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

            if (filtros.radicadorNombre) {
                // Búsqueda flexible por nombre: dividir el término en palabras y buscar todas
                const palabras = filtros.radicadorNombre.trim().toLowerCase().split(/\s+/).filter(p => p.length > 0)
                // Crear condición que requiera todas las palabras (sin importar orden)
                for (const palabra of palabras) {
                    query = query.ilike('radicador_nombre', `%${palabra}%`)
                }
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

            // Búsqueda por radicado, identificación, nombre o ID en archivos
            if (filtros.busqueda && filtros.busqueda.trim()) {
                const termino = filtros.busqueda.trim()
                const terminoUpper = termino.toUpperCase()

                // Búsqueda en campos tradicionales + nuevo campo de archivos
                // cs (contains) busca si el array contiene el elemento exacto
                query = query.or(
                    `radicado.ilike.%${termino}%,` +
                    `identificacion.ilike.%${termino}%,` +
                    `nombres_completos.ilike.%${termino}%,` +
                    `identificaciones_archivos.cs.{${terminoUpper}},` +
                    `identificaciones_archivos.cs.{${termino}}`
                )
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
            // Validar que si el estado es "Devuelto", las observaciones no estén vacías
            if (estado === 'Devuelto' && (!observaciones || !observaciones.trim())) {
                return {
                    success: false,
                    error: 'Debe ingresar observaciones de facturación para devolver el radicado',
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

            // Si el estado es "Devuelto", enviar correo de notificación
            if (estado === 'Devuelto' && soporteActualizado.radicadorEmail) {
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
            const response = await fetch(EDGE_FUNCTIONS.uploadOnedrive, {
                method: 'POST',
                headers: getEdgeFunctionHeaders(),
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
            // Realizar conteos paralelos para evitar el límite de 1000 filas de Supabase
            // y ser más eficiente que traer todos los datos
            const promises = ESTADOS_SOPORTE_LISTA
                .filter(estado => estado !== 'Todos')
                .map(async (estado) => {
                    const { count, error } = await supabase
                        .from('soportes_facturacion')
                        .select('*', { count: 'exact', head: true })
                        .eq('estado', estado)

                    if (error) {
                        console.error(`Error contando estado ${estado}:`, error)
                        return { estado, count: 0 }
                    }
                    return { estado, count: count || 0 }
                })

            const results = await Promise.all(promises)

            const conteos: Record<string, number> = {}
            results.forEach(r => {
                conteos[r.estado as string] = r.count
            })

            return { success: true, data: conteos }
        } catch (error) {
            console.error('Error en obtenerConteosPorEstado:', error)
            return { success: false, error: ERROR_MESSAGES.SERVER_ERROR }
        }
    },

    /**
     * Obtener lista de radicadores únicos (para autocomplete)
     * Retorna nombre y email de radicadores que ya tienen registros en la tabla
     */
    async obtenerRadicadoresUnicos(): Promise<ApiResponse<RadicadorUnico[]>> {
        try {
            // Obtener radicadores únicos con nombre no nulo
            const { data, error } = await supabase
                .from('soportes_facturacion')
                .select('radicador_nombre, radicador_email')
                .not('radicador_nombre', 'is', null)
                .order('radicador_nombre', { ascending: true })

            if (error) {
                console.error('Error obteniendo radicadores únicos:', error)
                return { success: false, error: ERROR_MESSAGES.SERVER_ERROR }
            }

            // Eliminar duplicados usando un Map con el nombre como clave
            const radicadoresMap = new Map<string, RadicadorUnico>()
            for (const item of data || []) {
                const nombre = item.radicador_nombre as string
                if (nombre && !radicadoresMap.has(nombre)) {
                    radicadoresMap.set(nombre, {
                        nombre,
                        email: item.radicador_email as string
                    })
                }
            }

            const radicadores = Array.from(radicadoresMap.values())

            return { success: true, data: radicadores }
        } catch (error) {
            console.error('Error en obtenerRadicadoresUnicos:', error)
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
                    console.log(`Eliminando carpeta de OneDrive (${folderId})...`)
                    await fetch(EDGE_FUNCTIONS.deleteOnedrive, {
                        method: 'POST',
                        headers: getEdgeFunctionHeaders(),
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
