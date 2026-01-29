
import { supabase } from '@/config/supabase.config'

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
    dx1: string
    dx2: string
    dx3: string
    dx4: string
    duracion: string
}

/**
 * Maps HTML header text to database column name
 */
const COLUMN_MAP: Record<string, keyof CitaRow> = {
    'ID CITA': 'id_cita',
    'TIPO ID': 'tipo_id',
    'NUMERO ID': 'identificacion', // Assumed name in file based on user feedback
    'PACIENTE': 'nombres_completos',
    'FECHA ASIGNACION': 'fecha_asignacion',
    'FECHA CITA': 'fecha_cita',
    'ESTADO': 'estado_cita',
    'ASUNTO': 'asunto',
    'SEDE': 'sede',
    'CONTRATO': 'contrato',
    'MEDICO': 'medico',
    'ESPECIALIDAD': 'especialidad',
    'TIPO CITA': 'tipo_cita',
    'CUPS': 'cups',
    'PROCEDIMIENTO': 'procedimiento',
    'UNIDAD FUNCIONAL': 'unidad_funcional',
    'DIAGNOSTICO': 'dx1',
    'D. RELACIONADO1': 'dx2',
    'D. RELACIONADO2': 'dx3',
    'D. RELACIONADO3': 'dx4',
    'DURACION': 'duracion'
}

/**
 * Process the uploaded specific "Fake XLS" HTML file
 */
export async function processCitasFile(
    file: File,
    onProgress: (status: string) => void
): Promise<{ success: number; errors: number }> {

    // 1. Read file as text
    onProgress('Leyendo archivo...')
    const text = await file.text()

    // 2. Parse HTML
    onProgress('Analizando estructura HTML...')
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'text/html')

    // 3. Find the main table
    // Strategy: Find row with specific headers
    const tables = doc.querySelectorAll('table')
    let targetTable: HTMLTableElement | null = null
    let headerRowIndex = -1
    let columnIndices: Record<string, number> = {} // maps db_col -> index

    for (const table of Array.from(tables)) {
        const rows = Array.from(table.rows)

        for (let i = 0; i < Math.min(rows.length, 20); i++) { // Check first 20 rows for header
            const row = rows[i]
            const cells = Array.from(row.cells).map(c => c.textContent?.trim().toUpperCase() || '')

            // Check if this row looks like the header
            if (cells.includes('ID CITA') && cells.includes('PACIENTE')) {
                targetTable = table
                headerRowIndex = i

                // Build index map
                cells.forEach((headerText, index) => {
                    // Try exact match first
                    let dbCol = COLUMN_MAP[headerText]

                    // Fuzzy match logic if needed (e.g. "CONTRATO..." )
                    if (!dbCol) {
                        const key = Object.keys(COLUMN_MAP).find(k => headerText.includes(k))
                        if (key) dbCol = COLUMN_MAP[key]
                    }

                    if (dbCol) {
                        columnIndices[dbCol] = index
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

    // 4. Extract Data
    onProgress('Extrayendo datos...')
    const dataBatch: CitaRow[] = []
    const rows = Array.from(targetTable.rows).slice(headerRowIndex + 1)

    // Helper to parse dates (DD/MM/YYYY -> YYYY-MM-DD)
    const parseDate = (val: string) => {
        if (!val) return null
        // Assuming format DD/MM/YYYY HH:MM or similar
        // Just regex for DD/MM/YYYY
        const match = val.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
        if (match) {
            return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
        }
        return null // or return original if ISO?
    }

    for (const row of rows) {
        const cells = row.cells

        // Skip empty rows
        if (cells.length < 2) continue

        const getItem = (col: keyof CitaRow) => {
            const idx = columnIndices[col]
            if (idx === undefined || idx >= cells.length) return ''
            return cells[idx].textContent?.trim() || ''
        }

        const id_cita = getItem('id_cita')
        if (!id_cita) continue // Skip invalid rows without ID

        const rowData: CitaRow = {
            id_cita,
            tipo_id: getItem('tipo_id'),
            identificacion: getItem('identificacion'),
            nombres_completos: getItem('nombres_completos'),
            fecha_asignacion: parseDate(getItem('fecha_asignacion')),
            fecha_cita: parseDate(getItem('fecha_cita')), // Note: if source has time, parseDate might need adjustment if DB is date-only
            estado_cita: getItem('estado_cita'),
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
            dx2: getItem('dx2'),
            dx3: getItem('dx3'),
            dx4: getItem('dx4'),
            duracion: getItem('duracion')
        }

        dataBatch.push(rowData)
    }

    // 5. Upsert to Supabase
    onProgress(`Subiendo ${dataBatch.length} registros...`)

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

        onProgress(`Procesando... ${Math.min(i + BATCH_SIZE, dataBatch.length)} / ${dataBatch.length}`)
    }

    return { success: successCount, errors: errorCount }
}
