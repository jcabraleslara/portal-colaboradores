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

Cuando encuentres que la remisión NO cumple criterios de pertinencia, debes generar una CONTRA REFERENCIA técnica y DETALLADA con el siguiente formato:

---

**CONTRA REFERENCIA**

Se contra remite el caso al primer nivel de atención por las siguientes razones:

1. **Completitud documental:** [Especificar DETALLADAMENTE si faltan elementos de la HC, cuáles exactamente]
2. **Criterios clínicos:** [Indicar TODAS las incongruencias o faltas de justificación encontradas]
3. **Tratamiento previo:** [Señalar ESPECÍFICAMENTE qué tratamientos de primer nivel no se instauraron y deberían aplicarse]
4. **Estudios paraclínicos:** [Indicar TODOS los estudios básicos pendientes del primer nivel, justificando por qué son necesarios]

**Recomendaciones para el primer nivel:**
[Proporcionar alternativas terapéuticas CONCRETAS y DETALLADAS]

---

IMPORTANTE - REQUISITOS DE CALIDAD:
- Cada punto (1-4) debe tener AL MENOS 2-3 oraciones explicativas
- Sé técnico pero claro en tu lenguaje médico
- Fundamenta cada contra referencia en criterios clínicos objetivos y específicos
- Proporciona alternativas terapéuticas CONCRETAS para el primer nivel
- Mantén un tono profesional orientado a mejorar la calidad de atención
- La respuesta debe ser COMPLETA y RIGUROSA, no un resumen superficial
- No debes recomendar: terapias físicas, ecografías, resonancias, pruebas de aliento para helicobacter, ni tomografías (no son de manejo del primer nivel)

FORMATO FINAL:
- La respuesta debe arrancar directamente con el encabezado "CONTRA REFERENCIA"
- NO incluir introducciones previas, ni encabezados previos, ni preguntas finales
- NO incluir citation markers [1], [2], etc.
- El texto debe ser listo para copiar y pegar en el software de Historias Clínicas

LONGITUD ESPERADA: La contrarreferencia debe ser DETALLADA y COMPLETA (aproximadamente 300-500 palabras), no un simple listado.`

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

        // Llamar a Gemini API - gemini-3-flash-preview (rápido + respuestas completas)
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`

        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: promptFinal }]
                }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 4096,  // Suficiente para contrarreferencias médicas completas
                    topP: 0.95,
                    topK: 40
                }
            })
        })

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text()
            console.error('[API] Gemini error:', geminiResponse.status, errorText)
            return res.status(geminiResponse.status).json({
                error: `Error de Gemini API: ${geminiResponse.status}`,
                details: errorText
            })
        }

        const data = await geminiResponse.json()

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const textoGenerado = data.candidates[0].content.parts[0].text.trim()
            console.log(`[API] ✅ Contrarreferencia generada exitosamente (${textoGenerado.length} caracteres)`)

            return res.status(200).json({
                success: true,
                texto: textoGenerado
            })
        }

        console.error('[API] Respuesta de Gemini sin contenido válido')
        return res.status(500).json({
            error: 'Respuesta de Gemini sin contenido válido'
        })

    } catch (error) {
        console.error('[API] Error en generación:', error)
        return res.status(500).json({
            error: 'Error interno del servidor',
            details: error instanceof Error ? error.message : 'Error desconocido'
        })
    }
}
