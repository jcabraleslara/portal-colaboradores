/**
 * Supabase Edge Function: Poblado masivo de identificaciones_archivos
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * Extrae identificaciones de los nombres de archivos PDF existentes
 * y las almacena en el campo identificaciones_archivos para búsqueda.
 *
 * Uso:
 * POST https://<project>.supabase.co/functions/v1/populate-identificaciones
 * Headers: Authorization: Bearer <SUPABASE_ANON_KEY>
 * Body: { "dryRun": true, "limit": 100 }
 *
 * - dryRun: true = solo muestra lo que haría sin actualizar BD (default: true)
 * - limit: máximo de radicados a procesar (default: sin límite)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Tipos de ID válidos según BD: CE, CN, SC, PE, PT, TI, CC, RC, ME, AS
const PATRON_ID = /(?:^|[^a-zA-Z])(CC|TI|CE|CN|SC|PE|PT|RC|ME|AS)\s*(\d{1,13})(?:[^0-9]|$)/i

// Categorías de URLs en la tabla soportes_facturacion
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
] as const

// Tipo para el registro de soportes_facturacion
interface SoporteRecord {
    radicado: string
    urls_validacion_derechos: string[] | null
    urls_autorizacion: string[] | null
    urls_soporte_clinico: string[] | null
    urls_comprobante_recibo: string[] | null
    urls_orden_medica: string[] | null
    urls_descripcion_quirurgica: string[] | null
    urls_registro_anestesia: string[] | null
    urls_hoja_medicamentos: string[] | null
    urls_notas_enfermeria: string[] | null
}

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

Deno.serve(async (req) => {
    // Manejar preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Solo permitir POST
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Método no permitido' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        const { dryRun = true, limit, batchSize = 500 } = await req.json()

        // Crear cliente Supabase con service role para acceso total
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const resultados: {
            radicado: string
            identificaciones: string[]
            actualizado: boolean
        }[] = []

        let totalProcesados = 0
        let totalConIdentificaciones = 0
        let totalErrores = 0
        let totalRegistros = 0
        let offset = 0
        let hayMas = true

        // Procesar en lotes para evitar límite de 1000 filas
        while (hayMas) {
            // Construir query para obtener radicados en lotes
            let query = supabase
                .from('soportes_facturacion')
                .select('radicado, ' + CATEGORIAS_URLS.join(', '))
                .order('created_at', { ascending: true })
                .range(offset, offset + batchSize - 1)

            const { data: radicados, error: fetchError } = await query

            if (fetchError) {
                console.error('Error obteniendo radicados:', fetchError)
                return new Response(
                    JSON.stringify({ error: 'Error consultando radicados', offset }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            if (!radicados || radicados.length === 0) {
                hayMas = false
                break
            }

            totalRegistros += radicados.length

            for (const row of radicados) {
                const registro = row as SoporteRecord
                try {
                    const todasUrls: string[] = []

                    // Recopilar URLs de todas las categorías
                    for (const categoria of CATEGORIAS_URLS) {
                        const urls = registro[categoria]
                        if (urls && Array.isArray(urls)) {
                            todasUrls.push(...urls)
                        }
                    }

                    // Extraer identificaciones de todas las URLs
                    const identificaciones = extraerIdentificacionesDeUrls(todasUrls)

                    if (identificaciones.length > 0) {
                        totalConIdentificaciones++

                        if (!dryRun) {
                            // Actualizar en BD
                            const { error: updateError } = await supabase
                                .from('soportes_facturacion')
                                .update({ identificaciones_archivos: identificaciones })
                                .eq('radicado', registro.radicado)

                            if (updateError) {
                                console.error(`Error actualizando ${registro.radicado}:`, updateError)
                                totalErrores++
                                continue
                            }
                        }

                        // Solo guardar primeros 50 resultados para la respuesta
                        if (resultados.length < 50) {
                            resultados.push({
                                radicado: registro.radicado,
                                identificaciones,
                                actualizado: !dryRun
                            })
                        }
                    }

                    totalProcesados++
                } catch (err) {
                    console.error(`Error procesando ${registro.radicado}:`, err)
                    totalErrores++
                }
            }

            // Si recibimos menos registros que el batch, ya no hay más
            if (radicados.length < batchSize) {
                hayMas = false
            } else {
                offset += batchSize
            }

            // Si hay límite y ya procesamos suficientes, parar
            if (limit && typeof limit === 'number' && totalRegistros >= limit) {
                hayMas = false
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                dryRun,
                message: dryRun
                    ? `Simulación completada. ${totalConIdentificaciones} radicados tienen identificaciones en archivos.`
                    : `Poblado completado. ${totalConIdentificaciones} radicados actualizados.`,
                stats: {
                    total: totalRegistros,
                    procesados: totalProcesados,
                    conIdentificaciones: totalConIdentificaciones,
                    errores: totalErrores
                },
                resultados,
                truncated: totalConIdentificaciones > 50
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error en populate-identificaciones:', error)
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Error interno del servidor',
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
