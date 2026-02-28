/**
 * Supabase Edge Function: Finalizar Radicación
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * POST /functions/v1/finalizar-radicacion
 * Body: { radicado: string }
 *
 * 1. Lee expected_files del registro
 * 2. Verifica que cada archivo exista en Storage
 * 3. Genera signed download URLs (1 año)
 * 4. Actualiza BD con URLs por categoría + identificaciones
 * 5. Envía email de confirmación (o fallo parcial)
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

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

        // Validar JWT
        const authHeader = req.headers.get('authorization') || ''
        const token = authHeader.replace('Bearer ', '')

        const supabaseAnon = createClient(supabaseUrl, anonKey)
        const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token)

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'No autorizado' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
        const { radicado } = await req.json()

        if (!radicado) {
            return new Response(
                JSON.stringify({ error: 'Campo requerido: radicado' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 1. Obtener registro con expected_files
        const { data: registro, error: fetchError } = await supabaseAdmin
            .from('soportes_facturacion')
            .select('*')
            .eq('radicado', radicado)
            .single()

        if (fetchError || !registro) {
            return new Response(
                JSON.stringify({ error: `Radicado ${radicado} no encontrado` }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const expectedFiles: ExpectedFile[] = registro.expected_files || []

        // 2. Verificar cada archivo en Storage y generar signed download URLs
        const urlsPorCategoria: Record<string, string[]> = {}
        const identificaciones = new Set<string>()
        const archivosExitosos: string[] = []
        const archivosFaltantes: { category: string; originalName: string; path: string }[] = []

        for (const file of expectedFiles) {
            const { data: urlData } = await supabaseAdmin.storage
                .from('soportes-facturacion')
                .createSignedUrl(file.path, 31536000) // 1 año

            if (urlData?.signedUrl) {
                // Archivo encontrado en Storage
                const columnName = getCategoriaColumnName(file.category as CategoriaArchivo)
                if (!urlsPorCategoria[columnName]) {
                    urlsPorCategoria[columnName] = []
                }
                urlsPorCategoria[columnName].push(urlData.signedUrl)
                archivosExitosos.push(file.originalName)

                // Extraer identificación del nombre del archivo en Storage
                const nombreArchivo = file.path.split('/').pop() || ''
                const id = extraerIdentificacionArchivo(nombreArchivo)
                if (id) {
                    identificaciones.add(id)
                    const soloNumero = id.replace(/^(CC|TI|CE|CN|SC|PE|PT|RC|ME|AS)/i, '')
                    if (soloNumero) identificaciones.add(soloNumero)
                }
            } else {
                // Archivo NO encontrado
                archivosFaltantes.push({
                    category: file.category,
                    originalName: file.originalName,
                    path: file.path,
                })
            }
        }

        // 3. Determinar estado final
        const todosSubidos = archivosFaltantes.length === 0
        const falloTotal = archivosExitosos.length === 0 && archivosFaltantes.length > 0
        const uploadStatus = todosSubidos ? 'completed' : (falloTotal ? 'failed' : 'partial')

        // 4. Si fallo total: notificar por email, eliminar registro y retornar
        if (falloTotal) {
            console.warn(`[finalizar-radicacion] ${radicado}: FALLO TOTAL - 0/${expectedFiles.length} archivos recibidos`)

            try {
                const fallosPorCategoria = archivosFaltantes.reduce((acc, f) => {
                    const existing = acc.find(g => g.categoria === f.category)
                    if (existing) {
                        existing.nombres.push(f.originalName)
                    } else {
                        acc.push({ categoria: f.category, nombres: [f.originalName] })
                    }
                    return acc
                }, [] as { categoria: string; nombres: string[] }[])

                // Email de fallo total al radicador
                await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${anonKey}`,
                    },
                    body: JSON.stringify({
                        type: 'fallo_subida',
                        destinatario: registro.radicador_email,
                        radicado,
                        datos: {
                            archivosFallidos: fallosPorCategoria,
                            archivosExitosos: 0,
                            totalArchivos: expectedFiles.length,
                            timestamp: new Date().toLocaleString('es-CO'),
                            falloTotal: true,
                            radicadoEliminado: true,
                            erroresDetalle: archivosFaltantes.map(f => ({
                                nombre: f.originalName,
                                razon: 'Archivo no recibido en el servidor. Posible interrupción de la conexión.',
                            })),
                        },
                    }),
                })
            } catch (emailError) {
                console.error(`[finalizar-radicacion] ${radicado}: Error enviando email de fallo total:`, emailError)
            }

            // Eliminar archivos huérfanos del Storage (por si alguno llegó parcialmente)
            for (const file of expectedFiles) {
                await supabaseAdmin.storage.from('soportes-facturacion').remove([file.path])
            }

            // Eliminar registro de BD
            const { error: deleteError } = await supabaseAdmin
                .from('soportes_facturacion')
                .delete()
                .eq('radicado', radicado)

            if (deleteError) {
                console.error(`[finalizar-radicacion] Error eliminando registro ${radicado}:`, deleteError)
            }

            // Notificar error crítico
            await notifyCriticalError({
                category: 'STORAGE_FAILURE',
                errorMessage: `Radicado ${radicado}: FALLO TOTAL - 0/${expectedFiles.length} archivos. Registro eliminado.`,
                feature: 'Soportes de Facturación',
                severity: 'CRITICAL',
                metadata: {
                    radicado,
                    archivosFaltantes: archivosFaltantes.map(f => f.originalName),
                    radicadorEmail: registro.radicador_email,
                    eliminado: true,
                },
            })

            return new Response(
                JSON.stringify({
                    success: false,
                    radicado,
                    uploadStatus: 'failed',
                    archivosExitosos: 0,
                    archivosFaltantes: archivosFaltantes.length,
                    totalEsperados: expectedFiles.length,
                    eliminado: true,
                    mensaje: 'Ningún archivo fue recibido. El radicado fue eliminado. Debe realizar una nueva radicación.',
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 5. Actualizar BD con URLs y estado (completed o partial)
        const updateData: Record<string, unknown> = {
            ...urlsPorCategoria,
            upload_status: uploadStatus,
            upload_completed_at: new Date().toISOString(),
        }

        // Marcar expected_files con uploaded = true donde corresponda
        const updatedExpectedFiles = expectedFiles.map(f => ({
            ...f,
            uploaded: !archivosFaltantes.some(m => m.path === f.path),
        }))
        updateData.expected_files = updatedExpectedFiles

        if (identificaciones.size > 0) {
            updateData.identificaciones_archivos = Array.from(identificaciones)
        }

        const { error: updateError } = await supabaseAdmin
            .from('soportes_facturacion')
            .update(updateData)
            .eq('radicado', radicado)

        if (updateError) {
            console.error(`[finalizar-radicacion] Error actualizando ${radicado}:`, updateError)
        }

        // 6. Enviar email de confirmación vía send-email Edge Function
        try {
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

            if (todosSubidos) {
                // Email de confirmación exitosa
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
                console.info(`[finalizar-radicacion] ${radicado}: Email de confirmación enviado`)
            } else {
                // Email de fallo parcial (algunos archivos llegaron, otros no)
                const fallosPorCategoria = archivosFaltantes.reduce((acc, f) => {
                    const existing = acc.find(g => g.categoria === f.category)
                    if (existing) {
                        existing.nombres.push(f.originalName)
                    } else {
                        acc.push({ categoria: f.category, nombres: [f.originalName] })
                    }
                    return acc
                }, [] as { categoria: string; nombres: string[] }[])

                await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${anonKey}`,
                    },
                    body: JSON.stringify({
                        type: 'fallo_subida',
                        destinatario: registro.radicador_email,
                        radicado,
                        datos: {
                            archivosFallidos: fallosPorCategoria,
                            archivosExitosos: archivosExitosos.length,
                            totalArchivos: expectedFiles.length,
                            timestamp: new Date().toLocaleString('es-CO'),
                            falloTotal: false,
                            erroresDetalle: archivosFaltantes.map(f => ({
                                nombre: f.originalName,
                                razon: 'Archivo no recibido en el servidor. Posible interrupción de la conexión.',
                            })),
                        },
                    }),
                })

                // Notificar error crítico
                await notifyCriticalError({
                    category: 'STORAGE_FAILURE',
                    errorMessage: `Radicado ${radicado}: ${archivosFaltantes.length}/${expectedFiles.length} archivos no llegaron a Storage`,
                    feature: 'Soportes de Facturación',
                    severity: 'HIGH',
                    metadata: {
                        radicado,
                        archivosFaltantes: archivosFaltantes.map(f => f.originalName),
                        archivosExitosos: archivosExitosos.length,
                    },
                })

                console.warn(`[finalizar-radicacion] ${radicado}: ${archivosFaltantes.length} archivos faltantes`)
            }
        } catch (emailError) {
            console.error(`[finalizar-radicacion] ${radicado}: Error enviando email:`, emailError)
        }

        return new Response(
            JSON.stringify({
                success: true,
                radicado,
                uploadStatus,
                archivosExitosos: archivosExitosos.length,
                archivosFaltantes: archivosFaltantes.length,
                totalEsperados: expectedFiles.length,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[finalizar-radicacion] Error:', error)

        await notifyCriticalError({
            category: 'DATABASE_ERROR',
            errorMessage: `Error en finalizar-radicacion: ${error instanceof Error ? error.message : String(error)}`,
            feature: 'Soportes de Facturación',
            severity: 'CRITICAL',
            error: error instanceof Error ? error : undefined,
        })

        return new Response(
            JSON.stringify({ error: 'Error interno del servidor' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
