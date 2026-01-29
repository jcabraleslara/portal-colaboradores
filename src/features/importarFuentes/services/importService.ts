
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
    dx1: string | null
    dx2: string | null
    dx3: string | null
    dx4: string | null
    duracion: string | null
    sexo: string | null
    edad: number | null
    usuario_agenda: string | null
    usuario_confirma: string | null
}

/**
 * Maps HTML header text to database column name
 */
const COLUMN_MAP: Record<string, keyof CitaRow> = {
    'ID CITA': 'id_cita',
    'TIPO ID': 'tipo_id',
    'NUMERO ID': 'identificacion',
    'IDENTIFICACION': 'identificacion', // Alias
    'DOCUMENTO': 'identificacion', // Alias
    'PACIENTE': 'nombres_completos',
    'NOMBRE': 'nombres_completos', // Alias
    'FECHA ASIGNACION': 'fecha_asignacion',
    'FECHA SOLICITUD': 'fecha_asignacion', // Alias
    'FECHA ATENCION': 'fecha_cita',
    'FECHA CITA': 'fecha_cita', // Alias
    'ESTADO': 'estado_cita',
    'ASUNTO': 'asunto',
    'SEDE': 'sede',
    'CENTRO': 'sede', // Alias
    'CONTRATO': 'contrato',
    'MEDICO': 'medico',
    'PROFESIONAL': 'medico', // Alias
    'ESPECIALIDAD': 'especialidad',
    'TIPO CITA': 'tipo_cita',
    'CUPS': 'cups',
    'CODIGO': 'cups', // Alias potential
    'PROCEDIMIENTO': 'procedimiento',
    'UNIDAD FUNCIONAL': 'unidad_funcional',
    'DIAGNOSTICO': 'dx1',
    'CIE10': 'dx1', // Alias
    'D. RELACIONADO1': 'dx2',
    'D. RELACIONADO2': 'dx3',
    'D. RELACIONADO3': 'dx4',
    'DURACION': 'duracion',
    'SEXO': 'sexo',
    'GENERO': 'sexo',
    'EDAD': 'edad',
    'USUARIO AGENDA': 'usuario_agenda',
    'USUARIO CREACION': 'usuario_agenda',
    'USUARIO CONFIRMA': 'usuario_confirma'
}

/**
 * Process the uploaded specific "Fake XLS" HTML file
 */
export async function processCitasFile(
    file: File,
    onProgress: (status: string, percentage?: number) => void
): Promise<{ success: number; errors: number; duplicates: number; totalProcessed: number }> {

    // Helper for normalizing headers (remove accents, extra spaces)
    const normalizeHeader = (h: string) => {
        return h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase()
    }

    // 1. Read file as text
    onProgress('Leyendo archivo...', 0)
    const text = await file.text()

    // 2. Parse HTML
    onProgress('Analizando estructura HTML...', 5)
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
            // Normalize cell content for matching
            const cells = Array.from(row.cells).map(c => normalizeHeader(c.textContent || ''))

            // Check if this row looks like the header
            if (cells.includes('ID CITA') && cells.includes('PACIENTE')) {
                targetTable = table
                headerRowIndex = i

                // Build index map
                cells.forEach((headerText, index) => {
                    // Normalize map keys too just in case, though we used standard ones above
                    // Actually, we iterate the cells (headers found in file)
                    // and try to find them in our MAP.

                    // Direct match attempt
                    let dbCol = COLUMN_MAP[headerText]

                    // If not found, try fuzzy match against our MAP keys
                    if (!dbCol) {
                        const key = Object.keys(COLUMN_MAP).find(k => {
                            const normalizedKey = normalizeHeader(k)
                            return headerText.includes(normalizedKey) || normalizedKey.includes(headerText)
                        })
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
    onProgress('Extrayendo datos...', 10)
    // Use a Map to deduplicate by id_cita automatically (last entry wins)
    const rowsMap = new Map<string, CitaRow>()
    let duplicates = 0

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

        // Count as duplicate if we already have it
        if (rowsMap.has(id_cita)) {
            duplicates++
        }

        // Parse Age (might be "35" or "35 Años")
        const parseAge = (val: string): number | null => {
            if (!val) return null
            const match = val.match(/(\d+)/)
            return match ? parseInt(match[1], 10) : null
        }

        const rowData: CitaRow = {
            id_cita,
            tipo_id: getItem('tipo_id'),
            identificacion: getItem('identificacion'),
            nombres_completos: getItem('nombres_completos'),
            fecha_asignacion: parseDate(getItem('fecha_asignacion')),
            fecha_cita: parseDate(getItem('fecha_cita')),
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
            dx2: getItem('dx2') || null,
            dx3: getItem('dx3') || null,
            dx4: getItem('dx4') || null,
            duracion: getItem('duracion') || null,
            sexo: getItem('sexo') || null,
            edad: parseAge(getItem('edad')),
            usuario_agenda: getItem('usuario_agenda') || null,
            usuario_confirma: getItem('usuario_confirma') || null
        }

        rowsMap.set(id_cita, rowData)
    }

    const dataBatch = Array.from(rowsMap.values())

    // 5. Upsert to Supabase
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

        const percentage = Math.round((Math.min(i + BATCH_SIZE, dataBatch.length) / dataBatch.length) * 100)
        onProgress(`Procesando... ${Math.min(i + BATCH_SIZE, dataBatch.length)} / ${dataBatch.length}`, percentage)
    }

    return {
        success: successCount,
        errors: errorCount,
        duplicates: duplicates,
        totalProcessed: rowsMap.size + duplicates
    }
}
