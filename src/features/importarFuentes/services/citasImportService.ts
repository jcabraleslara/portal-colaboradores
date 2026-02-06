/**
 * Servicio de importación para Citas
 * Procesa archivos XLS/XLSX del sistema de agenda
 */

import { supabase } from '@/config/supabase.config'
import type { ImportResult, ImportProgressCallback } from '../types/import.types'
import { parseSpreadsheetFile } from '../utils/parseSpreadsheet'

export interface CitaRow {
    id_cita: string
    tipo_id: string
    identificacion: string
    nombres_completos: string
    fecha_asignacion: string | null
    fecha_cita: string | null
    estado_cita: string
    asunto: string
    sede: string
    contrato: string
    medico: string
    especialidad: string
    tipo_cita: string
    cups: string
    procedimiento: string
    unidad_funcional: string
    dx1: string | null
    dx2: string | null
    dx3: string | null
    dx4: string | null
    duracion: string | null
    sexo: string | null
    edad: number | null
    usuario_agenda: string | null
    usuario_confirma: string | null
    fecha_nacimiento_temp?: string | null
}

/** Mapeo de encabezados HTML a columnas de BD */
const COLUMN_MAP: Record<string, keyof CitaRow> = {
    'ID CITA': 'id_cita',
    'TIPO IDENT.': 'tipo_id',
    'No. IDENTIFICACION': 'identificacion',
    'PACIENTE': 'nombres_completos',
    'FECHA ASIGNACION': 'fecha_asignacion',
    'FECHA ATENCION': 'fecha_cita',
    'ESTADO': 'estado_cita',
    'ASUNTO': 'asunto',
    'P. ATENCION': 'sede',
    'CONTRATO': 'contrato',
    'USUARIO': 'usuario_agenda',
    'MEDICO': 'medico',
    'ESP. MEDICO': 'especialidad',
    'TIPO DE CITA': 'tipo_cita',
    'CUPS': 'cups',
    'PROCEDIMIENTO': 'procedimiento',
    'UNIDAD FUNCIONAL': 'unidad_funcional',
    'DIAGNOSTICO': 'dx1',
    'D. RELACIONADO1': 'dx2',
    'D. RELACIONADO2': 'dx3',
    'D. RELACIONADO3': 'dx4',
    'FECHA TIEMPO EN CONSULTA': 'duracion',
    'SEXO': 'sexo',
    'F.NACIMIENTO': 'fecha_nacimiento_temp',
    'USUARIO CONFIRMA': 'usuario_confirma'
}

/** Normaliza encabezados (elimina acentos, espacios extra) */
const normalizeHeader = (h: string): string => {
    return h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase()
}

/** Parsea fechas en múltiples formatos */
const parseDate = (val: string): string | null => {
    if (!val || !val.trim()) return null
    const trimmed = val.trim()

    // DD/MM/YYYY
    const legacyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (legacyMatch) {
        return `${legacyMatch[3]}-${legacyMatch[2].padStart(2, '0')}-${legacyMatch[1].padStart(2, '0')}`
    }

    // YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    }

    return null
}

/** Calcula edad entre dos fechas */
const calculateAge = (birthDateStr: string | null, refDateStr: string | null): number | null => {
    if (!birthDateStr || !refDateStr) return null

    const d1 = new Date(birthDateStr)
    const d2 = new Date(refDateStr)

    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null

    let age = d2.getFullYear() - d1.getFullYear()
    const m = d2.getMonth() - d1.getMonth()
    if (m < 0 || (m === 0 && d2.getDate() < d1.getDate())) {
        age--
    }
    return age >= 0 ? age : 0
}

/** Limpia duración: "18 Minutos" -> "18 minutes" */
const cleanDuration = (val: string): string | null => {
    if (!val) return null
    const match = val.match(/-?(\d+)/)
    return match ? `${match[1]} minutes` : null
}

/**
 * Procesa archivo de citas (XLS/HTML)
 */
