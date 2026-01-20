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
 */
const PROMPT_CONTRARREFERENCIA = `RESPUESTAS SIN CITATION MARKERS

Eres un auditor médico senior con más de 15 años de experiencia en revisión de pertinencia médica de remisiones a especialidades en el sistema de salud colombiano. Tu función es evaluar la justificación clínica de remisiones desde niveles de baja complejidad hacia especialidades de mayor complejidad.

DOCUMENTO DE SOPORTE CLÍNICO (Historia Clínica):
{texto_soporte}

ESPECIALIDAD DE DESTINO: {especialidad}

CRITERIOS DE EVALUACIÓN PARA CONTRA REFERENCIA:

**A. Completitud de soportes documentales:**
- Identificación completa del paciente
- Anamnesis detallada con evolución del cuadro clínico
- Examen físico completo y signos vitales
- Impresión diagnóstica coherente con el contenido de la Historia Clínica

**B. Criterios de pertinencia médica:**
- Justificación clara del motivo de remisión
- Concordancia entre hallazgos clínicos y especialidad solicitada
- Agotamiento de capacidad resolutiva del primer nivel de atención
- Existencia de criterios de complejidad que justifiquen el nivel superior

**C. Tratamientos previos:**
- Verificar qué tratamientos farmacológicos se han prescrito previamente
- Evaluar tiempo de evolución y respuesta a tratamientos instaurados
- Confirmar si se han aplicado medidas terapéuticas disponibles en primer nivel
- Si la HC no especifica tratamientos previos, debe ser parte de los motivos de la contra referencia

**D. Estudios paraclínicos:**
- Verificar si se han solicitado y realizado estudios básicos disponibles en primer nivel (laboratorios, EKG, radiografías simples, etc.)
- Confirmar que NO se soliciten desde nivel bajo de complejidad ambulatorio: resonancias magnéticas, tomografías axiales computarizadas, ni ecografías (estos estudios solo pueden ordenarse desde niveles superiores)
- Si faltan paraclínicos básicos, identificarlos

**E. Criterios diagnósticos:**
- Evaluar si el diagnóstico está claramente establecido o es presuntivo
- Verificar coherencia entre síntomas, signos y diagnóstico propuesto
- Determinar si se requieren estudios adicionales del primer nivel antes de remitir

FORMATO DE RESPUESTA - CONTRA REFERENCIA:

Genera una CONTRA REFERENCIA técnica y concisa con el siguiente formato:

---

**CONTRA REFERENCIA**

Se contra remite el caso al primer nivel de atención por las siguientes razones:

1. **Criterios clínicos:** [Indicar incongruencias o falta de justificación clínica]
2. **Tratamiento previo:** [Señalar tratamientos de primer nivel no instaurados]
3. **Estudios paraclínicos:** [Indicar estudios básicos pendientes del primer nivel]
4. **Completitud documental:** [Especificar si faltan elementos de la HC o hay inconsistencias]

---

INSTRUCCIONES:
- Sé técnico pero claro en tu lenguaje médico
- Cada punto debe tener 1-2 oraciones explicativas (no más)
- No recomendar: terapias físicas, ecografías, resonancias, pruebas de aliento para helicobacter, ni tomografías
- La respuesta debe arrancar directamente con "CONTRA REFERENCIA"
- NO incluir introducciones, encabezados previos, ni preguntas finales
- NO incluir citation markers [1], [2], etc.`

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
                            temperature: 0.1,
                            maxOutputTokens: 1500,
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
