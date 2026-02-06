/**
 * Servicio de importación para Ordenamientos
 * Procesa archivos XLS/XLSX del sistema clínico
 * Tabla destino: public.ordenamientos (PK: fecha, id, cups)
 * FK: cups → cups(cups)
 */

import { supabase } from '@/config/supabase.config'
import type { ImportResult, ImportProgressCallback } from '../types/import.types'
import { parseSpreadsheetFile } from '../utils/parseSpreadsheet'

export interface OrdenamientoRow {
    fecha: string | null
    tipo_id: string
    id: string
    nombres_completos: string
    contrato: string
    medico: string
    especialidad: string
    cups: string
    cantidad: number | null
    servicio: string
}

/** Mapeo de encabezados normalizados a columnas de BD */
const COLUMN_MAP: Record<string, keyof OrdenamientoRow> = {
    'FECHA': 'fecha',
    'TIPOID': 'tipo_id',
    'NUMEROID': 'id',
    'PACIENTE': 'nombres_completos',
    'CONTRATO': 'contrato',
    'MEDICO': 'medico',
    'ESPECIALIDAD': 'especialidad',
    'CUPS': 'cups',
    'CANTIDAD': 'cantidad',
    'SERVICIO': 'servicio',
}

/** Normaliza encabezados: quita acentos, espacios y &nbsp; */
const normalizeHeader = (h: string): string => {
    return h
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .replace(/&nbsp;/gi, '')
        .trim()
        .toUpperCase()
}

