/**
 * Servicio de importación para BD Sigires ST (Salud Total PGP)
 * Procesa archivos XLSX del sistema Sigires
 * Tabla destino: public.bd (PK: tipo_id, id)
 * Modo: complementa campos vacíos de registros Cerete, overwrite resto
 */

import { supabase } from '@/config/supabase.config'
import type { ImportResult, ImportProgressCallback } from '../types/import.types'
import { parseSpreadsheetFile } from '../utils/parseSpreadsheet'
import {
    cargarMunicipioMap,
    cargarDepartamentoMap,
    obtenerCodigoDepartamento,
    obtenerCodigoDepartamentoPorNombre,
    limpiarCacheDivipola,
} from '../utils/divipolaLookup'

/** Fila transformada lista para enviar a RPC */
interface BdPgpRow {
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

/** Mapeo de encabezados normalizados → campo BD */
const COLUMN_MAP: Record<string, string> = {
    'BENEFICIARIOTIPOID': 'tipo_id_raw',
    'BENEFICIARIOID': 'id',
    'NOMBRE1': 'nombre1',
    'NOMBRE2': 'nombre2',
    'APELLIDO1': 'apellido1',
    'APELLIDO2': 'apellido2',
    'SEXO': 'sexo',
    'FECHANACIMIENTO': 'fecha_nacimiento_raw',
    'DIRECCIONRES': 'direccion',
    'CELULAR': 'telefono',
    'MUNICIPIORES': 'municipio',
    'DEPARTAMENTORES': 'departamento_raw',
    'NOMBREESTADOSERVICIO': 'estado_raw',
    'REGIMEN': 'regimen',
    'CORREOELECTRONICO': 'email',
    'IPSPRIMARIAAFIL': 'ips_primaria',
}

/** Mapeo tipo documento letra → código */
const TIPO_ID_MAP: Record<string, string> = {
    'C': 'CC',
    'T': 'TI',
    'R': 'RC',
    'E': 'CE',
    'PT': 'PT',
    'CN': 'CN',
    'M': 'ME',
    'P': 'PA',
    'S': 'AS',
}

/** Normaliza encabezados: quita acentos, espacios y caracteres especiales */
function normalizeHeader(h: string): string {
    return h
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .replace(/&nbsp;/gi, '')
        .trim()
        .toUpperCase()
}

/** Sanitiza valores */
function sanitize(val: string): string {
    if (!val) return ''
    let clean = val.replace(/\x00/g, '').trim()
    const upper = clean.toUpperCase()
    if (upper === 'NULL' || upper === 'NAN' || upper === 'UNDEFINED') return ''
    if (clean === ' ') return ''
    return clean
}

/** Normaliza estado */
function normalizeEstado(val: string): string {
    const upper = val.trim().toUpperCase()
    if (upper.includes('ACTIVO')) return 'ACTIVO'
    return upper
}

/**
 * Parsea fechas en múltiples formatos PGP:
 * - M/D/YY (SheetJS con raw:false) → resolver siglo
 * - Serial Excel numérico
 * - YYYY-MM-DD, DD/MM/YYYY como fallback
 */
function parseDatePgp(val: string): string {
    if (!val || !val.trim()) return ''
    const trimmed = val.trim()

    // Serial Excel numérico (ej: 33709)
    const numVal = Number(trimmed)
    if (!isNaN(numVal) && numVal > 1000 && numVal < 100000) {
        const excelEpoch = new Date(1899, 11, 30)
        const date = new Date(excelEpoch.getTime() + numVal * 86400000)
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0]
        }
    }

    // YYYY-MM-DD (ISO, viene de normalizeDateCells en parseSpreadsheet)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    }

    // M/D/YY o M/D/YYYY
    const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
    if (mdyMatch) {
        const [, mm, dd, yyOrYyyy] = mdyMatch
        let year: number
        if (yyOrYyyy.length === 4) {
            year = parseInt(yyOrYyyy, 10)
        } else {
            const yy = parseInt(yyOrYyyy, 10)
            // Años 00-30 → 2000s, 31-99 → 1900s
            year = yy <= 30 ? 2000 + yy : 1900 + yy
        }
        return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }

    // DD/MM/YYYY
    const dmyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (dmyMatch) {
        const [, dd, mm, yyyy] = dmyMatch
        return `${yyyy}-${mm}-${dd}`
    }

    return ''
}

/** Limpia identificación: trim + quitar .0 de Excel */
function cleanId(val: string): string {
    return val.trim().replace(/\.0$/, '')
}

/**
 * Procesa archivo BD Sigires ST (XLSX)
 */
