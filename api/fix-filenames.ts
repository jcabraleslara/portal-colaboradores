/**
 * API Serverless: Corrección masiva de nombres de archivos
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * Elimina el sufijo numérico (_1, _2, etc.) de los nombres de archivos
 * en Supabase Storage y actualiza las URLs en la base de datos.
 *
 * IMPORTANTE: Este endpoint debe ejecutarse UNA SOLA VEZ para migrar
 * los archivos existentes. Después de la migración, puede eliminarse.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BUCKET_NAME = 'soportes-facturacion'

// Columnas que contienen URLs de archivos
const URL_COLUMNS = [
    'urls_validacion_derechos',
    'urls_autorizacion',
    'urls_soporte_clinico',
    'urls_comprobante_recibo',
    'urls_orden_medica',
    'urls_descripcion_quirurgica',
    'urls_registro_anestesia',
    'urls_hoja_medicamentos',
    'urls_notas_enfermeria',
]

// Regex para detectar archivos con IDENTIFICACION de paciente que tienen sufijo innecesario
// Formato: PREFIJO_NIT_TIPOID+NUMERO_N.ext (ej: HEV_900842629_CC34998254_1.pdf)
// Solo estos deben renombrarse, NO los archivos con RADICADO (FACT1234) ni formato antiguo
// Tipos de ID válidos: CC, TI, CE, CN, SC, PE, PT, RC, ME, AS
const SUFFIX_PATTERN = /^([A-Z]{2,4}_\d{9}_(CC|TI|CE|CN|SC|PE|PT|RC|ME|AS)\d+)_\d+(\.[a-zA-Z0-9]+)$/

interface RenameResult {
    radicado: string
    oldName: string
    newName: string
    success: boolean
    error?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Solo permitir POST para evitar ejecuciones accidentales
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Método no permitido. Use POST para ejecutar la migración.',
            usage: 'POST /api/fix-filenames con body opcional: { dryRun: true } para vista previa'
        })
    }

    // Verificar configuración
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Configuración de Supabase no disponible' })
    }

    const { dryRun = false } = req.body || {}

    console.log(`🔧 Iniciando corrección de nombres de archivos (dryRun: ${dryRun})...`)

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        const results: RenameResult[] = []
        let totalProcessed = 0
        let totalRenamed = 0
        let totalErrors = 0

        // 1. Obtener todos los radicados
        const { data: radicados, error: fetchError } = await supabase
            .from('soportes_facturacion')
            .select('radicado')
            .order('radicado', { ascending: true })

        if (fetchError) {
            throw new Error(`Error obteniendo radicados: ${fetchError.message}`)
        }

        console.log(`📋 Encontrados ${radicados?.length || 0} radicados para procesar`)

        // 2. Procesar cada radicado
        for (const { radicado } of radicados || []) {
            try {
                // Listar archivos en la carpeta del radicado
                const { data: files, error: listError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .list(radicado)

                if (listError) {
                    console.error(`Error listando archivos de ${radicado}:`, listError)
                    continue
                }

                if (!files || files.length === 0) {
                    continue
                }

                // Filtrar archivos que necesitan renombrarse (solo formato nuevo con sufijo)
                const filesToRename = files.filter(f => SUFFIX_PATTERN.test(f.name))

                for (const file of filesToRename) {
                    totalProcessed++
                    const oldName = file.name
                    // Grupo 1: PREFIJO_NIT_TIPOID+NUMERO, Grupo 2: tipo ID (CC, TI, etc.), Grupo 3: extensión
                    const newName = oldName.replace(SUFFIX_PATTERN, '$1$3')
                    const oldPath = `${radicado}/${oldName}`
                    const newPath = `${radicado}/${newName}`

                    const result: RenameResult = {
                        radicado,
                        oldName,
                        newName,
                        success: false
                    }

                    if (dryRun) {
                        result.success = true
                        results.push(result)
                        totalRenamed++
                        continue
                    }

                    try {
                        // Verificar si el archivo destino ya existe
                        const existingFiles = files.filter(f => f.name === newName)
                        if (existingFiles.length > 0) {
                            result.error = 'El archivo destino ya existe'
                            results.push(result)
                            totalErrors++
                            continue
                        }

                        // Renombrar archivo en Storage (move)
                        const { error: moveError } = await supabase.storage
                            .from(BUCKET_NAME)
                            .move(oldPath, newPath)

                        if (moveError) {
                            result.error = moveError.message
                            results.push(result)
                            totalErrors++
                            continue
                        }

                        // Generar nueva URL firmada
                        const { data: urlData } = await supabase.storage
                            .from(BUCKET_NAME)
                            .createSignedUrl(newPath, 31536000) // 1 año

                        if (!urlData?.signedUrl) {
                            result.error = 'No se pudo generar URL firmada'
                            results.push(result)
                            totalErrors++
                            continue
                        }

                        // Actualizar URLs en la base de datos
                        // Primero obtenemos el registro actual
                        const { data: registro } = await supabase
                            .from('soportes_facturacion')
                            .select(URL_COLUMNS.join(','))
                            .eq('radicado', radicado)
                            .single()

                        if (registro) {
                            const updates: Record<string, string[]> = {}

                            for (const col of URL_COLUMNS) {
                                const urls: string[] = ((registro as unknown) as Record<string, string[]>)[col] || []
                                const updatedUrls = urls.map(url => {
                                    // Si la URL contiene el nombre antiguo, reemplazar con la nueva URL
                                    if (url.includes(encodeURIComponent(oldName))) {
                                        return urlData.signedUrl
                                    }
                                    return url
                                })

                                // Solo actualizar si hubo cambios
                                if (JSON.stringify(urls) !== JSON.stringify(updatedUrls)) {
                                    updates[col] = updatedUrls
                                }
                            }

                            if (Object.keys(updates).length > 0) {
                                const { error: updateError } = await supabase
                                    .from('soportes_facturacion')
                                    .update(updates)
                                    .eq('radicado', radicado)

                                if (updateError) {
                                    console.warn(`Error actualizando URLs de ${radicado}:`, updateError)
                                }
                            }
                        }

                        result.success = true
                        results.push(result)
                        totalRenamed++
                        console.log(`✅ ${radicado}: ${oldName} -> ${newName}`)

                    } catch (fileError) {
                        result.error = fileError instanceof Error ? fileError.message : 'Error desconocido'
                        results.push(result)
                        totalErrors++
                    }
                }

            } catch (radicadoError) {
                console.error(`Error procesando radicado ${radicado}:`, radicadoError)
            }
        }

        console.log(`🏁 Proceso completado: ${totalRenamed} renombrados, ${totalErrors} errores`)

        return res.status(200).json({
            success: true,
            dryRun,
            summary: {
                totalRadicados: radicados?.length || 0,
                totalFilesProcessed: totalProcessed,
                totalRenamed,
                totalErrors
            },
            results: results.slice(0, 100), // Limitar respuesta a 100 resultados
            message: dryRun
                ? 'Vista previa completada. Ejecute sin dryRun para aplicar cambios.'
                : `Migración completada: ${totalRenamed} archivos renombrados`
        })

    } catch (error) {
        console.error('Error general en fix-filenames:', error)
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Error interno del servidor',
        })
    }
}
