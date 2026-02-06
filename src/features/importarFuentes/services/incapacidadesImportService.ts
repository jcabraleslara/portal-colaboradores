/**
 * Servicio de importación para Incapacidades
 * Procesa archivos XLS (HTML) del sistema clínico
 * Tabla destino: public.incapacidades (PK: fecha, id)
 * FK: dx1 → cie10(cie10)
 */

import { supabase } from '@/config/supabase.config'
import type { ImportResult, ImportProgressCallback } from '../types/import.types'

export interface IncapacidadRow {
    fecha: string | null
    tipo_id: string
    id: string
    nombres_completos: string
    contrato: string
    dx1: string | null
    medico: string
    especialidad: string
    fecha_inicio: string | null
    fecha_fin: string | null
    dias_incapacidad: number | null
    justificacion: string
}

/** Mapeo de encabezados HTML a columnas de BD */
const COLUMN_MAP: Record<string, keyof IncapacidadRow> = {
    'FECHAATENCION': 'fecha',
    'TIPOIDENTIFICACION': 'tipo_id',
    'IDENTIFICACION': 'id',
    'NOMBRESCOMPLETOS': 'nombres_completos',
    'CONVENIOCONTRATO': 'contrato',
    'DIAGNOSTICOCIE10': 'dx1',
    'MEDICOTRATANTE': 'medico',
    'ESPECIALIDADES': 'especialidad',
    'FECHAINICIOINCAPACIDAD': 'fecha_inicio',
    'FECHAFININCAPACIDAD': 'fecha_fin',
    'DIASINCAPACIDAD': 'dias_incapacidad',
    'DIAGNOSTICODESCRIPCION': 'justificacion',
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
 * Procesa archivo de incapacidades (XLS/HTML)
 * Usa RPC `importar_incapacidades` para alto rendimiento
 */
export async function processIncapacidadesFile(
    file: File,
    onProgress: ImportProgressCallback
): Promise<ImportResult> {
    const startTime = performance.now()

    // ═══ Fase 1: Leer + parsear HTML (0-5%) ═══
    onProgress('Leyendo archivo...', 0)
    const text = await file.text()

    onProgress('Analizando estructura HTML...', 3)
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'text/html')

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

            // Buscar encabezados clave de incapacidades
            if (cells.includes('FECHAATENCION') && cells.includes('IDENTIFICACION')) {
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
        throw new Error('No se encontró la tabla de incapacidades en el archivo. Verifique que el archivo sea correcto.')
    }

    if (columnIndices['fecha'] === undefined || columnIndices['id'] === undefined) {
        throw new Error('No se encontraron las columnas FechaAtencion e Identificacion requeridas.')
    }

    // ═══ Fase 3: Extraer filas + dedup (10-15%) ═══
    onProgress('Extrayendo datos...', 10)
    const fileRows = Array.from(targetTable.rows).slice(headerRowIndex + 1)
    const rowsMap = new Map<string, IncapacidadRow>()
    let fileDuplicates = 0
    let skippedRows = 0

    for (const row of fileRows) {
        const cells = row.cells
        if (cells.length < 3) continue

        const getItem = (col: keyof IncapacidadRow): string => {
            const idx = columnIndices[col]
            if (idx === undefined || idx >= cells.length) return ''
            return cells[idx].textContent?.trim() || ''
        }

        const fecha = parseDate(getItem('fecha'))
        const identificacion = cleanId(getItem('id'))

        // Filtrar filas sin PK (fecha + id son obligatorios)
        if (!fecha || !identificacion) {
            skippedRows++
            continue
        }

        const dedupeKey = `${fecha}|${identificacion}`
        if (rowsMap.has(dedupeKey)) {
            fileDuplicates++
            continue
        }

        const rawDias = getItem('dias_incapacidad')

        const rowData: IncapacidadRow = {
            fecha,
            tipo_id: getItem('tipo_id').trim(),
            id: identificacion,
            nombres_completos: getItem('nombres_completos').trim(),
            contrato: getItem('contrato').trim(),
            dx1: getItem('dx1').trim().toUpperCase() || null,
            medico: getItem('medico').trim(),
            especialidad: getItem('especialidad').trim(),
            fecha_inicio: parseDate(getItem('fecha_inicio')),
            fecha_fin: parseDate(getItem('fecha_fin')),
            dias_incapacidad: rawDias ? parseInt(rawDias, 10) || null : null,
            justificacion: getItem('justificacion').trim(),
        }

        rowsMap.set(dedupeKey, rowData)
    }

    const dataBatch = Array.from(rowsMap.values())

    if (dataBatch.length === 0) {
        throw new Error('No se encontraron registros válidos para importar.')
    }

    // ═══ Fase 4: Validar CIE10 batch (15-30%) ═══
    onProgress('Validando códigos CIE10...', 15)
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

            const pct = 15 + Math.round(((i + chunk.length) / cie10Array.length) * 15)
            onProgress(`Validando CIE10... ${Math.min(i + BATCH_SIZE_QUERY, cie10Array.length)}/${cie10Array.length}`, pct)
        }
    }

    // ═══ Fase 5: Validar BD nominal (30-45%) - advertencia, no bloquea ═══
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

    // ═══ Fase 6: Separar válidos de inválidos CIE10 (45-50%) ═══
    onProgress('Clasificando registros...', 45)
    const invalidCie10Rows: { id: string; dx1: string; nombres: string }[] = []
    const noNominalRows: { id: string; nombres: string; contrato: string }[] = []

    for (const r of dataBatch) {
        if (r.dx1 && !validCie10Set.has(r.dx1)) {
            invalidCie10Rows.push({
                id: r.id,
                dx1: r.dx1,
                nombres: r.nombres_completos,
            })
        }
        if (!nominalIds.has(r.id)) {
            noNominalRows.push({
                id: r.id,
                nombres: r.nombres_completos,
                contrato: r.contrato,
            })
        }
    }

    // ═══ Fase 7: Enviar a RPC importar_incapacidades (50-90%) ═══
    onProgress(`Importando ${dataBatch.length} registros...`, 50)

    let successCount = 0
    let errorCount = 0
    let dbDuplicates = 0
    let cie10Invalidos = 0

    // Enviar en chunks de 2000 para no exceder límites de payload
    const RPC_BATCH = 2000
    for (let i = 0; i < dataBatch.length; i += RPC_BATCH) {
        const chunk = dataBatch.slice(i, i + RPC_BATCH)

        const { data, error } = await supabase.rpc('importar_incapacidades', {
            datos: chunk,
        })

        if (error) {
            console.error('Error en RPC importar_incapacidades:', error)
            errorCount += chunk.length
        } else if (data) {
            // Tanto insertados como actualizados son importaciones exitosas
            successCount += (data.insertados || 0) + (data.actualizados || 0)
            dbDuplicates += (data.actualizados || 0)
            cie10Invalidos += (data.cie10_invalidos || 0)
        }

        const processed = Math.min(i + RPC_BATCH, dataBatch.length)
        const pct = 50 + Math.round((processed / dataBatch.length) * 40)
        onProgress(`Procesando... ${processed}/${dataBatch.length}`, pct)
    }

    // ═══ Fase 8: Generar reporte CSV (90-95%) ═══
    onProgress('Generando reporte...', 90)
    let errorReport: string | undefined
    const reportSections: string[] = []

    if (invalidCie10Rows.length > 0) {
        const uniqueCie10Map = new Map<string, string>()
        invalidCie10Rows.forEach(item => {
            if (!uniqueCie10Map.has(item.dx1)) {
                uniqueCie10Map.set(item.dx1, item.nombres)
            }
        })

        const header = '=== SECCION: CODIGOS CIE10 NO ENCONTRADOS ===\nCIE10,EJEMPLO_PACIENTE,REGISTROS_AFECTADOS'
        const rows = Array.from(uniqueCie10Map.entries())
            .map(([dx1, nombres]) => {
                const count = invalidCie10Rows.filter(r => r.dx1 === dx1).length
                return `"${dx1}","${nombres}",${count}`
            })
            .join('\n')
        reportSections.push(`${header}\n${rows}`)
    }

    if (noNominalRows.length > 0) {
        // Dedup por ID
        const uniqueNoNominal = new Map<string, { nombres: string; contrato: string }>()
        noNominalRows.forEach(item => {
            if (!uniqueNoNominal.has(item.id)) {
                uniqueNoNominal.set(item.id, { nombres: item.nombres, contrato: item.contrato })
            }
        })

        const header = '=== SECCION: PACIENTES NO ENCONTRADOS EN BD NOMINAL ===\nIDENTIFICACION,NOMBRE,CONTRATO'
        const rows = Array.from(uniqueNoNominal.entries())
            .map(([id, { nombres, contrato }]) => `"${id}","${nombres}","${contrato}"`)
            .join('\n')
        reportSections.push(`${header}\n${rows}`)
    }

    if (reportSections.length > 0) {
        errorReport = reportSections.join('\n\n')
    }

    // ═══ Fase 9: Registrar en import_history (95-100%) ═══
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
            tipo_fuente: 'incapacidades',
            total_registros: rowsMap.size + fileDuplicates + skippedRows,
            exitosos: successCount,
            fallidos: errorCount + cie10Invalidos,
            duplicados: fileDuplicates,
            duracion: durationStr,
            detalles: {
                cie10_invalidos: cie10Invalidos,
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
    if (cie10Invalidos > 0) errorMessages.push(`${cie10Invalidos} registros con CIE10 inválido`)
    if (noNominalRows.length > 0) errorMessages.push(`${new Set(noNominalRows.map(r => r.id)).size} pacientes no encontrados en BD nominal`)

    return {
        success: successCount,
        errors: errorCount + cie10Invalidos,
        duplicates: fileDuplicates,
        totalProcessed: rowsMap.size + fileDuplicates + skippedRows,
        duration: durationStr,
        errorReport,
        errorMessage: errorMessages.length > 0 ? errorMessages.join('. ') + '.' : undefined,
    }
}
