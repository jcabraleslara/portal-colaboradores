/**
 * Servicio de importación para BD Sigires NEPS (Nueva EPS)
 * Procesa archivos TXT delimitados por punto y coma (;) con encoding CP1252
 * Campos accedidos por índice numérico (50+ columnas)
 * Tabla destino: public.bd (PK: tipo_id, id)
 * Prioridad: BD_NEPS > BD_SIGIRES_NEPS > PORTAL_COLABORADORES
 *
 * NOTA: Usa lectura por streaming (ReadableStream) para soportar archivos
 * de hasta 2GB sin desbordar la memoria del navegador.
 */

import { supabase } from '@/config/supabase.config'
import type { ImportResult, ImportProgressCallback } from '../types/import.types'
import {
    cargarMunicipioMap,
    obtenerCodigoDepartamento,
    limpiarCacheDivipola,
} from '../utils/divipolaLookup'

/** Fila transformada lista para enviar a RPC */
interface BdSigiresNepsRow {
    tipo_id: string
    id: string
    apellido1: string
    apellido2: string
    nombres: string
    sexo: string
    direccion: string
    telefono: string
    fecha_nacimiento: string
    estado: string
    municipio: string
    observaciones: string
    ips_primaria: string
    tipo_cotizante: string
    departamento: string
    rango: string
    email: string
    regimen: string
    eps: string
}

/** Índices de columnas en el archivo TXT (0-based) */
const COL = {
    MUNICIPIO: 6,
    CODIGO_IPS: 8,
    TIPO_DOCUMENTO: 10,
    NRO_IDENTIFICACION: 11,
    PRIMER_APELLIDO: 12,
    SEGUNDO_APELLIDO: 13,
    PRIMER_NOMBRE: 14,
    SEGUNDO_NOMBRE: 15,
    FECHA_NACIMIENTO: 16,
    SEXO: 17,
    REGIMEN: 26,
    ESTADO: 28,
    DIRECCION: 31,
    TELEFONO: 33,
    CORREO: 35,
    CRONICO: 43,
    DISCAPACIDAD: 44,
    SALUD_MENTAL: 45,
    POBLACION_CONDICION_VULNERABLE: 48,
    VCA: 49,
    GRUPO_PATOLOGIA: 113,
} as const

