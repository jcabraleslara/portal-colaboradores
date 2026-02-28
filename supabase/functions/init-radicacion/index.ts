/**
 * Supabase Edge Function: Iniciar Radicación
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * POST /functions/v1/init-radicacion
 * Body: { metadata de radicación + manifiesto de archivos (sin contenido) }
 *
 * 1. Valida JWT del usuario
 * 2. Inserta registro en soportes_facturacion con upload_status: 'uploading'
 * 3. Genera signed upload URLs para cada archivo declarado
 * 4. Retorna radicado + tokens de upload
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { notifyCriticalError } from '../_shared/critical-error-utils.ts'
import {
    type EpsFacturacion,
    type ServicioPrestado,
    type CategoriaArchivo,
    generarRutaArchivo,
    extraerIdentificacionArchivo,
} from '../_shared/file-naming-utils.ts'

interface ArchivoManifest {
    name: string
    size: number
}

interface GrupoArchivos {
    categoria: CategoriaArchivo
    files: ArchivoManifest[]
}

interface InitRadicacionRequest {
    radicadorEmail: string
    radicadorNombre?: string
    eps: EpsFacturacion
    regimen: string
    servicioPrestado: ServicioPrestado
    fechaAtencion: string
    tipoId?: string
    identificacion?: string
    nombresCompletos?: string
    observaciones?: string
    archivos: GrupoArchivos[]
}

interface ExpectedFile {
    path: string
    category: string
    originalName: string
    uploaded: boolean
}

interface UploadToken {
    signedUrl: string
    token: string
    path: string
    category: string
    originalName: string
}

Deno.serve(async (req: Request) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

        // Validar JWT del usuario
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

        // Cliente con service role para bypass RLS
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

        const body: InitRadicacionRequest = await req.json()

        // Validar campos requeridos
        if (!body.radicadorEmail || !body.eps || !body.regimen || !body.servicioPrestado || !body.fechaAtencion) {
            return new Response(
                JSON.stringify({ error: 'Campos requeridos faltantes: radicadorEmail, eps, regimen, servicioPrestado, fechaAtencion' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 1. Insertar registro en BD (el trigger genera el radicado)
        const insertData: Record<string, unknown> = {
            radicador_email: body.radicadorEmail,
            radicador_nombre: body.radicadorNombre || null,
            eps: body.eps,
            regimen: body.regimen,
            servicio_prestado: body.servicioPrestado,
            fecha_atencion: body.fechaAtencion,
            tipo_id: body.tipoId || null,
            identificacion: body.identificacion || null,
            nombres_completos: body.nombresCompletos || null,
            observaciones_facturacion: body.observaciones || null,
            upload_status: 'uploading',
            upload_started_at: new Date().toISOString(),
        }

        const { data: registro, error: insertError } = await supabaseAdmin
            .from('soportes_facturacion')
            .insert(insertData)
            .select()
            .single()

        if (insertError || !registro) {
            console.error('Error insertando radicación:', insertError)
            return new Response(
                JSON.stringify({ error: 'Error al crear la radicación: ' + (insertError?.message || 'desconocido') }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const radicado: string = registro.radicado
        const soporteId: string = registro.id

        // 2. Generar signed upload URLs para cada archivo
        const uploadTokens: UploadToken[] = []
        const expectedFiles: ExpectedFile[] = []
        const contadorNombres = new Map<string, number>()

        for (const grupo of body.archivos) {
            for (const archivo of grupo.files) {
                const { nombreFinal, ruta } = generarRutaArchivo(
                    archivo.name,
                    grupo.categoria,
                    radicado,
                    body.eps,
                    body.servicioPrestado,
                    contadorNombres
                )

                // Generar signed upload URL (válida 30 minutos)
                const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
                    .from('soportes-facturacion')
                    .createSignedUploadUrl(ruta)

                if (uploadError || !uploadData) {
                    console.error(`Error generando signed URL para ${ruta}:`, uploadError)
                    // Continuar con los demás archivos
                    continue
                }

                uploadTokens.push({
                    signedUrl: uploadData.signedUrl,
                    token: uploadData.token,
                    path: ruta,
                    category: grupo.categoria,
                    originalName: archivo.name,
                })

                expectedFiles.push({
                    path: ruta,
                    category: grupo.categoria,
                    originalName: archivo.name,
                    uploaded: false,
                })
            }
        }

        // 3. Guardar expected_files en BD
        const { error: updateError } = await supabaseAdmin
            .from('soportes_facturacion')
            .update({ expected_files: expectedFiles })
            .eq('id', soporteId)

        if (updateError) {
            console.warn(`Error guardando expected_files para ${radicado}:`, updateError)
        }

        console.info(`[init-radicacion] ${radicado}: ${uploadTokens.length} signed URLs generadas`)

        return new Response(
            JSON.stringify({
                success: true,
                radicado,
                soporteId,
                uploadTokens,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[init-radicacion] Error:', error)

        await notifyCriticalError({
            category: 'DATABASE_ERROR',
            errorMessage: `Error en init-radicacion: ${error instanceof Error ? error.message : String(error)}`,
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
