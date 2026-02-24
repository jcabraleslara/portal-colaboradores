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
 * Ejecutar operación con reintentos y backoff exponencial + jitter
 * Útil para manejar errores transitorios como HTTP 502 y "Failed to fetch"
 */
async function executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 5,
    baseDelayMs = 1500
): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation()
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            if (attempt === maxRetries) break

            // Backoff exponencial con jitter para evitar thundering herd
            // 1.5s, 3s, 6s, 12s, 24s + jitter aleatorio (0-30%)
            const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
            const jitter = exponentialDelay * Math.random() * 0.3
            const delay = Math.min(exponentialDelay + jitter, 30000) // Cap 30s
            console.warn(`[Storage] Intento ${attempt + 1}/${maxRetries} falló, reintentando en ${Math.round(delay)}ms...`, lastError.message)
            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }

    throw lastError
}

/**
 * Tamaño máximo permitido por archivo (en bytes): 10 MB
 */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

/**
 * Magic bytes de formatos válidos para validación de contenido
 */
const MAGIC_BYTES: Record<string, number[]> = {
    pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
    png: [0x89, 0x50, 0x4E, 0x47], // .PNG
    jpg: [0xFF, 0xD8, 0xFF],       // JFIF/EXIF
}

/**
 * Validar un archivo antes de intentar subirlo a Storage.
 * Detecta archivos vacíos, demasiado grandes o con contenido corrupto.
 * @returns null si el archivo es válido, o un string con la razón del rechazo
 */
async function validarArchivo(archivo: File): Promise<string | null> {
    // 1. Archivo vacío
    if (archivo.size === 0) {
        return `El archivo "${archivo.name}" está vacío (0 bytes)`
    }

    // 2. Tamaño máximo
    if (archivo.size > MAX_FILE_SIZE_BYTES) {
        const sizeMB = (archivo.size / (1024 * 1024)).toFixed(1)
        return `El archivo "${archivo.name}" excede el límite de 10 MB (${sizeMB} MB)`
    }

    // 3. Validar magic bytes (contenido real del archivo)
    const extension = archivo.name.split('.').pop()?.toLowerCase() || ''
    const expectedMagic = extension === 'jpeg' ? MAGIC_BYTES.jpg : MAGIC_BYTES[extension]

    if (expectedMagic) {
        try {
            const headerSlice = archivo.slice(0, 8)
            const buffer = await headerSlice.arrayBuffer()
            const bytes = new Uint8Array(buffer)

            const matchesMagic = expectedMagic.every((byte, i) => bytes[i] === byte)
            if (!matchesMagic) {
                return `El archivo "${archivo.name}" parece estar corrupto o no es un ${extension.toUpperCase()} válido`
            }
        } catch {
            return `No se pudo leer el contenido del archivo "${archivo.name}"`
        }
    }

    return null
}

/** Limite de subidas concurrentes al bucket de Storage */
const UPLOAD_CONCURRENCY_LIMIT = 3

/** Máximo de fallos consecutivos antes de activar circuit breaker */
const CIRCUIT_BREAKER_THRESHOLD = 3

/** Pausa del circuit breaker en ms */
const CIRCUIT_BREAKER_COOLDOWN_MS = 5000

/** Umbral de tasa de fallo para abortar lote tempranamente */
const EARLY_ABORT_FAILURE_RATE = 0.6
const EARLY_ABORT_MIN_FAILURES = 5

/**
 * Cola global para serializar el procesamiento de archivos entre radicados.
 * Evita que múltiples radicados compitan por conexiones del navegador simultáneamente,
 * lo cual causa saturación y fallos masivos en uploads a Supabase Storage.
 * (Chrome limita ~6 conexiones HTTP/1.1 concurrentes por origen)
 */
let _colaProcesamientoArchivos: Promise<void> = Promise.resolve()