/** Sanitiza valores: NUL chars, comillas, NULL literal, trim */
function sanitize(val: string): string {
    if (!val) return ''
    const clean = val.replace(/\x00/g, '').replace(/"/g, '').trim()
    const upper = clean.toUpperCase()
    if (upper === 'NULL' || upper === 'NAN' || upper === 'UNDEFINED') return ''
    if (clean === ' ') return ''
    return clean
}

/**
 * Parsea fecha DD/MM/YYYY → YYYY-MM-DD
 * Formatos soportados: DD/MM/YYYY, D/M/YYYY
 */
function parseDateSigires(val: string): string {
    if (!val || !val.trim()) return ''
    const trimmed = val.trim()

    // DD/MM/YYYY o D/M/YYYY
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (match) {
        const [, dd, mm, yyyy] = match
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }

    // YYYY-MM-DD (ISO)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

    return ''
}

/**
 * Transforma una línea del archivo en un registro BD
 * Retorna null si la línea es inválida
 */
function transformLine(
    line: string,
    municipioMap: Map<string, string>,
    redMap: Map<string, string>,
    stats: {
        skippedRows: number
        crucesIpsCorrectos: number
        crucesIpsFallidos: number
        ipsNoEncontradas: Map<string, number>
    }
): { row: BdSigiresNepsRow; dedupeKey: string } | null {
    const fields = line.split(';')

    if (fields.length < 50) {
        stats.skippedRows++
        return null
    }

    // tipo_id pasa directo del archivo (CC, TI, CE, etc.)
    const tipoId = sanitize(fields[COL.TIPO_DOCUMENTO]).toUpperCase()
    if (!tipoId) {
        stats.skippedRows++
        return null
    }

    const id = sanitize(fields[COL.NRO_IDENTIFICACION])
    if (!id) {
        stats.skippedRows++
        return null
    }

    // Concatenar nombres
    const nombre1 = sanitize(fields[COL.PRIMER_NOMBRE])
    const nombre2 = sanitize(fields[COL.SEGUNDO_NOMBRE])
    const nombres = [nombre1, nombre2].filter(Boolean).join(' ')

    // Lookup IPS
    const codigoIps = sanitize(fields[COL.CODIGO_IPS])
    let ipsPrimaria = ''
    if (codigoIps && redMap.has(codigoIps)) {
        ipsPrimaria = redMap.get(codigoIps)!
        stats.crucesIpsCorrectos++
    } else if (codigoIps) {
        stats.crucesIpsFallidos++
        stats.ipsNoEncontradas.set(codigoIps, (stats.ipsNoEncontradas.get(codigoIps) || 0) + 1)
    }

    // Municipio y departamento
    const municipio = sanitize(fields[COL.MUNICIPIO]).toUpperCase()
    const departamento = obtenerCodigoDepartamento(municipio, municipioMap)

    // Teléfono: solo importar si inicia con 3 y tiene exactamente 10 dígitos
    const telefonoRaw = sanitize(fields[COL.TELEFONO]).replace(/\D/g, '')
    const telefono = (telefonoRaw.startsWith('3') && telefonoRaw.length === 10) ? telefonoRaw : ''

    // Observaciones: construir desde múltiples campos del archivo
    const obsPartes: string[] = []
    const cronicoVal = sanitize(fields[COL.CRONICO])
    if (cronicoVal && Number(cronicoVal) >= 1) obsPartes.push('CRONICO')
    const discapacidadVal = sanitize(fields[COL.DISCAPACIDAD])
    if (discapacidadVal && Number(discapacidadVal) >= 1) obsPartes.push('DISCAPACIDAD')
    const saludMentalVal = sanitize(fields[COL.SALUD_MENTAL])
    if (saludMentalVal && Number(saludMentalVal) >= 1) obsPartes.push('SALUD MENTAL')
    const pobCondVulnVal = sanitize(fields[COL.POBLACION_CONDICION_VULNERABLE]).toUpperCase()
    if (pobCondVulnVal === 'S') obsPartes.push('POBLACION CONDICION VULNERABLE')
    const vcaVal = sanitize(fields[COL.VCA]).toUpperCase()
    if (vcaVal === 'S') obsPartes.push('PAPSIVI (VICTIMA DEL CONFLICTO ARMADO)')
    // GRUPO PATOLOGÍA: índice 113, puede no existir en filas cortas
    if (fields.length > COL.GRUPO_PATOLOGIA) {
        const grupoPatologia = sanitize(fields[COL.GRUPO_PATOLOGIA]).toUpperCase()
        if (grupoPatologia) obsPartes.push(grupoPatologia)
    }
    const observaciones = obsPartes.join(', ')

    return {
        dedupeKey: `${tipoId}|${id}`,
        row: {
            tipo_id: tipoId,
            id,
            apellido1: sanitize(fields[COL.PRIMER_APELLIDO]),
            apellido2: sanitize(fields[COL.SEGUNDO_APELLIDO]),
            nombres,
            sexo: sanitize(fields[COL.SEXO]).toUpperCase(),
            direccion: sanitize(fields[COL.DIRECCION]),
            telefono,
            fecha_nacimiento: parseDateSigires(sanitize(fields[COL.FECHA_NACIMIENTO])),
            estado: sanitize(fields[COL.ESTADO]).toUpperCase(),
            municipio,
            observaciones,
            ips_primaria: ipsPrimaria,
            tipo_cotizante: '',
            departamento,
            rango: '',
            email: sanitize(fields[COL.CORREO]),
            regimen: sanitize(fields[COL.REGIMEN]).toUpperCase(),
            eps: 'NUEVA EPS',
        },
    }
}

/**
 * Procesa archivo BD Sigires NEPS (TXT delimitado por ;, encoding CP1252)
 * Usa ReadableStream para manejar archivos de hasta 2GB sin desbordar memoria
 */
export async function processSigiresNepsFile(
    file: File,
    onProgress: ImportProgressCallback
): Promise<ImportResult> {
    const startTime = performance.now()
    const fileSize = file.size

    // ═══ Fase 1: Cargar tablas de referencia (0-5%) ═══
    onProgress('Cargando tablas de referencia...', 0)
    limpiarCacheDivipola()

    const [municipioMap, redMap, timestampData] = await Promise.all([
        cargarMunicipioMap(),
        cargarRedMap(),
        supabase.rpc('now').then(r => r.data as string),
    ])

    const timestampInicio = timestampData || new Date().toISOString()
    onProgress('Tablas de referencia cargadas', 5)

    // ═══ Fase 2: Stream-read + transformar (5-40%) ═══
    onProgress('Leyendo archivo por streaming...', 5)

    const rowsMap = new Map<string, BdSigiresNepsRow>()
    let fileDuplicates = 0
    const stats = {
        skippedRows: 0,
        crucesIpsCorrectos: 0,
        crucesIpsFallidos: 0,
        ipsNoEncontradas: new Map<string, number>(),
    }

    const reader = file.stream().getReader()
    const decoder = new TextDecoder('windows-1252')
    let leftover = ''
    let isFirstLine = true
    let totalLinesRead = 0
    let bytesRead = 0

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        bytesRead += value.byteLength
        const chunk = decoder.decode(value, { stream: true })
        const text = leftover + chunk
        const parts = text.split('\n')

        // Último segmento puede estar incompleto
        leftover = parts.pop() || ''

        for (const line of parts) {
            if (!line.trim()) continue

            // Saltar cabecera
            if (isFirstLine) {
                isFirstLine = false
                continue
            }

            totalLinesRead++
            const result = transformLine(line, municipioMap, redMap, stats)
            if (result) {
                if (rowsMap.has(result.dedupeKey)) {
                    fileDuplicates++
                }
                rowsMap.set(result.dedupeKey, result.row)
            }
        }

        // Reportar progreso basado en bytes leídos
        const pct = 5 + Math.round((bytesRead / fileSize) * 35)
        if (totalLinesRead % 50000 === 0) {
            onProgress(`Leyendo... ${totalLinesRead} registros (${Math.round(bytesRead / 1024 / 1024)}MB)`, pct)
        }
    }

    // Procesar último segmento residual
    if (leftover.trim() && !isFirstLine) {
        totalLinesRead++
        const result = transformLine(leftover, municipioMap, redMap, stats)
        if (result) {
            if (rowsMap.has(result.dedupeKey)) {
                fileDuplicates++
            }
            rowsMap.set(result.dedupeKey, result.row)
        }
    }

    if (totalLinesRead === 0) {
        throw new Error('El archivo está vacío o no tiene datos.')
    }

    const validRows = Array.from(rowsMap.values())

    if (validRows.length === 0) {
        throw new Error('No se encontraron registros válidos para importar.')
    }

    onProgress(`${validRows.length} registros únicos de ${totalLinesRead} líneas`, 40)

    // ═══ Fase 3: UPSERT en chunks via RPC (40-85%) ═══
    onProgress(`Importando ${validRows.length} registros...`, 40)

    let totalInsertados = 0
    let totalActualizados = 0
    let totalComplementados = 0
    let errorCount = 0

    const RPC_BATCH = 5000
    for (let i = 0; i < validRows.length; i += RPC_BATCH) {
        const chunk = validRows.slice(i, i + RPC_BATCH)

        const { data, error } = await supabase.rpc('upsert_bd_batch', {
            registros: chunk,
            p_fuente: 'BD_SIGIRES_NEPS',
        })

        if (error) {
            console.error('Error en RPC upsert_bd_batch (SIGIRES NEPS):', error)
            errorCount += chunk.length
        } else if (data) {
            totalInsertados += (data.insertados || 0)
            totalActualizados += (data.actualizados || 0)
            totalComplementados += (data.complementados || 0)
        }

        const processed = Math.min(i + RPC_BATCH, validRows.length)
        const pct = 40 + Math.round((processed / validRows.length) * 45)
        onProgress(`Procesando... ${processed}/${validRows.length}`, pct)
    }

    // ═══ Fase 4: Retirar registros antiguos (85-90%) ═══
    onProgress('Retirando registros no incluidos...', 85)
    let retirados = 0

    const { data: orphanData, error: orphanError } = await supabase.rpc('marcar_huerfanos_bd', {
        p_fuente: 'BD_SIGIRES_NEPS',
        p_timestamp_inicio: timestampInicio,
    })

    if (orphanError) {
        console.error('Error retirando huérfanos SIGIRES NEPS:', orphanError)
    } else if (orphanData) {
        retirados = orphanData.huerfanos_marcados || 0
    }

    // ═══ Fase 5: Generar reporte CSV (90-95%) ═══
    onProgress('Generando reporte...', 90)

    let errorReport: string | undefined
    const reportSections: string[] = []

    const summaryHeader = '=== SECCION: RESUMEN DE IMPORTACION BD SIGIRES NEPS ==='
    const summaryRows = [
        `Total registros en archivo,${totalLinesRead}`,
        `Registros unicos,${rowsMap.size}`,
        `Insertados nuevos,${totalInsertados}`,
        `Actualizados,${totalActualizados}`,
        `Complementados (BD_NEPS),${totalComplementados}`,
        `Retirados a PORTAL_COLABORADORES,${retirados}`,
        `Duplicados en archivo,${fileDuplicates}`,
        `Descartados (sin tipo_id/id),${stats.skippedRows}`,
        `Cruces IPS correctos,${stats.crucesIpsCorrectos}`,
        `Cruces IPS fallidos,${stats.crucesIpsFallidos}`,
        `Errores de procesamiento,${errorCount}`,
    ].join('\n')
    reportSections.push(`${summaryHeader}\n${summaryRows}`)

    if (stats.ipsNoEncontradas.size > 0) {
        const ipsHeader = '\n=== SECCION: CODIGOS IPS NO ENCONTRADOS EN TABLA RED ==='
        const ipsRows = ['Codigo IPS,Cantidad registros']
        for (const [cod, count] of Array.from(stats.ipsNoEncontradas.entries()).sort((a, b) => b[1] - a[1])) {
            ipsRows.push(`${cod},${count}`)
        }
        reportSections.push(`${ipsHeader}\n${ipsRows.join('\n')}`)
    }

    if (reportSections.length > 0) {
        errorReport = reportSections.join('\n\n')
    }

    // ═══ Fase 6: Registrar en historial (95-100%) ═══
    onProgress('Registrando en historial...', 95)

    const endTime = performance.now()
    const durationSeconds = Math.round((endTime - startTime) / 1000)
    const minutes = Math.floor(durationSeconds / 60)
    const seconds = durationSeconds % 60
    const durationStr = `${minutes}m ${seconds}s`

    try {
        const { error: logError } = await supabase.from('import_history').insert({
            usuario: (await supabase.auth.getUser()).data.user?.email || 'unknown',
            archivo_nombre: file.name,
            tipo_fuente: 'bd-sigires-neps',
            total_registros: totalLinesRead,
            exitosos: totalInsertados + totalActualizados + totalComplementados,
            fallidos: errorCount,
            duplicados: fileDuplicates,
            duracion: durationStr,
            detalles: {
                insertados: totalInsertados,
                actualizados: totalActualizados,
                complementados_neps: totalComplementados,
                retirados,
                cruces_ips_correctos: stats.crucesIpsCorrectos,
                cruces_ips_fallidos: stats.crucesIpsFallidos,
                duplicados_archivo: fileDuplicates,
                registros_descartados: stats.skippedRows,
            },
        })
        if (logError) console.error('Error logging history:', logError)
    } catch (e) {
        console.error('Failed to log import history', e)
    }

    onProgress('Importación completada', 100)

    const errorMessages: string[] = []
    if (retirados > 0) errorMessages.push(`${retirados} registros retirados a "VALIDAR EN PORTAL EPS"`)
    if (totalComplementados > 0) errorMessages.push(`${totalComplementados} registros BD_NEPS complementados`)
    if (stats.crucesIpsFallidos > 0) errorMessages.push(`${stats.crucesIpsFallidos} códigos IPS no encontrados en tabla RED`)
    if (errorCount > 0) errorMessages.push(`${errorCount} registros con error de procesamiento`)

    return {
        success: totalInsertados + totalActualizados + totalComplementados,
        errors: errorCount,
        duplicates: fileDuplicates,
        totalProcessed: totalLinesRead,
        duration: durationStr,
        errorReport,
        errorMessage: errorMessages.length > 0 ? errorMessages.join('. ') + '.' : undefined,
    }
}

/**
 * Carga mapa cod_hab → nombre_ips desde tabla red
 */
async function cargarRedMap(): Promise<Map<string, string>> {
    const { data, error } = await supabase
        .from('red')
        .select('cod_hab, nombre_ips')

    if (error) throw new Error(`Error cargando tabla RED: ${error.message}`)

    const map = new Map<string, string>()
    for (const row of data || []) {
        if (row.cod_hab && row.nombre_ips) {
            map.set(row.cod_hab.trim(), row.nombre_ips.trim())
        }
    }

    return map
}
