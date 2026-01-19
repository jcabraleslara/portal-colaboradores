/**
 * Vercel Serverless Function
 * Endpoint seguro para generar embeddings con Gemini
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
        console.error('[API Embedding] GEMINI_API_KEY no configurada')
        return res.status(500).json({
            error: 'Configuración del servidor incompleta'
        })
    }

    try {
        const { text } = req.body

        // Validar input
        if (!text || typeof text !== 'string' || text.length < 1) {
            return res.status(400).json({
                error: 'Texto inválido o vacío'
            })
        }

        if (text.length > 10000) {
            return res.status(400).json({
                error: 'Texto demasiado largo (máximo 10,000 caracteres)'
            })
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
            return res.status(geminiResponse.status).json({
                error: `Error de Gemini API: ${geminiResponse.status}`,
                details: errorText
            })
        }

        const data = await geminiResponse.json()

        if (data.embedding?.values) {
            const embedding = data.embedding.values
            console.log(`[API Embedding] ✅ Embedding generado (dimensión: ${embedding.length})`)

            return res.status(200).json({
                success: true,
                embedding,
                dimensions: embedding.length
            })
        }

        console.error('[API Embedding] Respuesta sin embedding válido')
        return res.status(500).json({
            error: 'Respuesta de Gemini sin embedding válido'
        })

    } catch (error) {
        console.error('[API Embedding] Error:', error)
        return res.status(500).json({
            error: 'Error interno del servidor',
            details: error instanceof Error ? error.message : 'Error desconocido'
        })
    }
}