/**
 * Subir múltiples archivos concurrentemente con límite de paralelismo adaptativo.
 * - Reduce concurrencia automáticamente cuando detecta fallos en un lote.
 * - Recupera concurrencia tras lotes exitosos.
 * - Circuit breaker: pausa larga tras N fallos consecutivos para dar respiro a la red.
 * - Pausas dinámicas entre lotes según volumen total.
 */
async function uploadBatchConcurrent<T, R>(
    items: T[],
    operation: (item: T) => Promise<R>,
    concurrencyLimit = UPLOAD_CONCURRENCY_LIMIT
): Promise<{ results: (R | null)[]; failedIndexes: number[] }> {
    const results: (R | null)[] = new Array(items.length).fill(null)
    const failedIndexes: number[] = []
    let currentConcurrency = concurrencyLimit
    let consecutiveFailures = 0

    for (let i = 0; i < items.length; i += currentConcurrency) {
        const chunk = items.slice(i, i + currentConcurrency)
        const chunkResults = await Promise.allSettled(
            chunk.map((item, idx) => operation(item).then(r => ({ globalIdx: i + idx, result: r })))
        )

        let chunkFailures = 0
        for (let j = 0; j < chunkResults.length; j++) {
            const settled = chunkResults[j]
            if (settled.status === 'fulfilled') {
                results[settled.value.globalIdx] = settled.value.result
                consecutiveFailures = 0
            } else {
                failedIndexes.push(i + j)
                chunkFailures++
                consecutiveFailures++
            }
        }

        // Concurrencia adaptativa: reducir si hubo fallos en este lote
        if (chunkFailures > 0 && currentConcurrency > 1) {
            currentConcurrency = Math.max(1, currentConcurrency - 1)
            console.warn(`[Storage] Concurrencia reducida a ${currentConcurrency} por ${chunkFailures} fallo(s) en lote`)
        } else if (chunkFailures === 0 && currentConcurrency < concurrencyLimit) {
            // Recuperar concurrencia gradualmente tras lotes exitosos
            currentConcurrency = Math.min(concurrencyLimit, currentConcurrency + 1)
        }

        // Circuit breaker: pausa larga tras fallos consecutivos
        if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
            console.warn(`[Storage] Circuit breaker activado: ${consecutiveFailures} fallos consecutivos, pausa de ${CIRCUIT_BREAKER_COOLDOWN_MS}ms`)
            await new Promise(resolve => setTimeout(resolve, CIRCUIT_BREAKER_COOLDOWN_MS))
            consecutiveFailures = 0
        }

        // Early abort: si la tasa de fallo es demasiado alta, abortar los restantes
        const totalProcessed = i + chunk.length
        const failureRate = failedIndexes.length / totalProcessed
        if (failedIndexes.length >= EARLY_ABORT_MIN_FAILURES && failureRate > EARLY_ABORT_FAILURE_RATE) {
            console.error(`[Storage] Abortando subida: ${failedIndexes.length}/${totalProcessed} archivos fallidos (${Math.round(failureRate * 100)}%). Conexiones probablemente saturadas.`)
            for (let remaining = i + currentConcurrency; remaining < items.length; remaining++) {
                failedIndexes.push(remaining)
            }
            break
        }

        // Pausa dinámica entre lotes según volumen total
        if (i + currentConcurrency < items.length) {
            const basePause = items.length > 20 ? 800 : items.length > 10 ? 500 : 300
            await new Promise(resolve => setTimeout(resolve, basePause))
        }
    }

    return { results, failedIndexes }
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
    ): Promise<{ urls: string[]; identificacionesExtraidas: string[]; archivosFallidos: string[]; erroresDetalle: { nombre: string; razon: string }[] }> {
        const identificacionesSet = new Set<string>()
        const archivosFallidos: string[] = []
        const erroresDetalle: { nombre: string; razon: string }[] = []
        // NIT fijo para renombrado
        const NIT = '900842629'
        const prefijo = getPrefijoArchivo(eps, servicio || 'Consulta Ambulatoria', categoria)

        // Pre-validar archivos antes de intentar subir (evita reintentos inútiles en archivos corruptos/vacíos)
        const archivosValidos: File[] = []
        for (const archivo of archivos) {
            const errorValidacion = await validarArchivo(archivo)
            if (errorValidacion) {
                console.error(`[Storage] Archivo rechazado pre-upload: ${errorValidacion}`)
                archivosFallidos.push(archivo.name)
                erroresDetalle.push({ nombre: archivo.name, razon: errorValidacion })
            } else {
                archivosValidos.push(archivo)
            }
        }

        // Si todos los archivos fueron rechazados en validación, notificar y retornar
        if (archivosValidos.length === 0 && archivosFallidos.length > 0) {
            await criticalErrorService.reportStorageFailure(
                'upload',
                'Soportes de Facturación',
                'soportes-facturacion',
                new Error(`${archivosFallidos.length} archivo(s) rechazados en validación: ${archivosFallidos.join(', ')}`)
            )
            return { urls: [], identificacionesExtraidas: [], archivosFallidos, erroresDetalle }
        }

        // Preparar metadata de cada archivo válido antes de subir
        const archivosMeta = archivosValidos.map((archivo) => {
            const extension = archivo.name.split('.').pop()?.toLowerCase() || 'pdf'
            const identificacionPaciente = extraerIdentificacionArchivo(archivo.name)

            let nombreFinal = ''
            if (identificacionPaciente) {
                nombreFinal = `${prefijo}_${NIT}_${identificacionPaciente}.${extension}`
                identificacionesSet.add(identificacionPaciente)
                const soloNumero = identificacionPaciente.replace(/^(CC|TI|CE|CN|SC|PE|PT|RC|ME|AS)/i, '')
                if (soloNumero) identificacionesSet.add(soloNumero)
            } else {
                nombreFinal = `${prefijo}_${radicado}_${categoria}.${extension}`
            }

            return { archivo, nombreFinal, ruta: `${radicado}/${nombreFinal}` }
        })

        // Subir archivos concurrentemente en lotes
        const uploadOneFile = async (meta: typeof archivosMeta[0]): Promise<string | null> => {
            try {
                // Upload con reintentos (5 intentos, base 1.5s, backoff + jitter)
                await executeWithRetry(async () => {
                    const { error } = await supabase.storage
                        .from('soportes-facturacion')
                        .upload(meta.ruta, meta.archivo, {
                            cacheControl: '3600',
                            upsert: true,
                        })
                    if (error) throw error
                }, 5, 1500)
            } catch (uploadError) {
                // Upload falló tras todos los reintentos.
                // Verificar si el archivo llegó al Storage (falso negativo por timeout de red:
                // el servidor recibe y procesa el upload, pero el cliente no recibe la respuesta)
                console.warn(`[Storage] Upload falló para ${meta.nombreFinal}, verificando existencia en Storage...`)
                const { data: urlData } = await supabase.storage
                    .from('soportes-facturacion')
                    .createSignedUrl(meta.ruta, 31536000)

                if (urlData?.signedUrl) {
                    console.info(`[Storage] Archivo ${meta.nombreFinal} encontrado en Storage (recuperado de falso negativo de red)`)
                    return urlData.signedUrl
                }

                // El archivo realmente no existe en Storage
                throw uploadError
            }

            // Generar URL firmada (válida por 1 año) con reintentos
            return await executeWithRetry(async () => {
                const { data: urlData, error: signError } = await supabase.storage
                    .from('soportes-facturacion')
                    .createSignedUrl(meta.ruta, 31536000)
                if (signError) throw signError
                if (!urlData?.signedUrl) throw new Error('No se generó URL firmada')
                return urlData.signedUrl
            }, 3, 1000)
        }

        // Subida concurrente con límite de paralelismo
        const { results, failedIndexes } = await uploadBatchConcurrent(
            archivosMeta,
            uploadOneFile,
            UPLOAD_CONCURRENCY_LIMIT
        )

        // Recolectar URLs exitosas y registrar fallos
        const urls: string[] = []
        for (let i = 0; i < results.length; i++) {
            if (results[i]) {
                urls.push(results[i] as string)
            }
        }

        // Reportar archivos fallidos individualmente
        for (const idx of failedIndexes) {
            const meta = archivosMeta[idx]
            archivosFallidos.push(meta.archivo.name)
            erroresDetalle.push({ nombre: meta.archivo.name, razon: 'Error de conexión al subir el archivo al servidor. Puede deberse a congestión de red o envío simultáneo de muchos archivos.' })
            console.error(`[Storage] Archivo falló después de todos los reintentos: ${meta.nombreFinal}`)
        }

        // Si hubo fallos, notificar error crítico al equipo técnico (una sola vez)
        if (archivosFallidos.length > 0) {
            await criticalErrorService.reportStorageFailure(
                'upload',
                'Soportes de Facturación',
                'soportes-facturacion',
                new Error(`${archivosFallidos.length} archivo(s) fallaron: ${archivosFallidos.join(', ')}`)
            )
        }

        return {
            urls,
            identificacionesExtraidas: Array.from(identificacionesSet),
            archivosFallidos,
            erroresDetalle
        }
    },

    /**
     * Crear una nueva radicación de soportes de facturación.
     *
     * Flujo optimizado para lotes grandes:
     * 1. Crea el registro en BD (síncrono) → retorna radicado inmediatamente
     * 2. Procesa archivos en background (upload + actualización BD + emails)
     * 3. El radicador recibe confirmación por correo al finalizar
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

            const rawRegistro = registro as SoporteFacturacionRaw
            const radicado = rawRegistro.radicado
            const soporteInicial = transformSoporte(rawRegistro)

            // Lanzar procesamiento de archivos en background (encolado)
            // Los archivos se suben asincrónicamente y el radicador recibe email con el resultado
            // Se usa cola global para serializar: si se crean 2+ radicados simultáneamente,
            // sus uploads no compiten por conexiones del navegador
            const totalArchivos = data.archivos.reduce((acc, g) => acc + g.files.length, 0)
            if (totalArchivos > 0) {
                console.info(`[Radicación] ${radicado}: Encolando procesamiento de ${totalArchivos} archivo(s)`)
                _colaProcesamientoArchivos = _colaProcesamientoArchivos.then(async () => {
                    try {
                        console.info(`[Radicación] ${radicado}: Iniciando procesamiento de archivos`)
                        await this._procesarArchivosEnBackground(radicado, data)
                    } catch (err) {
                        console.error(`[Radicación] ${radicado}: Error fatal en procesamiento background:`, err)
                    }
                })
            } else {
                // Sin archivos: enviar confirmación directa
                this._enviarEmailConfirmacion(radicado, soporteInicial).catch(err => {
                    console.error(`[Radicación] ${radicado}: Error enviando email de confirmación:`, err)
                })
            }

            return {
                success: true,
                data: soporteInicial,
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
     * Procesamiento de archivos en background.
     * Sube archivos por categoría, actualiza BD con URLs y envía emails de resultado.
     * Se ejecuta de forma asíncrona después de que crearRadicacion retorna.
     */
    async _procesarArchivosEnBackground(radicado: string, data: CrearSoporteFacturacionData): Promise<void> {
        const urlsUpdate: Record<string, string[]> = {}
        const todasIdentificaciones = new Set<string>()
        const fallosPorCategoria: { categoria: string; nombres: string[]; errores: { nombre: string; razon: string }[] }[] = []

        // Subir archivos por categoría
        for (const grupo of data.archivos) {
            if (grupo.files.length > 0) {
                try {
                    const { urls, identificacionesExtraidas, archivosFallidos, erroresDetalle } = await this.subirArchivos(
                        grupo.files,
                        grupo.categoria,
                        radicado,
                        data.eps,
                        data.servicioPrestado
                    )

                    if (urls.length > 0) {
                        const columnName = getCategoriaColumnName(grupo.categoria)
                        urlsUpdate[columnName] = urls
                    }

                    for (const id of identificacionesExtraidas) {
                        todasIdentificaciones.add(id)
                    }

                    if (archivosFallidos.length > 0) {
                        fallosPorCategoria.push({
                            categoria: grupo.categoria,
                            nombres: archivosFallidos,
                            errores: erroresDetalle
                        })
                    }
                } catch (uploadError) {
                    console.error(`[Background ${radicado}] Error subiendo ${grupo.categoria}:`, uploadError)
                    fallosPorCategoria.push({
                        categoria: grupo.categoria,
                        nombres: grupo.files.map(f => f.name),
                        errores: grupo.files.map(f => ({ nombre: f.name, razon: 'Error inesperado al procesar el archivo' }))
                    })
                }
            }
        }

        // Agregar identificaciones extraídas al update
        if (todasIdentificaciones.size > 0) {
            urlsUpdate['identificaciones_archivos'] = Array.from(todasIdentificaciones)
        }

        // Actualizar registro con URLs de archivos
        if (Object.keys(urlsUpdate).length > 0) {
            const { error: updateError } = await supabase
                .from('soportes_facturacion')
                .update(urlsUpdate)
                .eq('radicado', radicado)

            if (updateError) {
                console.warn(`[Background ${radicado}] Error actualizando URLs:`, updateError)
            }
        }

        // Obtener registro actualizado para enviar email con datos completos
        const { data: registroFinal } = await supabase
            .from('soportes_facturacion')
            .select('*')
            .eq('radicado', radicado)
            .single()

        const soporteCreado = transformSoporte(registroFinal as SoporteFacturacionRaw)

        // Enviar email de confirmación con archivos procesados
        await this._enviarEmailConfirmacion(radicado, soporteCreado)

        // Si hubo archivos fallidos, enviar notificación adicional de fallo
        if (fallosPorCategoria.length > 0) {
            try {
                const { emailService } = await import('./email.service')
                const totalFallidos = fallosPorCategoria.reduce((acc, f) => acc + f.nombres.length, 0)
                const totalArchivos = data.archivos.reduce((acc, g) => acc + g.files.length, 0)

                // Consolidar todos los errores detallados
                const todosErrores = fallosPorCategoria.flatMap(f => f.errores)

                await emailService.enviarNotificacionFalloSubida(
                    soporteCreado.radicadorEmail,
                    radicado,
                    {
                        archivosFallidos: fallosPorCategoria,
                        archivosExitosos: totalArchivos - totalFallidos,
                        totalArchivos,
                        timestamp: new Date().toLocaleString('es-CO'),
                        erroresDetalle: todosErrores,
                    }
                )
                console.warn(`[Background ${radicado}] Notificación de fallo enviada (${totalFallidos} archivos fallidos)`)
            } catch (notifyError) {
                console.error(`[Background ${radicado}] Error enviando notificación de fallo:`, notifyError)
            }
        }

        console.info(`[Background ${radicado}] Procesamiento completado`)
    },

    /**
     * Enviar correo de confirmación de radicación con los archivos procesados
     */
    async _enviarEmailConfirmacion(radicado: string, soporte: SoporteFacturacion): Promise<void> {
        try {
            const { emailService } = await import('./email.service')

            const archivos = [
                { categoria: 'Validación de Derechos', urls: soporte.urlsValidacionDerechos },
                { categoria: 'Autorización', urls: soporte.urlsAutorizacion },
                { categoria: 'Soporte Clínico', urls: soporte.urlsSoporteClinico },
                { categoria: 'Comprobante de Recibo', urls: soporte.urlsComprobanteRecibo },
                { categoria: 'Orden Médica', urls: soporte.urlsOrdenMedica },
                { categoria: 'Descripción Quirúrgica', urls: soporte.urlsDescripcionQuirurgica },
                { categoria: 'Registro de Anestesia', urls: soporte.urlsRegistroAnestesia },
                { categoria: 'Hoja de Medicamentos', urls: soporte.urlsHojaMedicamentos },
                { categoria: 'Notas de Enfermería', urls: soporte.urlsNotasEnfermeria }
            ]

            const datosRadicacion = {
                eps: soporte.eps,
                regimen: soporte.regimen,
                servicioPrestado: soporte.servicioPrestado,
                fechaAtencion: soporte.fechaAtencion.toISOString().split('T')[0],
                pacienteNombre: soporte.nombresCompletos || 'No especificado',
                pacienteIdentificacion: soporte.identificacion || 'No especificado',
                archivos,
                fechaRadicacion: soporte.fechaRadicacion.toISOString(),
                radicadorEmail: soporte.radicadorEmail
            }

            const emailEnviado = await emailService.enviarNotificacionRadicacionExitosa(
                soporte.radicadorEmail,
                radicado,
                datosRadicacion
            )

            if (emailEnviado) {
                console.log(`[Background ${radicado}] Correo de confirmación enviado a ${soporte.radicadorEmail}`)
            } else {
                console.warn(`[Background ${radicado}] No se pudo enviar el correo de confirmación`)
            }
        } catch (emailError) {
            console.error(`[Background ${radicado}] Error enviando correo:`, emailError)
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
    /**
     * Obtener lista de radicadores únicos (para autocomplete)
     * Retorna nombre y email de radicadores que ya tienen registros en la tabla
     */
    async obtenerRadicadoresUnicos(): Promise<ApiResponse<RadicadorUnico[]>> {
        try {
            // Usamos una función RPC de base de datos para obtener los únicos eficientemente
            // y evitar el límite de filas de Supabase (1000 por defecto)
            // La función SQL es: obtener_radicadores_unicos()
            const { data, error } = await supabase
                .rpc('obtener_radicadores_unicos')

            if (error) {
                console.warn('Error obteniendo radicadores vía RPC, usando fallback:', error)

                // Fallback: intentar consulta normal con límite ampliado
                const { data: dataFallback, error: errorFallback } = await supabase
                    .from('soportes_facturacion')
                    .select('radicador_nombre, radicador_email')
                    .not('radicador_nombre', 'is', null)
                    .order('radicador_nombre', { ascending: true })
                    .range(0, 9999) // Traer hasta 10000 registros para asegurar cobertura

                if (errorFallback) {
                    console.error('Error fallback radicadores:', errorFallback)
                    return { success: false, error: ERROR_MESSAGES.SERVER_ERROR }
                }

                // Eliminar duplicados manualmente en el cliente (menos eficiente pero funciona)
                const radicadoresMap = new Map<string, RadicadorUnico>()
                for (const item of dataFallback || []) {
                    const nombre = item.radicador_nombre as string
                    if (nombre && !radicadoresMap.has(nombre)) {
                        radicadoresMap.set(nombre, {
                            nombre,
                            email: item.radicador_email as string
                        })
                    }
                }
                return { success: true, data: Array.from(radicadoresMap.values()) }
            }

            // Si RPC funciona correctamente
            const radicadores: RadicadorUnico[] = (data as any[]).map(item => ({
                nombre: item.nombre,
                email: item.email
            }))

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
     * Elimina archivos en Supabase Storage y registro en base de datos
     */
    async eliminarRadicado(radicado: string): Promise<ApiResponse<null>> {
        try {
            console.log(`🗑️ Iniciando proceso de eliminación para ${radicado}...`)

            // 1. Eliminar archivos de Supabase Storage
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

            // 2. Eliminar registro de Base de Datos
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

    /**
     * Actualizar estado de múltiples radicados de forma masiva
     * @param radicados Lista de números de radicado a actualizar
     * @param estado Nuevo estado a asignar
     * @param observaciones Observaciones opcionales (requeridas si estado es 'Devuelto')
     * @returns Resultado con cantidad de registros actualizados
     */
    async actualizarEstadoMasivo(
        radicados: string[],
        estado: SoporteFacturacion['estado'],
        observaciones?: string
    ): Promise<ApiResponse<{ actualizados: number; fallidos: string[] }>> {
        try {
            // Validaciones
            if (!radicados || radicados.length === 0) {
                return {
                    success: false,
                    error: 'Debe seleccionar al menos un radicado',
                }
            }

            if (estado === 'Devuelto' && (!observaciones || !observaciones.trim())) {
                return {
                    success: false,
                    error: 'Debe ingresar observaciones de facturación para devolver los radicados',
                }
            }

            const updateData: Record<string, unknown> = { estado }
            if (observaciones !== undefined) {
                updateData.observaciones_facturacion = observaciones.trim() || null
            }

            // Ejecutar update masivo
            const { data, error } = await supabase
                .from('soportes_facturacion')
                .update(updateData)
                .in('radicado', radicados)
                .select('radicado')

            if (error) {
                console.error('Error en actualizarEstadoMasivo:', error)
                return {
                    success: false,
                    error: `Error al actualizar: ${error.message}`,
                }
            }

            const actualizados = data?.length || 0
            const radicadosActualizados = data?.map(r => r.radicado) || []
            const fallidos = radicados.filter(r => !radicadosActualizados.includes(r))

            return {
                success: true,
                data: { actualizados, fallidos },
                message: `${actualizados} radicado(s) actualizado(s) exitosamente`,
            }
        } catch (error) {
            console.error('Error crítico en actualizarEstadoMasivo:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Actualizar estado de todos los registros que coincidan con los filtros
     * @param filtros Filtros a aplicar para seleccionar los registros
     * @param estado Nuevo estado a asignar
     * @param observaciones Observaciones opcionales (requeridas si estado es 'Devuelto')
     * @returns Resultado con cantidad de registros actualizados
     */
    async actualizarEstadoPorFiltros(
        filtros: FiltrosSoportesFacturacion,
        estado: SoporteFacturacion['estado'],
        observaciones?: string
    ): Promise<ApiResponse<{ actualizados: number }>> {
        try {
            if (estado === 'Devuelto' && (!observaciones || !observaciones.trim())) {
                return {
                    success: false,
                    error: 'Debe ingresar observaciones de facturación para devolver los radicados',
                }
            }

            // Construir query con los mismos filtros que obtenerListaFiltrada
            let query = supabase
                .from('soportes_facturacion')
                .update({
                    estado,
                    observaciones_facturacion: observaciones?.trim() || null
                })

            // Aplicar filtros
            if (filtros.estado && filtros.estado !== 'Todos') {
                query = query.eq('estado', filtros.estado)
            }

            if (filtros.eps) {
                query = query.eq('eps', filtros.eps)
            }

            if (filtros.radicadorNombre) {
                const palabras = filtros.radicadorNombre.trim().toLowerCase().split(/\s+/).filter(p => p.length > 0)
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

            if (filtros.fechaAtencionInicio) {
                query = query.gte('fecha_atencion', filtros.fechaAtencionInicio)
            }

            if (filtros.fechaAtencionFin) {
                query = query.lte('fecha_atencion', filtros.fechaAtencionFin + 'T23:59:59')
            }

            if (filtros.busqueda && filtros.busqueda.trim()) {
                const termino = filtros.busqueda.trim()
                const terminoUpper = termino.toUpperCase()

                query = query.or(
                    `radicado.ilike.%${termino}%,` +
                    `identificacion.ilike.%${termino}%,` +
                    `nombres_completos.ilike.%${termino}%,` +
                    `identificaciones_archivos.cs.{${terminoUpper}},` +
                    `identificaciones_archivos.cs.{${termino}}`
                )
            }

            // Ejecutar update y obtener cantidad
            const { data, error } = await query.select('radicado')

            if (error) {
                console.error('Error en actualizarEstadoPorFiltros:', error)
                return {
                    success: false,
                    error: `Error al actualizar: ${error.message}`,
                }
            }

            const actualizados = data?.length || 0

            return {
                success: true,
                data: { actualizados },
                message: `${actualizados} radicado(s) actualizado(s) exitosamente`,
            }
        } catch (error) {
            console.error('Error crítico en actualizarEstadoPorFiltros:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },
}


export default soportesFacturacionService
