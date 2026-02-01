/**
 * Supabase Edge Function: Generar contrarreferencias con Gemini
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * POST /functions/v1/generar-contrarreferencia
 * Body: { textoSoporte: string, especialidad?: string }
 */

import { corsHeaders } from '../_shared/cors.ts'

/**
 * Prompt especializado de auditor medico senior
 */
const PROMPT_CONTRARREFERENCIA = `Eres un auditor medico senior con mas de 15 años de experiencia en revision de pertinencia medica en el sistema de salud colombiano.

HISTORIA CLINICA A EVALUAR:
{texto_soporte}

ESPECIALIDAD DE DESTINO: {especialidad}

=== GENERA EXACTAMENTE ESTE FORMATO ===

**CONTRA REFERENCIA**

Se contra remite el caso de [anota el nombre y el apellido del paciente], al primer nivel de atencion por las siguientes razones:

1. **Criterios clinicos:**
[OBLIGATORIO: Escribe 1 oracion explicando las incongruencias clinicas, falta de justificacion para la remision, o por que no se justifica el nivel de complejidad solicitado.]

2. **Tratamiento previo:**
[OBLIGATORIO: Escribe 1 oracion sobre que tratamientos del primer nivel NO se han instaurado antes de remitir. Si no hay registro de tratamiento previo, indica que es motivo de contra referencia.]

3. **Estudios paraclinicos:**
[OBLIGATORIO: Escribe 1 oracion indicando que estudios basicos del primer nivel faltan (hemograma, glicemia, EKG, radiografias simples). NO recomendar ecografias, resonancias ni tomografias.]

4. **Completitud documental:**
[OBLIGATORIO: Escribe 1 oracion sobre elementos faltantes o inconsistencias en la historia clinica, anamnesis incompleta, o examen fisico deficiente.]

=== REGLAS ESTRICTAS ===
- DEBES completar los 4 puntos OBLIGATORIAMENTE
- Cada punto DEBE tener 1 oracion explicativa
- NO puedes terminar antes de completar los 4 puntos
- La respuesta debe arrancar directamente con "CONTRA REFERENCIA"
- NO incluir introducciones ni citation markers [1], [2]
- Se tecnico pero claro en tu lenguaje medico`

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
        console.error('[API] GEMINI_API_KEY no configurada en variables de entorno')
        return new Response(
            JSON.stringify({ error: 'Configuracion del servidor incompleta' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        const { textoSoporte, especialidad = 'No especificada' } = await req.json()

        // Validar input
        if (!textoSoporte || textoSoporte.length < 50) {
            return new Response(
                JSON.stringify({ error: 'Texto de soporte invalido o muy corto' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`[API] Generando contrarreferencia para especialidad: ${especialidad}`)
        console.log(`[API] Longitud texto soporte: ${textoSoporte.length} caracteres`)

        // Reemplazar variables en el prompt
        const promptFinal = PROMPT_CONTRARREFERENCIA
            .replace('{texto_soporte}', textoSoporte)
            .replace('{especialidad}', especialidad)

        // Sistema de fallback robusto: modelos estables de produccion
        const MODELS_FALLBACK = [
            'gemini-2.5-flash',    // Modelo principal (estable, rapido)
            'gemini-2.0-flash',    // Fallback 1 (muy estable)
            'gemini-1.5-flash'     // Fallback 2 (legacy pero confiable)
        ]

        let lastError: unknown = null

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
                            temperature: 0.3,
                            maxOutputTokens: 3000,
                            topP: 0.95,
                            topK: 40
                        }
                    })
                })

                // Si es 503 (Service Unavailable), intentar siguiente modelo
                if (geminiResponse.status === 503) {
                    console.log(`[API] Modelo ${modelName} no disponible (503), intentando siguiente...`)
                    lastError = { status: 503, model: modelName }
                    continue
                }

                // Si es otro error, retornar inmediatamente
                if (!geminiResponse.ok) {
                    const errorText = await geminiResponse.text()
                    console.error(`[API] Error ${geminiResponse.status} con ${modelName}:`, errorText)
                    return new Response(
                        JSON.stringify({
                            error: `Error de Gemini API: ${geminiResponse.status}`,
                            details: errorText,
                            model: modelName
                        }),
                        { status: geminiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                // Exito - procesar respuesta
                const data = await geminiResponse.json()

                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const textoGenerado = data.candidates[0].content.parts[0].text.trim()
                    console.log(`[API] Contrarreferencia generada con ${modelName} (${textoGenerado.length} caracteres)`)

                    return new Response(
                        JSON.stringify({
                            success: true,
                            texto: textoGenerado,
                            model: modelName
                        }),
                        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                console.error(`[API] Respuesta de ${modelName} sin contenido valido`)
                lastError = { status: 'no_content', model: modelName }
                continue

            } catch (error) {
                console.error(`[API] Excepcion con modelo ${modelName}:`, error)
                lastError = { error, model: modelName }
                continue
            }
        }

        // Si llegamos aqui, todos los modelos fallaron
        console.error('[API] TODOS los modelos fallaron:', lastError)
        return new Response(
            JSON.stringify({
                error: 'Servicio de IA temporalmente no disponible. Intenta nuevamente en unos momentos.',
                details: 'Todos los modelos de respaldo fallaron',
                lastError
            }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[API] Error general en generacion:', error)
        return new Response(
            JSON.stringify({
                error: 'Error interno del servidor',
                details: error instanceof Error ? error.message : 'Error desconocido'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
