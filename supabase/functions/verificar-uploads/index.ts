/**
 * Supabase Edge Function: Verificar Uploads Pendientes (Safety Net)
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * POST /functions/v1/verificar-uploads
 *
 * Busca radicados con uploads estancados (>30 min en 'uploading' o 'partial')
 * y los finaliza verificando qué archivos llegaron a Storage.
 * Se puede ejecutar manualmente o vía cron externo.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { notifyCriticalError } from '../_shared/critical-error-utils.ts'
import {
    getCategoriaColumnName,
    extraerIdentificacionArchivo,
    type CategoriaArchivo,
} from '../_shared/file-naming-utils.ts'

interface ExpectedFile {
    path: string
    category: string
    originalName: string
    uploaded: boolean
}

/** Minutos de gracia antes de considerar un upload como estancado */
const STALE_THRESHOLD_MINUTES = 30

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

        // Buscar radicados estancados
        const cutoffTime = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString()

        const { data: staleRecords, error: queryError } = await supabaseAdmin
            .from('soportes_facturacion')
            .select('id, radicado, radicador_email, eps, regimen, servicio_prestado, fecha_atencion, tipo_id, identificacion, nombres_completos, fecha_radicacion, created_at, expected_files, upload_status')
            .in('upload_status', ['uploading', 'partial'])
            .lt('upload_started_at', cutoffTime)
            .limit(50)

        if (queryError) {
            console.error('[verificar-uploads] Error consultando registros:', queryError)
            return new Response(
                JSON.stringify({ error: 'Error consultando registros estancados' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!staleRecords || staleRecords.length === 0) {
            return new Response(
                JSON.stringify({ success: true, message: 'No hay uploads estancados', processed: 0 }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.info(`[verificar-uploads] Encontrados ${staleRecords.length} radicados estancados`)

        const results: { radicado: string; status: string; exitosos: number; faltantes: number }[] = []

        for (const registro of staleRecords) {
            const expectedFiles: ExpectedFile[] = registro.expected_files || []
            const radicado = registro.radicado

            if (expectedFiles.length === 0) {
                // Sin archivos esperados, marcar como completado
                await supabaseAdmin
                    .from('soportes_facturacion')
                    .update({ upload_status: 'completed', upload_completed_at: new Date().toISOString() })
                    .eq('id', registro.id)

                results.push({ radicado, status: 'completed', exitosos: 0, faltantes: 0 })
                continue
            }

            // Verificar cada archivo en Storage
            const urlsPorCategoria: Record<string, string[]> = {}
            const identificaciones = new Set<string>()
            const archivosExitosos: string[] = []
            const archivosFaltantes: string[] = []

            for (const file of expectedFiles) {
                const { data: urlData } = await supabaseAdmin.storage
                    .from('soportes-facturacion')
                    .createSignedUrl(file.path, 31536000)

                if (urlData?.signedUrl) {
                    const columnName = getCategoriaColumnName(file.category as CategoriaArchivo)
                    if (!urlsPorCategoria[columnName]) {
                        urlsPorCategoria[columnName] = []
                    }
                    urlsPorCategoria[columnName].push(urlData.signedUrl)
                    archivosExitosos.push(file.originalName)

                    const nombreArchivo = file.path.split('/').pop() || ''
                    const id = extraerIdentificacionArchivo(nombreArchivo)
                    if (id) {
                        identificaciones.add(id)
                        const soloNumero = id.replace(/^(CC|TI|CE|CN|SC|PE|PT|RC|ME|AS)/i, '')
                        if (soloNumero) identificaciones.add(soloNumero)
                    }
                } else {
                    archivosFaltantes.push(file.originalName)
                }
            }

            const todosSubidos = archivosFaltantes.length === 0
            const uploadStatus = todosSubidos ? 'completed' : (archivosExitosos.length > 0 ? 'partial' : 'failed')

            // Actualizar BD
            const updateData: Record<string, unknown> = {
                ...urlsPorCategoria,
                upload_status: uploadStatus,
                upload_completed_at: new Date().toISOString(),
                expected_files: expectedFiles.map(f => ({
                    ...f,
                    uploaded: archivosExitosos.includes(f.originalName),
                })),
            }

            if (identificaciones.size > 0) {
                updateData.identificaciones_archivos = Array.from(identificaciones)
            }

            await supabaseAdmin
                .from('soportes_facturacion')
                .update(updateData)
                .eq('id', registro.id)

            // Enviar email de confirmación si se completó
            if (todosSubidos) {
                const categoriasParaEmail = [
                    { categoria: 'Validación de Derechos', urls: urlsPorCategoria['urls_validacion_derechos'] || [] },
                    { categoria: 'Autorización', urls: urlsPorCategoria['urls_autorizacion'] || [] },
                    { categoria: 'Soporte Clínico', urls: urlsPorCategoria['urls_soporte_clinico'] || [] },
                    { categoria: 'Comprobante de Recibo', urls: urlsPorCategoria['urls_comprobante_recibo'] || [] },
                    { categoria: 'Orden Médica', urls: urlsPorCategoria['urls_orden_medica'] || [] },
                    { categoria: 'Descripción Quirúrgica', urls: urlsPorCategoria['urls_descripcion_quirurgica'] || [] },
                    { categoria: 'Registro de Anestesia', urls: urlsPorCategoria['urls_registro_anestesia'] || [] },
                    { categoria: 'Hoja de Medicamentos', urls: urlsPorCategoria['urls_hoja_medicamentos'] || [] },
                    { categoria: 'Notas de Enfermería', urls: urlsPorCategoria['urls_notas_enfermeria'] || [] },
                ]

                await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${anonKey}`,
                    },
                    body: JSON.stringify({
                        type: 'radicacion',
                        destinatario: registro.radicador_email,
                        radicado,
                        datos: {
                            eps: registro.eps,
                            regimen: registro.regimen,
                            servicioPrestado: registro.servicio_prestado,
                            fechaAtencion: registro.fecha_atencion,
                            pacienteNombre: registro.nombres_completos || 'No especificado',
                            pacienteIdentificacion: registro.identificacion || 'No especificado',
                            pacienteTipoId: registro.tipo_id || 'CC',
                            archivos: categoriasParaEmail,
                            fechaRadicacion: registro.fecha_radicacion || registro.created_at,
                            radicadorEmail: registro.radicador_email,
                        },
                    }),
                })
            }

            // Notificar si hay archivos faltantes
            if (archivosFaltantes.length > 0) {
                await notifyCriticalError({
                    category: 'STORAGE_FAILURE',
                    errorMessage: `[Recovery] Radicado ${radicado}: ${archivosFaltantes.length}/${expectedFiles.length} archivos no llegaron tras ${STALE_THRESHOLD_MINUTES} min`,
                    feature: 'Soportes de Facturación',
                    severity: 'HIGH',
                    metadata: { radicado, archivosFaltantes, archivosExitosos: archivosExitosos.length },
                })
            }

            results.push({
                radicado,
                status: uploadStatus,
                exitosos: archivosExitosos.length,
                faltantes: archivosFaltantes.length,
            })

            console.info(`[verificar-uploads] ${radicado}: ${uploadStatus} (${archivosExitosos.length}/${expectedFiles.length})`)
        }

        return new Response(
            JSON.stringify({ success: true, processed: results.length, results }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[verificar-uploads] Error:', error)
        return new Response(
            JSON.stringify({ error: 'Error interno del servidor' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
