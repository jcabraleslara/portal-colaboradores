/**
 * Supabase Edge Function: OCR de PDF con Gemini Vision (fallback)
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * POST /functions/v1/gemini-ocr
 * Body: { pdfBase64: string }
 */

import { corsHeaders } from '../_shared/cors.ts'
import { notifyApiKeyFailure, notifyServiceUnavailable } from '../_shared/critical-error-utils.ts'

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
        console.error('[API Gemini OCR] GEMINI_API_KEY no configurada')
        return new Response(
            JSON.stringify({ error: 'Configuracion del servidor incompleta' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        const { pdfBase64 } = await req.json()

        // Validar input
        if (!pdfBase64 || typeof pdfBase64 !== 'string') {
            return new Response(
                JSON.stringify({ error: 'PDF base64 invalido o vacio' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('[API Gemini OCR] Iniciando OCR con Gemini Vision...')

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
                        { text: 'Extrae TODO el texto de este documento PDF. Devuelve UNICAMENTE el texto extraido. Si no hay texto, responde "SIN_TEXTO".' }
                    ]
                }],
                generationConfig: { temperature: 0, maxOutputTokens: 8192 }
            })
        })

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text()
            console.error('[API Gemini OCR] Error:', geminiResponse.status, errorText)

            // Si es error de API key (401/403), notificar al equipo tecnico
            if (geminiResponse.status === 401 || geminiResponse.status === 403) {
                console.error('ERROR CRITICO: API key de Gemini invalida o expirada')
                await notifyApiKeyFailure(
                    'Gemini API (Vision)',
                    'OCR de Documentos PDF',
                    geminiResponse.status
                )
            }
            // Si es servicio no disponible (503), notificar
            else if (geminiResponse.status === 503) {
                console.error('ERROR CRITICO: Servicio de Gemini no disponible')
                await notifyServiceUnavailable(
                    'Gemini API (Vision)',
                    'OCR de Documentos PDF',
                    geminiResponse.status
                )
            }

            return new Response(
                JSON.stringify({
                    error: `Error de Gemini API: ${geminiResponse.status}`,
                    details: errorText
                }),
                { status: geminiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const data = await geminiResponse.json()

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const extractedText = data.candidates[0].content.parts[0].text
            const finalText = extractedText === 'SIN_TEXTO' ? '' : extractedText

            console.log(`[API Gemini OCR] OCR exitoso (${finalText.length} caracteres)`)

            return new Response(
                JSON.stringify({
                    success: true,
                    text: finalText
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.warn('[API Gemini OCR] Respuesta sin texto valido')
        return new Response(
            JSON.stringify({
                success: true,
                text: ''
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[API Gemini OCR] Error:', error)
        return new Response(
            JSON.stringify({
                error: 'Error interno del servidor',
                details: error instanceof Error ? error.message : 'Error desconocido'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