/** Parsea fechas en múltiples formatos */
const parseDate = (val: string): string | null => {
    if (!val || !val.trim()) return null
    const trimmed = val.trim()

    // YYYY/MM/DD (formato del sistema clínico)
    const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/)
    if (slashMatch) {
        return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`
    }

    // DD/MM/YYYY
    const legacyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (legacyMatch) {
        return `${legacyMatch[3]}-${legacyMatch[2].padStart(2, '0')}-${legacyMatch[1].padStart(2, '0')}`
    }

    // YYYY-MM-DD (ISO)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    }

    return null
}

/** Limpia identificación: trim + quitar .0 de Excel */
const cleanId = (val: string): string => {
    return val.trim().replace(/\.0$/, '')
}

/**
 * Normaliza código CUPS del sistema clínico
 * El sistema agrega padding de ceros a la derecha (ej: 534001 → 5340010000)
 * Ejemplos: 5340010000 → 534001, 6400000000 → 640000, 70101 → 070101
 */
const normalizeCups = (val: string): string | null => {
    let cups = val.trim().replace(/\.0$/, '')
    if (!cups) return null

    // Si tiene más de 6 dígitos, tomar solo los primeros 6
    if (cups.length > 6) cups = cups.substring(0, 6)

    // Pad con cero a la izquierda si tiene 5 dígitos
    if (cups.length === 5) cups = '0' + cups

    // CUPS válido debe tener exactamente 6 dígitos
    return cups.length === 6 ? cups : null
}

/**
 * Procesa archivo de ordenamientos (XLS/HTML)
 * Usa RPC `importar_ordenamientos` para alto rendimiento
 */
export async function processOrdenamientosFile(
    file: File,
    onProgress: ImportProgressCallback
): Promise<ImportResult> {
    const startTime = performance.now()

    // ═══ Fase 1: Leer + parsear archivo (0-5%) ═══
    onProgress('Leyendo archivo...', 0)
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

            // Buscar encabezados clave de ordenamientos
            if (cells.includes('FECHA') && cells.includes('NUMEROID') && cells.includes('CUPS')) {
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
        throw new Error('No se encontró la tabla de ordenamientos en el archivo. Verifique que el archivo sea correcto.')
    }

    if (columnIndices['fecha'] === undefined || columnIndices['id'] === undefined || columnIndices['cups'] === undefined) {
        throw new Error('No se encontraron las columnas Fecha, Numero Id y Cups requeridas.')
    }

    // ═══ Fase 3: Extraer filas + normalizar CUPS + dedup (10-15%) ═══
    onProgress('Extrayendo datos...', 10)
    const fileRows = Array.from(targetTable.rows).slice(headerRowIndex + 1)
    const rowsMap = new Map<string, OrdenamientoRow>()
    let fileDuplicates = 0
    let skippedRows = 0

    for (const row of fileRows) {
        const cells = row.cells
        if (cells.length < 3) continue

        const getItem = (col: keyof OrdenamientoRow): string => {
            const idx = columnIndices[col]
            if (idx === undefined || idx >= cells.length) return ''
            return cells[idx].textContent?.trim() || ''
        }

        const fecha = parseDate(getItem('fecha'))
        const identificacion = cleanId(getItem('id'))
        const cups = normalizeCups(getItem('cups'))

        // Filtrar filas sin PK (fecha + id + cups son obligatorios)
        if (!fecha || !identificacion || !cups) {
            skippedRows++
            continue
        }

        const dedupeKey = `${fecha}|${identificacion}|${cups}`
        if (rowsMap.has(dedupeKey)) {
            fileDuplicates++
            continue
        }

        const rawCantidad = getItem('cantidad')

        const rowData: OrdenamientoRow = {
            fecha,
            tipo_id: getItem('tipo_id').trim(),
            id: identificacion,
            nombres_completos: getItem('nombres_completos').trim(),
            contrato: getItem('contrato').trim(),
            medico: getItem('medico').trim(),
            especialidad: getItem('especialidad').trim(),
            cups,
            cantidad: rawCantidad ? parseInt(rawCantidad, 10) || null : null,
            servicio: getItem('servicio').trim(),
        }

        rowsMap.set(dedupeKey, rowData)
    }

    const dataBatch = Array.from(rowsMap.values())

    if (dataBatch.length === 0) {
        throw new Error('No se encontraron registros válidos para importar.')
    }

    // ═══ Fase 4: Validar CUPS batch (15-30%) ═══
    onProgress('Validando códigos CUPS...', 15)
    const uniqueCups = new Set<string>()
    for (const r of dataBatch) {
        if (r.cups) uniqueCups.add(r.cups)
    }

    const validCupsSet = new Set<string>()
    const cupsArray = Array.from(uniqueCups)

    if (cupsArray.length > 0) {
        const BATCH_SIZE_QUERY = 1000
        for (let i = 0; i < cupsArray.length; i += BATCH_SIZE_QUERY) {
            const chunk = cupsArray.slice(i, i + BATCH_SIZE_QUERY)
            const { data, error } = await supabase
                .from('cups')
                .select('cups')
                .in('cups', chunk)

            if (!error && data) {
                data.forEach(c => {
                    if (c.cups) validCupsSet.add(c.cups.trim())
                })
            }

            const pct = 15 + Math.round(((i + chunk.length) / cupsArray.length) * 15)
            onProgress(`Validando CUPS... ${Math.min(i + BATCH_SIZE_QUERY, cupsArray.length)}/${cupsArray.length}`, pct)
        }
    }

    // ═══ Fase 5: Validar BD nominal batch (30-45%) ═══
    onProgress('Validando base de datos nominal...', 30)
    const uniqueIds = new Set<string>()
    for (const r of dataBatch) {
        if (r.id) uniqueIds.add(r.id)
    }

    const nominalIds = new Set<string>()
    const idsArray = Array.from(uniqueIds)

    if (idsArray.length > 0) {
        const BATCH_SIZE_QUERY = 1000
        for (let i = 0; i < idsArray.length; i += BATCH_SIZE_QUERY) {
            const chunk = idsArray.slice(i, i + BATCH_SIZE_QUERY)
            const { data, error } = await supabase
                .from('bd')
                .select('id')
                .in('id', chunk)

            if (!error && data) {
                data.forEach(r => {
                    if (r.id) nominalIds.add(String(r.id).trim())
                })
            }

            const pct = 30 + Math.round(((i + chunk.length) / idsArray.length) * 15)
            onProgress(`Validando BD nominal... ${Math.min(i + BATCH_SIZE_QUERY, idsArray.length)}/${idsArray.length}`, pct)
        }
    }

    // ═══ Fase 6: Separar válidos de inválidos (45-50%) ═══
    onProgress('Clasificando registros...', 45)
    const invalidCupsRows: { cups: string; nombre: string }[] = []
    const noNominalRows: { id: string; nombre: string; contrato: string }[] = []

    const validRows: OrdenamientoRow[] = []

    for (const r of dataBatch) {
        // CUPS inválido → bloquea
        if (!validCupsSet.has(r.cups)) {
            invalidCupsRows.push({ cups: r.cups, nombre: r.nombres_completos })
            continue
        }

        // BD nominal → solo advertencia, no bloquea
        if (!nominalIds.has(r.id)) {
            noNominalRows.push({ id: r.id, nombre: r.nombres_completos, contrato: r.contrato })
        }

        validRows.push(r)
    }

    // ═══ Fase 7: Enviar a RPC importar_ordenamientos (50-90%) ═══
    onProgress(`Importando ${validRows.length} registros...`, 50)

    let successCount = 0
    let errorCount = 0
    let dbDuplicates = 0

    if (validRows.length > 0) {
        const RPC_BATCH = 2000
        for (let i = 0; i < validRows.length; i += RPC_BATCH) {
            const chunk = validRows.slice(i, i + RPC_BATCH)

            const { data, error } = await supabase.rpc('importar_ordenamientos', {
                datos: chunk,
            })

            if (error) {
                console.error('Error en RPC importar_ordenamientos:', error)
                errorCount += chunk.length
            } else if (data) {
                successCount += (data.insertados || 0)
                dbDuplicates += (data.duplicados || 0)
            }

            const processed = Math.min(i + RPC_BATCH, validRows.length)
            const pct = 50 + Math.round((processed / validRows.length) * 40)
            onProgress(`Procesando... ${processed}/${validRows.length}`, pct)
        }
    }

    // ═══ Fase 8: Generar reporte CSV (90-100%) ═══
    onProgress('Generando reporte...', 90)
    let errorReport: string | undefined
    const reportSections: string[] = []

    if (invalidCupsRows.length > 0) {
        const uniqueCupsMap = new Map<string, { nombre: string; count: number }>()
        invalidCupsRows.forEach(item => {
            const existing = uniqueCupsMap.get(item.cups)
            if (existing) {
                existing.count++
            } else {
                uniqueCupsMap.set(item.cups, { nombre: item.nombre, count: 1 })
            }
        })

        const header = '=== SECCION: CODIGOS CUPS NO ENCONTRADOS ===\nCUPS,EJEMPLO_PACIENTE,REGISTROS_AFECTADOS'
        const rows = Array.from(uniqueCupsMap.entries())
            .map(([cups, { nombre, count }]) => `"${cups}","${nombre}",${count}`)
            .join('\n')
        reportSections.push(`${header}\n${rows}`)
    }

    if (noNominalRows.length > 0) {
        const uniqueNoNominal = new Map<string, { nombre: string; contrato: string }>()
        noNominalRows.forEach(item => {
            if (!uniqueNoNominal.has(item.id)) {
                uniqueNoNominal.set(item.id, { nombre: item.nombre, contrato: item.contrato })
            }
        })

        const header = '=== SECCION: PACIENTES NO ENCONTRADOS EN BD NOMINAL ===\nIDENTIFICACION,NOMBRE,CONTRATO'
        const rows = Array.from(uniqueNoNominal.entries())
            .map(([id, { nombre, contrato }]) => `"${id}","${nombre}","${contrato}"`)
            .join('\n')
        reportSections.push(`${header}\n${rows}`)
    }

    if (reportSections.length > 0) {
        errorReport = reportSections.join('\n\n')
    }

    // Registrar en import_history
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
            tipo_fuente: 'ordenamientos',
            total_registros: rowsMap.size + fileDuplicates + skippedRows,
            exitosos: successCount,
            fallidos: errorCount + invalidCupsRows.length,
            duplicados: fileDuplicates,
            duracion: durationStr,
            detalles: {
                cups_invalidos: invalidCupsRows.length,
                no_nominales: noNominalRows.length,
                filas_omitidas_sin_pk: skippedRows,
                duplicados_archivo: fileDuplicates,
                duplicados_bd: dbDuplicates,
            },
        })
        if (logError) console.error('Error logging history:', logError)
    } catch (e) {
        console.error('Failed to log import history', e)
    }

    onProgress('Importación completada', 100)

    const errorMessages: string[] = []
    if (invalidCupsRows.length > 0) errorMessages.push(`${new Set(invalidCupsRows.map(r => r.cups)).size} códigos CUPS no encontrados`)
    if (noNominalRows.length > 0) errorMessages.push(`${new Set(noNominalRows.map(r => r.id)).size} pacientes no encontrados en BD nominal`)

    return {
        success: successCount,
        errors: errorCount + invalidCupsRows.length,
        duplicates: fileDuplicates,
        totalProcessed: rowsMap.size + fileDuplicates + skippedRows,
        duration: durationStr,
        errorReport,
        errorMessage: errorMessages.length > 0 ? errorMessages.join('. ') + '.' : undefined,
    }
}
