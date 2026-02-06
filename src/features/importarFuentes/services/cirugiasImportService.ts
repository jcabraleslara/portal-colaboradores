/**
 * Servicio de importación para Cirugías
 * Procesa archivos XLS/XLSX del sistema clínico
 * Tabla destino: public.cirugias (PK: fecha, id, cups)
 * FK: cups → cups(cups), dx1 → cie10(cie10)
 */

import { supabase } from '@/config/supabase.config'
import type { ImportResult, ImportProgressCallback } from '../types/import.types'
import { parseSpreadsheetFile } from '../utils/parseSpreadsheet'

export interface CirugiaRow {
    fecha: string | null
    tipo_id: string
    id: string
    apellido1: string
    apellido2: string
    nombre1: string
    nombre2: string
    edad: number | null
    contrato: string
    dx1: string | null
    medico: string
    especialidad: string
    ayudante: string
    anestesiologo: string
    cups: string
    sede: string
}

/** Mapeo de encabezados HTML a columnas de BD */
const COLUMN_MAP: Record<string, keyof CirugiaRow> = {
    'FECHA': 'fecha',
    'TIPOID': 'tipo_id',
    'IDPCTE': 'id',
    'PRIMERAPELLIDO': 'apellido1',
    'SEGUNDOAPELLIDO': 'apellido2',
    'PRIMERNOMBRE': 'nombre1',
    'SEGUNDONOMBRE': 'nombre2',
    'EDAD': 'edad',
    'CONTRATO': 'contrato',
    'DXPRINCIPAL': 'dx1',
    'MEDICO': 'medico',
    'ESPECIALIDAD': 'especialidad',
    'AYUDANTE': 'ayudante',
    'ANESTESIOLOGO': 'anestesiologo',
    'CUPS': 'cups',
    'SEDE': 'sede',
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
    // (el sistema clínico rellena con ceros a la derecha)
    if (cups.length > 6) cups = cups.substring(0, 6)

    // Pad con cero a la izquierda si tiene 5 dígitos (ej: 70101 → 070101)
    if (cups.length === 5) cups = '0' + cups

    // CUPS válido debe tener exactamente 6 dígitos
    return cups.length === 6 ? cups : null
}

/**
 * Procesa archivo de cirugías (XLS/HTML)
 * Usa RPC `importar_cirugias` para alto rendimiento
 */
