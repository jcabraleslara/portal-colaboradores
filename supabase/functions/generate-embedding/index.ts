/**
 * Supabase Edge Function: Generar Embeddings con Gemini
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * POST /functions/v1/generate-embedding
 * Body: { text: string }
 */

import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
    // Manejar preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Solo permitir POST
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Metodo no permitido' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

    // Validar API key configurada
    if (!GEMINI_API_KEY) {
        console.error('[API Embedding] GEMINI_API_KEY no configurada')
        return new Response(
            JSON.stringify({ error: 'Configuracion del servidor incompleta' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        const { text } = await req.json()

        // Validar input
        if (!text || typeof text !== 'string' || text.length < 1) {
            return new Response(
                JSON.stringify({ error: 'Texto invalido o vacio' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (text.length > 10000) {
            return new Response(
                JSON.stringify({ error: 'Texto demasiado largo (maximo 10,000 caracteres)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`[API Embedding] Generando embedding para texto de ${text.length} caracteres`)

        // Llamar a Gemini Embedding API
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`

        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: {
                    parts: [{ text }]
                }
            })
        })

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text()
            console.error('[API Embedding] Gemini error:', geminiResponse.status, errorText)
            return new Response(
                JSON.stringify({
                    error: `Error de Gemini API: ${geminiResponse.status}`,
                    details: errorText
                }),
                { status: geminiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const data = await geminiResponse.json()

        if (data.embedding?.values) {
            const embedding = data.embedding.values
            console.log(`[API Embedding] Embedding generado (dimension: ${embedding.length})`)

            return new Response(
                JSON.stringify({
                    success: true,
                    embedding,
                    dimensions: embedding.length
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.error('[API Embedding] Respuesta sin embedding valido')
        return new Response(
            JSON.stringify({ error: 'Respuesta de Gemini sin embedding valido' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[API Embedding] Error:', error)
        return new Response(
            JSON.stringify({
                error: 'Error interno del servidor',
                details: error instanceof Error ? error.message : 'Error desconocido'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
