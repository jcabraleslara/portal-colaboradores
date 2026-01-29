
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
    'FECHA TIEMPO EN CONSULTA': 'duracion', // Best guess based on headers
    'SEXO': 'sexo',
    'F.NACIMIENTO': 'fecha_nacimiento_temp',
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

    // 1. Read file as text
    onProgress('Leyendo archivo...', 0)
    const text = await file.text()

    // 2. Parse HTML
    onProgress('Analizando estructura HTML...', 5)
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'text/html')

    // 3. Find the main table
    const tables = doc.querySelectorAll('table')
    let targetTable: HTMLTableElement | null = null
    let headerRowIndex = -1
    let columnIndices: Record<string, number> = {}

    for (const table of Array.from(tables)) {
        const rows = Array.from(table.rows)
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const row = rows[i]
            const cells = Array.from(row.cells).map(c => normalizeHeader(c.textContent || ''))

            if (cells.includes('ID CITA') && cells.includes('PACIENTE')) {
                targetTable = table
                headerRowIndex = i

                // First pass: exact matches only (prevents false positives)
                cells.forEach((headerText, index) => {
                    const dbCol = COLUMN_MAP[headerText]
                    if (dbCol && columnIndices[dbCol] === undefined) {
                        columnIndices[dbCol] = index
                    }
                })

                // Second pass: fuzzy matches for unmatched columns (e.g., accents)
                // Only match if the header text is similar length (within 3 chars) to avoid false positives
                cells.forEach((headerText, index) => {
                    const key = Object.keys(COLUMN_MAP).find(k => {
                        if (columnIndices[COLUMN_MAP[k]] !== undefined) return false // Already matched
                        const normalizedKey = normalizeHeader(k)
                        const lengthDiff = Math.abs(headerText.length - normalizedKey.length)
                        if (lengthDiff > 3) return false // Too different in length
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

    // 4. Extract Unique CUPS to Validate (Optimization)
    onProgress('Validando códigos CUPS...', 10)
    const fileRows = Array.from(targetTable.rows).slice(headerRowIndex + 1)
    const uniqueCupsInFile = new Set<string>()
    const cupsIndex = columnIndices['cups']

    if (cupsIndex !== undefined) {
        for (const row of fileRows) {
            const val = row.cells[cupsIndex]?.textContent?.trim()
            if (val) {
                // Tomar solo los primeros 6 caracteres para validación contra maestro
                uniqueCupsInFile.add(val.substring(0, 6).toUpperCase())
            }
        }
    }

    // 5. Query Supabase only for those CUPS
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

            if (error) {
                console.error('Error validating CUPS batch:', error)
            } else if (data) {
                data.forEach(c => c.cups && validCupsSet.add(c.cups.trim().toUpperCase()))
            }
        }
    }

    const invalidCupsList: { id_cita: string; cups: string; descripcion: string }[] = []


    if (!columnIndices['id_cita']) {
        throw new Error('No se encontró la columna ID CITA requerida.')
    }

    // 4. Extract Data
    onProgress('Extrayendo datos...', 10)
    // Use a Map to deduplicate by id_cita automatically (last entry wins)
    const rowsMap = new Map<string, CitaRow>()
    let duplicates = 0

    const rows = Array.from(targetTable.rows).slice(headerRowIndex + 1)

    // Helper to parse dates - supports multiple formats:
    // - DD/MM/YYYY (legacy)
    // - YYYY-MM-DD (ISO)
    // - YYYY-MM-DD HH:MM (ISO with time)
    // - YYYY-MM-DD HH:MM am/pm (ISO with time and am/pm)
    const parseDate = (val: string) => {
        if (!val || !val.trim()) return null
        const trimmed = val.trim()

        // Try DD/MM/YYYY format first (legacy)
        const legacyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
        if (legacyMatch) {
            return `${legacyMatch[3]}-${legacyMatch[2].padStart(2, '0')}-${legacyMatch[1].padStart(2, '0')}`
        }

        // Try ISO format YYYY-MM-DD (with optional time)
        const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (isoMatch) {
            return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
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

        // Clean estado_cita: "ATENDIDA - (Normal)" -> "ATENDIDA"
        const rawEstado = getItem('estado_cita')
        const estado_clean = rawEstado ? rawEstado.split(' -')[0].trim() : ''

        // Clean duracion: "18 Minutos" -> "18 minutes", "-18 Minutos" -> "18 minutes"
        const cleanDuration = (val: string) => {
            if (!val) return null
            const match = val.match(/-?(\d+)/)
            if (match) {
                return `${match[1]} minutes` // Always positive integer + ' minutes' for Postgres interval
            }
            return null
        }

        const rowData: CitaRow = {
            id_cita,
            tipo_id: getItem('tipo_id'),
            identificacion: getItem('identificacion'),
            nombres_completos: getItem('nombres_completos'),
            fecha_asignacion: fecha_asignacion,
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
            // Not including fecha_nacimiento_temp strictly in DB object
        }

        // Validate CUPS integrity (Check first 6 characters)
        const rowCupsFull = rowData.cups?.trim().toUpperCase()
        const rowCupsShort = rowCupsFull ? rowCupsFull.substring(0, 6) : ''

        if (rowCupsShort && !validCupsSet.has(rowCupsShort)) {
            invalidCupsList.push({
                id_cita: rowData.id_cita,
                cups: rowCupsFull || '', // Reportamos el código largo original
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

    const BATCH_SIZE = 100 // Incremented to speed up imports, balance between speed and reliability
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

    // Generate CSV Report if needed (Deduplicated)
    let invalidCupsReport: string | undefined
    if (invalidCupsList.length > 0) {
        // Deduplicate by CUPS code to show unique missing codes
        const uniqueCupsMap = new Map<string, string>()
        invalidCupsList.forEach(item => {
            if (!uniqueCupsMap.has(item.cups)) {
                uniqueCupsMap.set(item.cups, item.descripcion)
            }
        })

        const headers = 'CUPS_NO_ENCONTRADO,DESCRIPCION_EJEMPLO\n'
        const rows = Array.from(uniqueCupsMap.entries()).map(([cups, desc]) => `"${cups}","${desc}"`).join('\n')
        invalidCupsReport = headers + rows
    }

    // 6. Log history
    try {
        const { error: logError } = await supabase.from('import_history').insert({
            usuario: (await supabase.auth.getUser()).data.user?.email || 'unknown',
            archivo_nombre: file.name,
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
        duplicates: duplicates,
        totalProcessed: rowsMap.size + duplicates,
        duration: durationStr,
        invalidCupsReport
    }
}