export async function processCitasFile(
    file: File,
    onProgress: ImportProgressCallback
): Promise<ImportResult> {
    const startTime = performance.now()

    // 1. Leer y parsear archivo (HTML, XLS o XLSX)
    onProgress('Leyendo archivo...', 0)
    const doc = await parseSpreadsheetFile(file)

    // 2. Analizar estructura
    onProgress('Analizando estructura...', 5)

    // 3. Encontrar tabla principal
    const tables = doc.querySelectorAll('table')
    let targetTable: HTMLTableElement | null = null
    let headerRowIndex = -1
    const columnIndices: Record<string, number> = {}

    for (const table of Array.from(tables)) {
        const rows = Array.from(table.rows)
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const row = rows[i]
            const cells = Array.from(row.cells).map(c => normalizeHeader(c.textContent || ''))

            if (cells.includes('ID CITA') && cells.includes('PACIENTE')) {
                targetTable = table
                headerRowIndex = i

                // Primera pasada: coincidencias exactas
                cells.forEach((headerText, index) => {
                    const dbCol = COLUMN_MAP[headerText]
                    if (dbCol && columnIndices[dbCol] === undefined) {
                        columnIndices[dbCol] = index
                    }
                })

                // Segunda pasada: coincidencias fuzzy
                cells.forEach((headerText, index) => {
                    const key = Object.keys(COLUMN_MAP).find(k => {
                        if (columnIndices[COLUMN_MAP[k]] !== undefined) return false
                        const normalizedKey = normalizeHeader(k)
                        const lengthDiff = Math.abs(headerText.length - normalizedKey.length)
                        if (lengthDiff > 3) return false
                        return headerText.includes(normalizedKey) || normalizedKey.includes(headerText)
                    })
                    if (key) {
                        const dbCol = COLUMN_MAP[key]
                        if (columnIndices[dbCol] === undefined) {
                            columnIndices[dbCol] = index
                        }
                    }
                })
                break
            }
        }
        if (targetTable) break
    }

    if (!targetTable) {
        throw new Error('No se encontró la tabla de citas válida en el archivo.')
    }

    if (!columnIndices['id_cita']) {
        throw new Error('No se encontró la columna ID CITA requerida.')
    }

    // 4. Validar CUPS
    onProgress('Validando códigos CUPS...', 10)
    const fileRows = Array.from(targetTable.rows).slice(headerRowIndex + 1)
    const uniqueCupsInFile = new Set<string>()
    const cupsIndex = columnIndices['cups']

    if (cupsIndex !== undefined) {
        for (const row of fileRows) {
            const val = row.cells[cupsIndex]?.textContent?.trim()
            if (val) {
                uniqueCupsInFile.add(val.substring(0, 6).toUpperCase())
            }
        }
    }

    const validCupsSet = new Set<string>()
    const uniqueCupsArray = Array.from(uniqueCupsInFile)

    if (uniqueCupsArray.length > 0) {
        const BATCH_SIZE_QUERY = 1000
        for (let i = 0; i < uniqueCupsArray.length; i += BATCH_SIZE_QUERY) {
            const chunk = uniqueCupsArray.slice(i, i + BATCH_SIZE_QUERY)
            const { data, error } = await supabase
                .from('cups')
                .select('cups')
                .in('cups', chunk)

            if (!error && data) {
                data.forEach(c => c.cups && validCupsSet.add(c.cups.trim().toUpperCase()))
            }
        }
    }

    const invalidCupsList: { id_cita: string; cups: string; descripcion: string }[] = []

    // 5. Extraer datos
    onProgress('Extrayendo datos...', 15)
    const rowsMap = new Map<string, CitaRow>()
    let duplicates = 0

    const rows = Array.from(targetTable.rows).slice(headerRowIndex + 1)

    for (const row of rows) {
        const cells = row.cells
        if (cells.length < 2) continue

        const getItem = (col: keyof CitaRow) => {
            const idx = columnIndices[col]
            if (idx === undefined || idx >= cells.length) return ''
            return cells[idx].textContent?.trim() || ''
        }

        const id_cita = getItem('id_cita')
        if (!id_cita) continue

        if (rowsMap.has(id_cita)) {
            duplicates++
        }

        const fecha_nacimiento_raw = parseDate(getItem('fecha_nacimiento_temp'))
        const fecha_asignacion = parseDate(getItem('fecha_asignacion'))
        const finalAge = calculateAge(fecha_nacimiento_raw, fecha_asignacion)

        const rawEstado = getItem('estado_cita')
        const estado_clean = rawEstado ? rawEstado.split(' -')[0].trim() : ''

        const rowData: CitaRow = {
            id_cita,
            tipo_id: getItem('tipo_id'),
            identificacion: getItem('identificacion'),
            nombres_completos: getItem('nombres_completos'),
            fecha_asignacion,
            fecha_cita: parseDate(getItem('fecha_cita')),
            estado_cita: estado_clean,
            asunto: getItem('asunto'),
            sede: getItem('sede'),
            contrato: getItem('contrato'),
            medico: getItem('medico'),
            especialidad: getItem('especialidad'),
            tipo_cita: getItem('tipo_cita'),
            cups: getItem('cups'),
            procedimiento: getItem('procedimiento'),
            unidad_funcional: getItem('unidad_funcional'),
            dx1: getItem('dx1'),
            dx2: getItem('dx2') || null,
            dx3: getItem('dx3') || null,
            dx4: getItem('dx4') || null,
            duracion: cleanDuration(getItem('duracion')),
            sexo: getItem('sexo') || null,
            edad: finalAge,
            usuario_agenda: getItem('usuario_agenda') || null,
            usuario_confirma: getItem('usuario_confirma') || null
        }

        // Validar CUPS
        const rowCupsFull = rowData.cups?.trim().toUpperCase()
        const rowCupsShort = rowCupsFull ? rowCupsFull.substring(0, 6) : ''

        if (rowCupsShort && !validCupsSet.has(rowCupsShort)) {
            invalidCupsList.push({
                id_cita: rowData.id_cita,
                cups: rowCupsFull || '',
                descripcion: rowData.procedimiento || 'Sin descripción'
            })
        }

        delete rowData.fecha_nacimiento_temp
        rowsMap.set(id_cita, rowData)
    }

    const dataBatch = Array.from(rowsMap.values())

    // 6. Upsert a Supabase
    onProgress(`Subiendo ${dataBatch.length} registros únicos...`, 20)

    const BATCH_SIZE = 100
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < dataBatch.length; i += BATCH_SIZE) {
        const chunk = dataBatch.slice(i, i + BATCH_SIZE)

        const { error } = await supabase
            .from('citas')
            .upsert(chunk, { onConflict: 'id_cita' })

        if (error) {
            console.error('Error importing batch:', error)
            errorCount += chunk.length
        } else {
            successCount += chunk.length
        }

        const processed = Math.min(i + BATCH_SIZE, dataBatch.length)
        const percentage = 20 + Math.round((processed / dataBatch.length) * 80)
        onProgress(`Procesando... ${processed} / ${dataBatch.length}`, percentage)
    }

    const endTime = performance.now()
    const durationSeconds = Math.round((endTime - startTime) / 1000)
    const minutes = Math.floor(durationSeconds / 60)
    const seconds = durationSeconds % 60
    const durationStr = `${minutes}m ${seconds}s`

    // Generar reporte CSV de CUPS inválidos
    let errorReport: string | undefined
    if (invalidCupsList.length > 0) {
        const uniqueCupsMap = new Map<string, string>()
        invalidCupsList.forEach(item => {
            if (!uniqueCupsMap.has(item.cups)) {
                uniqueCupsMap.set(item.cups, item.descripcion)
            }
        })

        const headers = 'CUPS_NO_ENCONTRADO,DESCRIPCION_EJEMPLO\n'
        const csvRows = Array.from(uniqueCupsMap.entries())
            .map(([cups, desc]) => `"${cups}","${desc}"`)
            .join('\n')
        errorReport = headers + csvRows
    }

    // 7. Registrar en historial
    try {
        const { error: logError } = await supabase.from('import_history').insert({
            usuario: (await supabase.auth.getUser()).data.user?.email || 'unknown',
            archivo_nombre: file.name,
            tipo_fuente: 'citas',
            total_registros: rowsMap.size + duplicates,
            exitosos: successCount,
            fallidos: errorCount,
            duplicados: duplicates,
            duracion: durationStr,
            detalles: {
                invalid_cups_count: invalidCupsList.length
            }
        })
        if (logError) console.error('Error logging history:', logError)
    } catch (e) {
        console.error('Failed to log import history', e)
    }

    return {
        success: successCount,
        errors: errorCount,
        duplicates,
        totalProcessed: rowsMap.size + duplicates,
        duration: durationStr,
        errorReport,
        errorMessage: errorReport ? 'Algunos códigos CUPS no existen en el maestro.' : undefined
    }
}
