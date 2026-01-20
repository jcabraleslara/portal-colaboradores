/**
 * Vercel Serverless Function
 * Endpoint seguro para generar contrarreferencias con Gemini 3 Flash
 * 
 * La API key NO se expone al frontend
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY // Sin prefijo VITE_

/**
 * Prompt especializado de auditor médico senior
 * IMPORTANTE: Las instrucciones OBLIGATORIAS son críticas para que el modelo complete los 4 puntos
 */
const PROMPT_CONTRARREFERENCIA = `Eres un auditor médico senior con más de 15 años de experiencia en revisión de pertinencia médica en el sistema de salud colombiano.

HISTORIA CLÍNICA A EVALUAR:
{texto_soporte}

ESPECIALIDAD DE DESTINO: {especialidad}

=== GENERA EXACTAMENTE ESTE FORMATO ===

**CONTRA REFERENCIA**

Se contra remite el caso al primer nivel de atención por las siguientes razones:

1. **Criterios clínicos:** 
[OBLIGATORIO: Escribe MÍNIMO 1 oración explicando las incongruencias clínicas, falta de justificación para la remisión, o por qué no se justifica el nivel de complejidad solicitado.]

2. **Tratamiento previo:** 
[OBLIGATORIO: Escribe MÍNIMO 1 oración sobre qué tratamientos del primer nivel NO se han instaurado antes de remitir. Si no hay registro de tratamiento previo, indica que es motivo de contra referencia.]

3. **Estudios paraclínicos:** 
[OBLIGATORIO: Escribe MÍNIMO 1 oración indicando qué estudios básicos del primer nivel faltan (hemograma, glicemia, EKG, radiografías simples). NO recomendar ecografías, resonancias ni tomografías.]

4. **Completitud documental:** 
[OBLIGATORIO: Escribe MÍNIMO 1 oración sobre elementos faltantes o inconsistencias en la historia clínica, anamnesis incompleta, o examen físico deficiente.]

=== REGLAS ESTRICTAS ===
- DEBES completar los 4 puntos OBLIGATORIAMENTE
- Cada punto DEBE tener mínimo 1 oración explicativa
- NO puedes terminar antes de completar los 4 puntos
- La respuesta debe arrancar directamente con "CONTRA REFERENCIA"
- NO incluir introducciones ni citation markers [1], [2]
- Sé técnico pero claro en tu lenguaje médico`

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
        console.error('[API] GEMINI_API_KEY no configurada en variables de entorno')
        return res.status(500).json({
            error: 'Configuración del servidor incompleta'
        })
    }

    try {
        const { textoSoporte, especialidad = 'No especificada' } = req.body

        // Validar input
        if (!textoSoporte || textoSoporte.length < 50) {
            return res.status(400).json({
                error: 'Texto de soporte inválido o muy corto'
            })
        }

        console.log(`[API] Generando contrarreferencia para especialidad: ${especialidad}`)
        console.log(`[API] Longitud texto soporte: ${textoSoporte.length} caracteres`)

        // Reemplazar variables en el prompt
        const promptFinal = PROMPT_CONTRARREFERENCIA
            .replace('{texto_soporte}', textoSoporte)
            .replace('{especialidad}', especialidad)

        // Sistema de fallback robusto: modelos estables de producción
        const MODELS_FALLBACK = [
            'gemini-2.5-flash',    // Modelo principal (estable, rápido)
            'gemini-2.0-flash',    // Fallback 1 (muy estable)
            'gemini-1.5-flash'     // Fallback 2 (legacy pero confiable)
        ]

        let lastError: any = null

        // Intentar con cada modelo hasta que uno funcione
        for (const modelName of MODELS_FALLBACK) {
            try {
                console.log(`[API] Intentando con modelo: ${modelName}`)

                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`

                const geminiResponse = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: promptFinal }]
                        }],
                        generationConfig: {
                            temperature: 0.3,  // Mayor variabilidad para respuestas completas
                            maxOutputTokens: 2000,  // Espacio suficiente para 4 puntos completos
                            topP: 0.95,
                            topK: 40
                        }
                    })
                })

                // Si es 503 (Service Unavailable), intentar siguiente modelo
                if (geminiResponse.status === 503) {
                    console.log(`[API] ⚠️ Modelo ${modelName} no disponible (503), intentando siguiente...`)
                    lastError = { status: 503, model: modelName }
                    continue
                }

                // Si es otro error, retornar inmediatamente
                if (!geminiResponse.ok) {
                    const errorText = await geminiResponse.text()
                    console.error(`[API] Error ${geminiResponse.status} con ${modelName}:`, errorText)
                    return res.status(geminiResponse.status).json({
                        error: `Error de Gemini API: ${geminiResponse.status}`,
                        details: errorText,
                        model: modelName
                    })
                }

                // Éxito - procesar respuesta
                const data = await geminiResponse.json()

                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const textoGenerado = data.candidates[0].content.parts[0].text.trim()
                    console.log(`[API] ✅ Contrarreferencia generada con ${modelName} (${textoGenerado.length} caracteres)`)

                    return res.status(200).json({
                        success: true,
                        texto: textoGenerado,
                        model: modelName  // Informar qué modelo se usó
                    })
                }

                console.error(`[API] Respuesta de ${modelName} sin contenido válido`)
                lastError = { status: 'no_content', model: modelName }
                continue

            } catch (error) {
                console.error(`[API] Excepción con modelo ${modelName}:`, error)
                lastError = { error, model: modelName }
                continue
            }
        }

        // Si llegamos aquí, todos los modelos fallaron
        console.error('[API] ❌ TODOS los modelos fallaron:', lastError)
        return res.status(503).json({
            error: 'Servicio de IA temporalmente no disponible. Intenta nuevamente en unos momentos.',
            details: 'Todos los modelos de respaldo fallaron',
            lastError
        })

    } catch (error) {
        console.error('[API] Error general en generación:', error)
        return res.status(500).json({
            error: 'Error interno del servidor',
            details: error instanceof Error ? error.message : 'Error desconocido'
        })
    }
}
