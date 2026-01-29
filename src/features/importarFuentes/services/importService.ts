
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
    // Temporary field for age calculation - not sent to DB
    fecha_nacimiento_temp?: string | null
}

/**
 * Maps HTML header text to database column name
 */
const COLUMN_MAP: Record<string, keyof CitaRow> = {
    'ID CITA': 'id_cita',
    'TIPO ID': 'tipo_id',
    'No. IDENTIFICACION': 'identificacion', // Correcto
    'NUMERO ID': 'identificacion', // Fallback
    'IDENTIFICACION': 'identificacion', // Fallback
    'PACIENTE': 'nombres_completos',
    'NOMBRE': 'nombres_completos',
    'FECHA ASIGNACION': 'fecha_asignacion',
    'FECHA ATENCION': 'fecha_cita', // Correcto per user
    'FECHA CITA': 'fecha_cita', // Fallback
    'ESTADO': 'estado_cita',
    'ASUNTO': 'asunto',
    'P. ATENCION': 'sede', // Correcto
    'SEDE': 'sede', // Fallback
    'CONTRATO': 'contrato',
    'USUARIO': 'usuario_agenda', // Correcto
    'USUARIO AGENDA': 'usuario_agenda', // Fallback
    'MEDICO': 'medico',
    'PROFESIONAL': 'medico',
    'ESP. MEDICO': 'especialidad', // Correcto
    'ESPECIALIDAD': 'especialidad', // Fallback
    'TIPO DE CITA': 'tipo_cita', // Correcto
    'TIPO CITA': 'tipo_cita', // Fallback
    'CUPS': 'cups',
    'CODIGO': 'cups',
    'PROCEDIMIENTO': 'procedimiento',
    'UNIDAD FUNCIONAL': 'unidad_funcional',
    'DIAGNOSTICO': 'dx1',
    'CIE10': 'dx1',
    'D. RELACIONADO1': 'dx2',
    'D. RELACIONADO2': 'dx3',
    'D. RELACIONADO3': 'dx4',
    'DURACION': 'duracion',
    'SEXO': 'sexo',
    'GENERO': 'sexo',
    'F.NACIMIENTO': 'fecha_nacimiento_temp', // For calculation
    'USUARIO CONFIRMA': 'usuario_confirma'
}

/**
 * Process the uploaded specific "Fake XLS" HTML file
 */
export async function processCitasFile(
    file: File,
    onProgress: (status: string, percentage?: number) => void
): Promise<{ success: number; errors: number; duplicates: number; totalProcessed: number; duration: string; invalidCupsReport?: string }> {
    const startTime = performance.now()

    // Helper for normalizing headers (remove accents, extra spaces)
    const normalizeHeader = (h: string) => {
        return h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase()
    }

    // 0. Pre-fetch valid CUPS for integrity check
    onProgress('Validando maestro de CUPS...', 0)
    const { data: cupsData, error: cupsError } = await supabase
        .from('cups')
        .select('cups')

    if (cupsError) {
        console.error('Error fetching CUPS:', cupsError)
        throw new Error('No se pudo validar el maestro de CUPS.')
    }
    // Create Set for O(1) lookup
    const validCupsSet = new Set(cupsData?.map(c => c.cups?.trim()) || [])
    const invalidCupsList: { id_cita: string; cups: string; descripcion: string }[] = []

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
        const match = val.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
        if (match) {
            return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
        }
        return null
    }

    // Calculate age between two dates
    const calculateAge = (birthDateStr: string | null, refDateStr: string | null): number | null => {
        if (!birthDateStr || !refDateStr) return null

        // Ensure format YYYY-MM-DD for constructor
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

        const fecha_nacimiento_raw = parseDate(getItem('fecha_nacimiento_temp'))
        const fecha_asignacion = parseDate(getItem('fecha_asignacion'))

        // Always calculate age from birth date vs assignment date
        const finalAge = calculateAge(fecha_nacimiento_raw, fecha_asignacion)

        const rowData: CitaRow = {
            id_cita,
            tipo_id: getItem('tipo_id'),
            identificacion: getItem('identificacion'),
            nombres_completos: getItem('nombres_completos'),
            fecha_asignacion: fecha_asignacion,
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
            edad: finalAge,
            usuario_agenda: getItem('usuario_agenda') || null,
            usuario_confirma: getItem('usuario_confirma') || null
            // Not including fecha_nacimiento_temp strictly in DB object
        }

        // Validate CUPS integrity
        const rowCups = rowData.cups?.trim()
        if (rowCups && !validCupsSet.has(rowCups)) {
            invalidCupsList.push({
                id_cita: rowData.id_cita,
                cups: rowCups,
                descripcion: rowData.procedimiento || 'Sin descripción'
            })
        }

        // Remove temp field if it strictly needs to match DB (Supabase usually OK with extra fields if not stripping)
        delete rowData.fecha_nacimiento_temp

        rowsMap.set(id_cita, rowData)
    }

    const dataBatch = Array.from(rowsMap.values())

    // 5. Upsert to Supabase
    onProgress(`Subiendo ${dataBatch.length} registros únicos...`, 20)

    const BATCH_SIZE = 50 // Reduced to avoid 502/CORS errors on large payloads
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

    const endTime = performance.now()
    const durationSeconds = Math.round((endTime - startTime) / 1000)
    const minutes = Math.floor(durationSeconds / 60)
    const seconds = durationSeconds % 60
    const durationStr = `${minutes}m ${seconds}s`

    // Generate CSV Report if needed
    let invalidCupsReport: string | undefined
    if (invalidCupsList.length > 0) {
        const headers = 'ID_CITA,CUPS_NO_ENCONTRADO,DESCRIPCION\n'
        const rows = invalidCupsList.map(item => `${item.id_cita},"${item.cups}","${item.descripcion}"`).join('\n')
        invalidCupsReport = headers + rows
    }

    return {
        success: successCount,
        errors: errorCount,
        duplicates: duplicates,
        totalProcessed: rowsMap.size + duplicates,
        duration: durationStr,
        invalidCupsReport
    }
}