export async function processBdSigiresSTFile(
    file: File,
    onProgress: ImportProgressCallback
): Promise<ImportResult> {
    const startTime = performance.now()
    const timestampInicio = new Date().toISOString()

    // ═══ Fase 1: Leer + parsear XLSX (0-5%) ═══
    onProgress('Leyendo archivo XLSX...', 0)
    const doc = await parseSpreadsheetFile(file)

    // ═══ Fase 2: Detectar tabla + mapear columnas (5-10%) ═══
    onProgress('Detectando tabla de datos...', 5)
    const tables = doc.querySelectorAll('table')
    let targetTable: HTMLTableElement | null = null
    let headerRowIndex = -1
    const columnIndices: Record<string, number> = {}

    for (const table of Array.from(tables)) {
        const rows = Array.from(table.rows)
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const row = rows[i]
            const cells = Array.from(row.cells).map(c => normalizeHeader(c.textContent || ''))

            // Buscar encabezados clave de Sigires ST
            if (cells.includes('BENEFICIARIOID') && cells.includes('APELLIDO1')) {
                targetTable = table
                headerRowIndex = i

                cells.forEach((headerText, index) => {
                    const dbCol = COLUMN_MAP[headerText]
                    if (dbCol && columnIndices[dbCol] === undefined) {
                        columnIndices[dbCol] = index
                    }
                })
                break
            }
        }
        if (targetTable) break
    }

    if (!targetTable) {
        throw new Error('No se encontró la tabla Sigires ST en el archivo. Verifique que el archivo sea correcto.')
    }

    if (columnIndices['id'] === undefined || columnIndices['apellido1'] === undefined) {
        throw new Error('No se encontraron las columnas BeneficiarioId y Apellido1 requeridas.')
    }

    // ═══ Fase 3: Extraer + transformar + dedup (10-15%) ═══
    onProgress('Extrayendo datos...', 10)
    const fileRows = Array.from(targetTable.rows).slice(headerRowIndex + 1)
    const rowsMap = new Map<string, BdPgpRow>()
    let fileDuplicates = 0
    let skippedRows = 0

    const getItem = (cells: HTMLCollectionOf<HTMLTableCellElement>, col: string): string => {
        const idx = columnIndices[col]
        if (idx === undefined || idx >= cells.length) return ''
        return cells[idx].textContent?.trim() || ''
    }

    for (const row of fileRows) {
        const cells = row.cells
        if (cells.length < 3) continue

        const tipoIdRaw = sanitize(getItem(cells, 'tipo_id_raw')).toUpperCase()
        const tipoId = TIPO_ID_MAP[tipoIdRaw] || tipoIdRaw
        const id = cleanId(sanitize(getItem(cells, 'id')))

        if (!tipoId || !id) {
            skippedRows++
            continue
        }

        const dedupeKey = `${tipoId}|${id}`
        if (rowsMap.has(dedupeKey)) {
            fileDuplicates++
            continue
        }

        // Concatenar Nombre1 + Nombre2
        const nombre1 = sanitize(getItem(cells, 'nombre1'))
        const nombre2 = sanitize(getItem(cells, 'nombre2'))
        const nombres = [nombre1, nombre2].filter(Boolean).join(' ')

        const rowData: BdPgpRow = {
            tipo_id: tipoId,
            id,
            nombres,
            apellido1: sanitize(getItem(cells, 'apellido1')),
            apellido2: sanitize(getItem(cells, 'apellido2')),
            sexo: sanitize(getItem(cells, 'sexo')),
            direccion: sanitize(getItem(cells, 'direccion')),
            telefono: sanitize(getItem(cells, 'telefono')),
            fecha_nacimiento: parseDatePgp(sanitize(getItem(cells, 'fecha_nacimiento_raw'))),
            estado: normalizeEstado(sanitize(getItem(cells, 'estado_raw'))),
            municipio: sanitize(getItem(cells, 'municipio')).toUpperCase(),
            observaciones: '',
            ips_primaria: sanitize(getItem(cells, 'ips_primaria')),
            tipo_cotizante: '',
            departamento: '', // Se resuelve en fase DIVIPOLA
            rango: '',
            email: sanitize(getItem(cells, 'email')),
            regimen: sanitize(getItem(cells, 'regimen')).toUpperCase(),
            eps: 'SALUD TOTAL',
        }

        // Guardar departamento raw para resolver después
        ;(rowData as BdPgpRow & { _departamento_raw?: string })._departamento_raw =
            sanitize(getItem(cells, 'departamento_raw')).toUpperCase()

        rowsMap.set(dedupeKey, rowData)
    }

    const dataBatch = Array.from(rowsMap.values())

    if (dataBatch.length === 0) {
        throw new Error('No se encontraron registros válidos para importar.')
    }

    // ═══ Fase 4: Resolver DIVIPOLA (15-30%) ═══
    onProgress('Cargando tablas DIVIPOLA...', 15)
    limpiarCacheDivipola()
    const [municipioMap, departamentoMap] = await Promise.all([
        cargarMunicipioMap(),
        cargarDepartamentoMap(),
    ])

    onProgress('Resolviendo departamentos...', 20)
    for (const row of dataBatch) {
        const rawDep = (row as BdPgpRow & { _departamento_raw?: string })._departamento_raw || ''
        // Intentar primero por nombre de departamento (más directo)
        if (rawDep) {
            row.departamento = obtenerCodigoDepartamentoPorNombre(rawDep, departamentoMap)
        } else {
            row.departamento = obtenerCodigoDepartamento(row.municipio, municipioMap)
        }
        // Limpiar campo temporal
        delete (row as BdPgpRow & { _departamento_raw?: string })._departamento_raw
    }

    // ═══ Fase 5: Filtrar registros sin PK (30-35%) ═══
    onProgress('Validando registros...', 30)
    const validRows = dataBatch.filter(r => r.tipo_id && r.id)
    const invalidPkCount = dataBatch.length - validRows.length

    // ═══ Fase 6: Enviar batches a RPC (35-85%) ═══
    onProgress(`Importando ${validRows.length} registros...`, 35)

    let totalInsertados = 0
    let totalActualizados = 0
    let totalComplementados = 0
    let errorCount = 0

    const RPC_BATCH = 2000
    for (let i = 0; i < validRows.length; i += RPC_BATCH) {
        const chunk = validRows.slice(i, i + RPC_BATCH)

        const { data, error } = await supabase.rpc('upsert_bd_batch', {
            registros: chunk,
            p_fuente: 'BD_ST_PGP',
        })

        if (error) {
            console.error('Error en RPC upsert_bd_batch (PGP):', error)
            errorCount += chunk.length
        } else if (data) {
            totalInsertados += (data.insertados || 0)
            totalActualizados += (data.actualizados || 0)
            totalComplementados += (data.complementados || 0)
        }

        const processed = Math.min(i + RPC_BATCH, validRows.length)
        const pct = 35 + Math.round((processed / validRows.length) * 50)
        onProgress(`Procesando... ${processed}/${validRows.length}`, pct)
    }

    // ═══ Fase 7: Marcar huérfanos (85-90%) ═══
    onProgress('Marcando registros no incluidos...', 85)
    let huerfanosMarcados = 0

    const { data: orphanData, error: orphanError } = await supabase.rpc('marcar_huerfanos_bd', {
        p_fuente: 'BD_ST_PGP',
        p_timestamp_inicio: timestampInicio,
    })

    if (orphanError) {
        console.error('Error marcando huérfanos PGP:', orphanError)
    } else if (orphanData) {
        huerfanosMarcados = orphanData.huerfanos_marcados || 0
    }

    // ═══ Fase 8: Generar reporte + historial (90-100%) ═══
    onProgress('Generando reporte...', 90)

    let errorReport: string | undefined
    const reportSections: string[] = []

    const summaryHeader = '=== SECCION: RESUMEN DE IMPORTACION BD SIGIRES ST ==='
    const summaryRows = [
        `Total registros en archivo,${rowsMap.size + fileDuplicates + skippedRows}`,
        `Registros unicos,${rowsMap.size}`,
        `Insertados nuevos,${totalInsertados}`,
        `Actualizados (no Cerete),${totalActualizados}`,
        `Complementados (Cerete),${totalComplementados}`,
        `Huerfanos marcados (VALIDAR EN PORTAL EPS),${huerfanosMarcados}`,
        `Duplicados en archivo,${fileDuplicates}`,
        `Sin tipo_id o id,${skippedRows + invalidPkCount}`,
        `Errores de procesamiento,${errorCount}`,
    ].join('\n')
    reportSections.push(`${summaryHeader}\n${summaryRows}`)

    if (reportSections.length > 0) {
        errorReport = reportSections.join('\n\n')
    }

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
            tipo_fuente: 'bd-sigires-st',
            total_registros: rowsMap.size + fileDuplicates + skippedRows,
            exitosos: totalInsertados + totalActualizados + totalComplementados,
            fallidos: errorCount,
            duplicados: fileDuplicates,
            duracion: durationStr,
            detalles: {
                insertados: totalInsertados,
                actualizados: totalActualizados,
                complementados: totalComplementados,
                huerfanos_marcados: huerfanosMarcados,
                duplicados_archivo: fileDuplicates,
                sin_pk: skippedRows + invalidPkCount,
            },
        })
        if (logError) console.error('Error logging history:', logError)
    } catch (e) {
        console.error('Failed to log import history', e)
    }

    onProgress('Importación completada', 100)

    const errorMessages: string[] = []
    if (huerfanosMarcados > 0) errorMessages.push(`${huerfanosMarcados} registros marcados como "VALIDAR EN PORTAL EPS"`)
    if (totalComplementados > 0) errorMessages.push(`${totalComplementados} registros Cerete complementados`)
    if (errorCount > 0) errorMessages.push(`${errorCount} registros con error de procesamiento`)

    return {
        success: totalInsertados + totalActualizados + totalComplementados,
        errors: errorCount,
        duplicates: fileDuplicates,
        totalProcessed: rowsMap.size + fileDuplicates + skippedRows,
        duration: durationStr,
        errorReport,
        errorMessage: errorMessages.length > 0 ? errorMessages.join('. ') + '.' : undefined,
    }
}