export async function processCirugiasFile(
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

            // Buscar encabezados clave de cirugías
            if (cells.includes('FECHA') && cells.includes('IDPCTE') && cells.includes('CUPS')) {
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
        throw new Error('No se encontró la tabla de cirugías en el archivo. Verifique que el archivo sea correcto.')
    }

    if (columnIndices['fecha'] === undefined || columnIndices['id'] === undefined || columnIndices['cups'] === undefined) {
        throw new Error('No se encontraron las columnas Fecha, IdPcte y Cups requeridas.')
    }

    // ═══ Fase 3: Extraer filas + normalizar CUPS + dedup (10-15%) ═══
    onProgress('Extrayendo datos...', 10)
    const fileRows = Array.from(targetTable.rows).slice(headerRowIndex + 1)
    const rowsMap = new Map<string, CirugiaRow>()
    let fileDuplicates = 0
    let skippedRows = 0

    for (const row of fileRows) {
        const cells = row.cells
        if (cells.length < 3) continue

        const getItem = (col: keyof CirugiaRow): string => {
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

        const rawEdad = getItem('edad')

        const rowData: CirugiaRow = {
            fecha,
            tipo_id: getItem('tipo_id').trim(),
            id: identificacion,
            apellido1: getItem('apellido1').trim(),
            apellido2: getItem('apellido2').trim(),
            nombre1: getItem('nombre1').trim(),
            nombre2: getItem('nombre2').trim(),
            edad: rawEdad ? parseInt(rawEdad, 10) || null : null,
            contrato: getItem('contrato').trim(),
            dx1: getItem('dx1').trim().toUpperCase() || null,
            medico: getItem('medico').trim(),
            especialidad: getItem('especialidad').trim(),
            ayudante: getItem('ayudante').trim(),
            anestesiologo: getItem('anestesiologo').trim(),
            cups,
            sede: getItem('sede').trim(),
        }

        rowsMap.set(dedupeKey, rowData)
    }

    const dataBatch = Array.from(rowsMap.values())

    if (dataBatch.length === 0) {
        throw new Error('No se encontraron registros válidos para importar.')
    }

    // ═══ Fase 4: Validar CUPS batch (15-25%) ═══
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

            const pct = 15 + Math.round(((i + chunk.length) / cupsArray.length) * 10)
            onProgress(`Validando CUPS... ${Math.min(i + BATCH_SIZE_QUERY, cupsArray.length)}/${cupsArray.length}`, pct)
        }
    }

    // ═══ Fase 5: Validar CIE10 batch (25-35%) ═══
    onProgress('Validando códigos CIE10...', 25)
    const uniqueCie10 = new Set<string>()
    for (const r of dataBatch) {
        if (r.dx1) uniqueCie10.add(r.dx1)
    }

    const validCie10Set = new Set<string>()
    const cie10Array = Array.from(uniqueCie10)

    if (cie10Array.length > 0) {
        const BATCH_SIZE_QUERY = 1000
        for (let i = 0; i < cie10Array.length; i += BATCH_SIZE_QUERY) {
            const chunk = cie10Array.slice(i, i + BATCH_SIZE_QUERY)
            const { data, error } = await supabase
                .from('cie10')
                .select('cie10')
                .in('cie10', chunk)

            if (!error && data) {
                data.forEach(c => {
                    if (c.cie10) validCie10Set.add(c.cie10.trim().toUpperCase())
                })
            }

            const pct = 25 + Math.round(((i + chunk.length) / cie10Array.length) * 10)
            onProgress(`Validando CIE10... ${Math.min(i + BATCH_SIZE_QUERY, cie10Array.length)}/${cie10Array.length}`, pct)
        }
    }

    // ═══ Fase 6: Validar BD nominal batch (35-45%) ═══
    onProgress('Validando base de datos nominal...', 35)
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

            const pct = 35 + Math.round(((i + chunk.length) / idsArray.length) * 10)
            onProgress(`Validando BD nominal... ${Math.min(i + BATCH_SIZE_QUERY, idsArray.length)}/${idsArray.length}`, pct)
        }
    }

    // ═══ Fase 7: Separar válidos de inválidos (45-50%) ═══
    onProgress('Clasificando registros...', 45)
    const invalidCupsRows: { cups: string; nombre: string }[] = []
    const invalidCie10Rows: { id: string; dx1: string; nombre: string }[] = []
    const noNominalRows: { id: string; nombre: string; contrato: string }[] = []

    const validRows: CirugiaRow[] = []

    for (const r of dataBatch) {
        const nombreCompleto = [r.nombre1, r.nombre2, r.apellido1, r.apellido2].filter(Boolean).join(' ')

        // CUPS inválido → bloquea
        if (!validCupsSet.has(r.cups)) {
            invalidCupsRows.push({ cups: r.cups, nombre: nombreCompleto })
            continue
        }

        // CIE10 inválido (solo si dx1 no es null) → bloquea
        if (r.dx1 && !validCie10Set.has(r.dx1)) {
            invalidCie10Rows.push({ id: r.id, dx1: r.dx1, nombre: nombreCompleto })
            continue
        }

        // BD nominal → solo advertencia, no bloquea
        if (!nominalIds.has(r.id)) {
            noNominalRows.push({ id: r.id, nombre: nombreCompleto, contrato: r.contrato })
        }

        validRows.push(r)
    }

    // ═══ Fase 8: Enviar a RPC importar_cirugias (50-90%) ═══
    onProgress(`Importando ${validRows.length} registros...`, 50)

    let successCount = 0
    let errorCount = 0
    let dbDuplicates = 0

    if (validRows.length > 0) {
        const RPC_BATCH = 2000
        for (let i = 0; i < validRows.length; i += RPC_BATCH) {
            const chunk = validRows.slice(i, i + RPC_BATCH)

            const { data, error } = await supabase.rpc('importar_cirugias', {
                datos: chunk,
            })

            if (error) {
                console.error('Error en RPC importar_cirugias:', error)
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

    // ═══ Fase 9: Generar reporte CSV (90-100%) ═══
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

    if (invalidCie10Rows.length > 0) {
        const uniqueCie10Map = new Map<string, { nombre: string; count: number }>()
        invalidCie10Rows.forEach(item => {
            const existing = uniqueCie10Map.get(item.dx1)
            if (existing) {
                existing.count++
            } else {
                uniqueCie10Map.set(item.dx1, { nombre: item.nombre, count: 1 })
            }
        })

        const header = '=== SECCION: CODIGOS CIE10 NO ENCONTRADOS ===\nCIE10,EJEMPLO_PACIENTE,REGISTROS_AFECTADOS'
        const rows = Array.from(uniqueCie10Map.entries())
            .map(([dx1, { nombre, count }]) => `"${dx1}","${nombre}",${count}`)
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
            tipo_fuente: 'cirugias',
            total_registros: rowsMap.size + fileDuplicates + skippedRows,
            exitosos: successCount,
            fallidos: errorCount + invalidCupsRows.length + invalidCie10Rows.length,
            duplicados: fileDuplicates,
            duracion: durationStr,
            detalles: {
                cups_invalidos: invalidCupsRows.length,
                cie10_invalidos: invalidCie10Rows.length,
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
    if (invalidCie10Rows.length > 0) errorMessages.push(`${new Set(invalidCie10Rows.map(r => r.dx1)).size} códigos CIE10 no encontrados`)
    if (noNominalRows.length > 0) errorMessages.push(`${new Set(noNominalRows.map(r => r.id)).size} pacientes no encontrados en BD nominal`)

    return {
        success: successCount,
        errors: errorCount + invalidCupsRows.length + invalidCie10Rows.length,
        duplicates: fileDuplicates,
        totalProcessed: rowsMap.size + fileDuplicates + skippedRows,
        duration: durationStr,
        errorReport,
        errorMessage: errorMessages.length > 0 ? errorMessages.join('. ') + '.' : undefined,
    }
}
