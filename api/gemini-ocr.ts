/**
 * Vercel Serverless Function
 * Endpoint seguro para OCR de PDF con Gemini Vision (fallback)
 * 
 * La API key NO se expone al frontend
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY // Sin prefijo VITE_

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // Solo permitir POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' })
    }

    // Validar API key configurada
    if (!GEMINI_API_KEY) {
        console.error('[API Gemini OCR] GEMINI_API_KEY no configurada')
        return res.status(500).json({
            error: 'Configuración del servidor incompleta'
        })
    }

    try {
        const { pdfBase64 } = req.body

        // Validar input
        if (!pdfBase64 || typeof pdfBase64 !== 'string') {
            return res.status(400).json({
                error: 'PDF base64 inválido o vacío'
            })
        }

        console.log('[API Gemini OCR] Iniciando OCR con Gemini Vision (Modelo 1.5 Flash)...')

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`

        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
                        { text: 'Extrae TODO el texto de este documento PDF. Devuelve ÚNICAMENTE el texto extraído. Si no hay texto, responde "SIN_TEXTO".' }
                    ]
                }],
                generationConfig: { temperature: 0, maxOutputTokens: 8192 }
            })
        })

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text()
            console.error('[API Gemini OCR] Error:', geminiResponse.status, errorText)
            return res.status(geminiResponse.status).json({
                error: `Error de Gemini API: ${geminiResponse.status}`,
                details: errorText
            })
        }

        const data = await geminiResponse.json()

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const extractedText = data.candidates[0].content.parts[0].text
            const finalText = extractedText === 'SIN_TEXTO' ? '' : extractedText

            console.log(`[API Gemini OCR] ✅ OCR exitoso (${finalText.length} caracteres)`)

            return res.status(200).json({
                success: true,
                text: finalText
            })
        }

        console.warn('[API Gemini OCR] Respuesta sin texto válido')
        return res.status(200).json({
            success: true,
            text: ''
        })

    } catch (error) {
        console.error('[API Gemini OCR] Error:', error)
        return res.status(500).json({
            error: 'Error interno del servidor',
            details: error instanceof Error ? error.message : 'Error desconocido'
        })
    }
}
