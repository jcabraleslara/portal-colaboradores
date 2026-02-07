/**
 * Servicio de importación para BD Salud Total (ST Cerete)
 * Procesa archivos TXT (TSV con tabulador) con encoding Windows-1252
 * Tabla destino: public.bd (PK: tipo_id, id)
 * Prioridad absoluta: sobreescribe cualquier fuente previa
 */

import { supabase } from '@/config/supabase.config'
import type { ImportResult, ImportProgressCallback } from '../types/import.types'
import {
    cargarMunicipioMap,
    obtenerCodigoDepartamento,
    limpiarCacheDivipola,
} from '../utils/divipolaLookup'

/** Fila transformada lista para enviar a RPC */
interface BdCereteRow {
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

/** Mapeo de encabezados TXT → campo BD */
const COLUMN_MAP: Record<string, string> = {
    'TipoDocumento': 'tipo_id_raw',
    'Documento': 'id',
    'Nombre': 'nombres',
    'Apellido1': 'apellido1',
    'Apellido2': 'apellido2',
    'Sexo': 'sexo',
    'Fecha_Nacimiento': 'fecha_nacimiento_raw',
    'Direccion': 'direccion',
    'telefonomovil': 'telefono',
    'Ciudad': 'municipio',
    'EstadoServicio': 'estado_raw',
    'Regimen': 'regimen',
    'Email': 'email',
    'RangoSalarial': 'rango',
    'ProgramasEspeciales': 'observaciones',
}

/** Mapeo tipo documento texto largo → código */
const TIPO_ID_MAP: Record<string, string> = {
    'CEDULA DE CIUDADANIA': 'CC',
    'TARJETA DE IDENTIDAD': 'TI',
    'REGISTRO CIVIL': 'RC',
    'CEDULA DE EXTRANJERIA': 'CE',
    'PERMISO POR PROTECCION TEMPORAL': 'PT',
    'MENOR DE EDAD': 'ME',
    'CERTIFICADO NACIDO VIVO': 'CN',
    'PASAPORTE': 'PA',
}

/** Sanitiza valores: NULL literal, NAN, NUL chars, espacios solitarios */
function sanitize(val: string): string {
    if (!val) return ''
    let clean = val.replace(/\x00/g, '').trim()
    const upper = clean.toUpperCase()
    if (upper === 'NULL' || upper === 'NAN') return ''
    if (clean === ' ') return ''
    return clean
}

/** Normaliza estado del servicio */
function normalizeEstado(val: string): string {
    const upper = val.trim().toUpperCase()
    if (upper.includes('ACTIVO')) return 'ACTIVO'
    return upper
}

/** Parsea fecha MM/DD/YYYY → YYYY-MM-DD */
function parseDateCerete(val: string): string {
    if (!val || !val.trim()) return ''
    const trimmed = val.trim()

    // MM/DD/YYYY
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (match) {
        const [, mm, dd, yyyy] = match
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }

    // YYYY-MM-DD (ISO)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

    return ''
}

/**
 * Procesa archivo BD Salud Total (TXT con tabulador, encoding Windows-1252)
 */
export async function processBdSaludTotalFile(
    file: File,
    onProgress: ImportProgressCallback
): Promise<ImportResult> {
    const startTime = performance.now()
    const timestampInicio = new Date().toISOString()

    // ═══ Fase 1: Leer TXT con Windows-1252 (0-5%) ═══
    onProgress('Leyendo archivo TXT...', 0)
    const buffer = await file.arrayBuffer()
    const text = new TextDecoder('windows-1252').decode(buffer)

    const lines = text.split('\n').filter(l => l.trim() !== '')
    if (lines.length < 2) {
        throw new Error('El archivo está vacío o no tiene datos.')
    }

    const headers = lines[0].split('\t').map(h => h.trim())

    // ═══ Fase 2: Mapear columnas (5-10%) ═══
    onProgress('Mapeando columnas...', 5)
    const columnIndices: Record<string, number> = {}

    for (let i = 0; i < headers.length; i++) {
        const mapped = COLUMN_MAP[headers[i]]
        if (mapped) {
            columnIndices[mapped] = i
        }
    }

    // Validar columnas críticas
    const requiredFields = ['tipo_id_raw', 'id', 'nombres', 'apellido1']
    const missing = requiredFields.filter(f => columnIndices[f] === undefined)
    if (missing.length > 0) {
        throw new Error(`Columnas requeridas no encontradas: ${missing.join(', ')}. Verifique que el archivo sea BD Salud Total Cerete.`)
    }

    // ═══ Fase 3: Transformar + dedup (10-15%) ═══
    onProgress('Transformando datos...', 10)
    const rowsMap = new Map<string, BdCereteRow>()
    let fileDuplicates = 0
    let skippedRows = 0

    const getField = (fields: string[], fieldName: string): string => {
        const idx = columnIndices[fieldName]
        if (idx === undefined || idx >= fields.length) return ''
        return fields[idx]
    }

    for (let i = 1; i < lines.length; i++) {
        const fields = lines[i].split('\t')
        if (fields.length < 3) continue

        // Tipo ID: texto largo con ~50 espacios trailing → trim + mapeo
        const tipoIdRaw = sanitize(getField(fields, 'tipo_id_raw')).toUpperCase()
        const tipoId = TIPO_ID_MAP[tipoIdRaw] || tipoIdRaw
        const id = sanitize(getField(fields, 'id'))

        if (!tipoId || !id) {
            skippedRows++
            continue
        }

        const dedupeKey = `${tipoId}|${id}`
        if (rowsMap.has(dedupeKey)) {
            fileDuplicates++
            continue
        }

        const row: BdCereteRow = {
            tipo_id: tipoId,
            id,
            nombres: sanitize(getField(fields, 'nombres')),
            apellido1: sanitize(getField(fields, 'apellido1')),
            apellido2: sanitize(getField(fields, 'apellido2')),
            sexo: sanitize(getField(fields, 'sexo')),
            direccion: sanitize(getField(fields, 'direccion')),
            telefono: sanitize(getField(fields, 'telefono')),
            fecha_nacimiento: parseDateCerete(sanitize(getField(fields, 'fecha_nacimiento_raw'))),
            estado: normalizeEstado(sanitize(getField(fields, 'estado_raw'))),
            municipio: sanitize(getField(fields, 'municipio')).toUpperCase(),
            observaciones: sanitize(getField(fields, 'observaciones')),
            ips_primaria: 'GESTAR SALUD DE COLOMBIA CERETE CONTRIBUTIVO',
            tipo_cotizante: '',
            departamento: '', // Se resuelve en fase DIVIPOLA
            rango: sanitize(getField(fields, 'rango')),
            email: sanitize(getField(fields, 'email')),
            regimen: sanitize(getField(fields, 'regimen')).toUpperCase(),
            eps: 'SALUD TOTAL',
        }

        rowsMap.set(dedupeKey, row)
    }

    const dataBatch = Array.from(rowsMap.values())

    if (dataBatch.length === 0) {
        throw new Error('No se encontraron registros válidos para importar.')
    }

    // ═══ Fase 4: Resolver DIVIPOLA (15-30%) ═══
    onProgress('Cargando tabla DIVIPOLA...', 15)
    limpiarCacheDivipola()
    const municipioMap = await cargarMunicipioMap()

    onProgress('Resolviendo departamentos...', 20)
    for (const row of dataBatch) {
        row.departamento = obtenerCodigoDepartamento(row.municipio, municipioMap)
    }

    // ═══ Fase 5: Filtrar registros sin PK (30-35%) ═══
    onProgress('Validando registros...', 30)
    const validRows = dataBatch.filter(r => r.tipo_id && r.id)
    const invalidPkCount = dataBatch.length - validRows.length

    // ═══ Fase 6: Enviar batches a RPC (35-85%) ═══
    onProgress(`Importando ${validRows.length} registros...`, 35)

    let totalInsertados = 0
    let totalActualizados = 0
    let errorCount = 0

    const RPC_BATCH = 2000
    for (let i = 0; i < validRows.length; i += RPC_BATCH) {
        const chunk = validRows.slice(i, i + RPC_BATCH)

        const { data, error } = await supabase.rpc('upsert_bd_batch', {
            registros: chunk,
            p_fuente: 'BD_ST_CERETE',
        })

        if (error) {
            console.error('Error en RPC upsert_bd_batch (Cerete):', error)
            errorCount += chunk.length
        } else if (data) {
            totalInsertados += (data.insertados || 0)
            totalActualizados += (data.actualizados || 0)
        }

        const processed = Math.min(i + RPC_BATCH, validRows.length)
        const pct = 35 + Math.round((processed / validRows.length) * 50)
        onProgress(`Procesando... ${processed}/${validRows.length}`, pct)
    }

    // ═══ Fase 7: Marcar huérfanos (85-90%) ═══
    onProgress('Marcando registros no incluidos...', 85)
    let huerfanosMarcados = 0

    const { data: orphanData, error: orphanError } = await supabase.rpc('marcar_huerfanos_bd', {
        p_fuente: 'BD_ST_CERETE',
        p_timestamp_inicio: timestampInicio,
    })

    if (orphanError) {
        console.error('Error marcando huérfanos:', orphanError)
    } else if (orphanData) {
        huerfanosMarcados = orphanData.huerfanos_marcados || 0
    }

    // ═══ Fase 8: Generar reporte + historial (90-100%) ═══
    onProgress('Generando reporte...', 90)

    let errorReport: string | undefined
    const reportSections: string[] = []

    // Resumen general
    const summaryHeader = '=== SECCION: RESUMEN DE IMPORTACION BD SALUD TOTAL ==='
    const summaryRows = [
        `Total registros en archivo,${rowsMap.size + fileDuplicates + skippedRows}`,
        `Registros unicos,${rowsMap.size}`,
        `Insertados nuevos,${totalInsertados}`,
        `Actualizados,${totalActualizados}`,
        `Huerfanos marcados (VALIDAR EN PORTAL EPS),${huerfanosMarcados}`,
        `Duplicados en archivo,${fileDuplicates}`,
        `Sin tipo_id o id,${skippedRows + invalidPkCount}`,
        `Errores de procesamiento,${errorCount}`,
    ].join('\n')
    reportSections.push(`${summaryHeader}\n${summaryRows}`)

    if (reportSections.length > 0) {
        errorReport = reportSections.join('\n\n')
    }

    // Registrar en historial
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
            tipo_fuente: 'bd-salud-total',
            total_registros: rowsMap.size + fileDuplicates + skippedRows,
            exitosos: totalInsertados + totalActualizados,
            fallidos: errorCount,
            duplicados: fileDuplicates,
            duracion: durationStr,
            detalles: {
                insertados: totalInsertados,
                actualizados: totalActualizados,
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
    if (errorCount > 0) errorMessages.push(`${errorCount} registros con error de procesamiento`)

    return {
        success: totalInsertados + totalActualizados,
        errors: errorCount,
        duplicates: fileDuplicates,
        totalProcessed: rowsMap.size + fileDuplicates + skippedRows,
        duration: durationStr,
        errorReport,
        errorMessage: errorMessages.length > 0 ? errorMessages.join('. ') + '.' : undefined,
    }
}
