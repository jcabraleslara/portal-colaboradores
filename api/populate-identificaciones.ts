/**
 * API Serverless: Poblado masivo de identificaciones_archivos
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * Este endpoint recorre los radicados existentes y extrae las identificaciones
 * de los nombres de archivos PDF para poblar el campo identificaciones_archivos.
 *
 * Uso:
 * POST /api/populate-identificaciones
 * Body: { "dryRun": true, "limit": 100 }
 *
 * - dryRun: true = solo muestra lo que haría sin actualizar BD (default: true)
 * - limit: máximo de radicados a procesar (default: sin límite)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Configuración
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Tipos de ID válidos según BD: CE, CN, SC, PE, PT, TI, CC, RC, ME, AS
const PATRON_ID = /(?:^|[^a-zA-Z])(CC|TI|CE|CN|SC|PE|PT|RC|ME|AS)\s*(\d{1,13})(?:[^0-9]|$)/i

/**
 * Extraer identificación de un nombre de archivo
 */
function extraerIdentificacionArchivo(nombreArchivo: string): string | null {
    const match = nombreArchivo.match(PATRON_ID)

    if (match && match[1] && match[2]) {
        const tipoId = match[1].toUpperCase()
        const numero = match[2]

        // Validar límite superior numérico (1199999999)
        if (parseInt(numero, 10) <= 1199999999) {
            return `${tipoId}${numero}`
        }
    }
    return null
}

/**
 * Extraer identificaciones de un array de URLs firmadas
 */
function extraerIdentificacionesDeUrls(urls: string[]): string[] {
    const identificaciones = new Set<string>()

    for (const url of urls) {
        try {
            const urlObj = new URL(url)
            const pathName = decodeURIComponent(urlObj.pathname)
            const nombreArchivo = pathName.split('/').pop() || ''
            const id = extraerIdentificacionArchivo(nombreArchivo)

            if (id) {
                identificaciones.add(id)
                // También agregar solo el número para búsqueda flexible
                const soloNumero = id.replace(/^(CC|TI|CE|CN|SC|PE|PT|RC|ME|AS)/i, '')
                if (soloNumero) identificaciones.add(soloNumero)
            }
        } catch {
            // URL malformada, ignorar
        }
    }

    return Array.from(identificaciones)
}

/**
 * Categorías de URLs en la tabla soportes_facturacion
 */
const CATEGORIAS_URLS = [
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

/**
 * Handler principal de la API
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Solo permitir POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' })
    }

    // Verificar configuración
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Configuración de Supabase no disponible' })
    }

    try {
        const { dryRun = true, limit } = req.body || {}

        // Crear cliente Supabase con service role para acceso total
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

        // Construir query para obtener radicados
        let query = supabase
            .from('soportes_facturacion')
            .select('radicado, ' + CATEGORIAS_URLS.join(', '))
            .order('created_at', { ascending: false })

        if (limit && typeof limit === 'number' && limit > 0) {
            query = query.limit(limit)
        }

        const { data: radicados, error: fetchError } = await query

        if (fetchError) {
            console.error('Error obteniendo radicados:', fetchError)
            return res.status(500).json({ error: 'Error consultando radicados' })
        }

        if (!radicados || radicados.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No hay radicados para procesar',
                stats: { total: 0, procesados: 0, conIdentificaciones: 0 }
            })
        }

        const resultados: {
            radicado: string
            identificaciones: string[]
            actualizado: boolean
        }[] = []

        let procesados = 0
        let conIdentificaciones = 0
        let errores = 0

        for (const registro of radicados) {
            try {
                const todasUrls: string[] = []

                // Recopilar URLs de todas las categorías
                for (const categoria of CATEGORIAS_URLS) {
                    const urls = registro[categoria] as string[] | null
                    if (urls && Array.isArray(urls)) {
                        todasUrls.push(...urls)
                    }
                }

                // Extraer identificaciones de todas las URLs
                const identificaciones = extraerIdentificacionesDeUrls(todasUrls)

                if (identificaciones.length > 0) {
                    conIdentificaciones++

                    if (!dryRun) {
                        // Actualizar en BD
                        const { error: updateError } = await supabase
                            .from('soportes_facturacion')
                            .update({ identificaciones_archivos: identificaciones })
                            .eq('radicado', registro.radicado)

                        if (updateError) {
                            console.error(`Error actualizando ${registro.radicado}:`, updateError)
                            errores++
                            resultados.push({
                                radicado: registro.radicado,
                                identificaciones,
                                actualizado: false
                            })
                            continue
                        }
                    }

                    resultados.push({
                        radicado: registro.radicado,
                        identificaciones,
                        actualizado: !dryRun
                    })
                }

                procesados++
            } catch (err) {
                console.error(`Error procesando ${registro.radicado}:`, err)
                errores++
            }
        }

        return res.status(200).json({
            success: true,
            dryRun,
            message: dryRun
                ? `Simulación completada. ${conIdentificaciones} radicados tienen identificaciones en archivos.`
                : `Poblado completado. ${conIdentificaciones} radicados actualizados.`,
            stats: {
                total: radicados.length,
                procesados,
                conIdentificaciones,
                errores
            },
            // Solo incluir detalles en modo dryRun o si hay pocos resultados
            resultados: dryRun || resultados.length <= 50 ? resultados : resultados.slice(0, 50),
            truncated: !dryRun && resultados.length > 50
        })

    } catch (error) {
        console.error('Error en populate-identificaciones:', error)
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Error interno del servidor',
        })
    }
}
