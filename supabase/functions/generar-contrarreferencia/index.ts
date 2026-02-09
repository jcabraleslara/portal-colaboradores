/**
 * Supabase Edge Function: Generar contrarreferencias con Gemini
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * POST /functions/v1/generar-contrarreferencia
 * Body: { textoSoporte: string, especialidad?: string }
 *    O: { pdfUrl: string, especialidad?: string }
 *
 * Modo texto: recibe texto plano extraido previamente (mas rapido)
 * Modo multimodal: recibe URL de PDF, Gemini lo lee directo (sin OCR separado)
 */

import { corsHeaders } from '../_shared/cors.ts'

/**
 * Prompt especializado de auditor medico senior
 */
const PROMPT_CONTRARREFERENCIA = `Eres un auditor medico senior con mas de 15 años de experiencia en revision de pertinencia medica en el sistema de salud colombiano.

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

/**
 * Descarga un PDF desde una URL publica y retorna bytes en base64
 */
async function descargarPdfBase64(pdfUrl: string): Promise<string> {
    console.log(`[API] Descargando PDF desde URL (${pdfUrl.substring(0, 80)}...)`)
    const response = await fetch(pdfUrl)

    if (!response.ok) {
        throw new Error(`Error descargando PDF: HTTP ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    // Convertir a base64 en chunks para evitar stack overflow
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize)
        binary += String.fromCharCode(...chunk)
    }

    const base64 = btoa(binary)
    console.log(`[API] PDF descargado: ${bytes.length} bytes → ${base64.length} chars base64`)
    return base64
}

/**
 * Construye el body para Gemini API segun el modo (texto o multimodal)
 */
function buildGeminiBody(
    mode: 'text' | 'multimodal',
    promptFinal: string,
    pdfBase64?: string
): Record<string, unknown> {
    if (mode === 'multimodal' && pdfBase64) {
        return {
            contents: [{
                parts: [
                    {
                        inline_data: {
                            mime_type: 'application/pdf',
                            data: pdfBase64
                        }
                    },
                    {
                        text: `Analiza la historia clinica del PDF adjunto y genera la contrarreferencia.\n\n${promptFinal}`
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 3000,
                topP: 0.95,
                topK: 40
            }
        }
    }

    // Modo texto puro
    return {
        contents: [{
            parts: [{ text: promptFinal }]
        }],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 3000,
            topP: 0.95,
            topK: 40
        }
    }
}

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
        const body = await req.json()
        const { textoSoporte, pdfUrl, especialidad = 'No especificada' } = body

        // Determinar modo de operacion
        const hasText = textoSoporte && textoSoporte.length >= 50
        const hasPdf = pdfUrl && typeof pdfUrl === 'string' && pdfUrl.startsWith('http')

        if (!hasText && !hasPdf) {
            return new Response(
                JSON.stringify({ error: 'Se requiere textoSoporte (min 50 chars) o pdfUrl valido' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const mode = hasText ? 'text' : 'multimodal'
        console.log(`[API] Modo: ${mode} | Especialidad: ${especialidad}`)

        // Preparar prompt segun modo
        let promptFinal: string
        let pdfBase64: string | undefined

        if (mode === 'text') {
            promptFinal = `HISTORIA CLINICA A EVALUAR:\n${textoSoporte}\n\n${PROMPT_CONTRARREFERENCIA.replace('{especialidad}', especialidad)}`
            console.log(`[API] Texto soporte: ${textoSoporte.length} caracteres`)
        } else {
            // Modo multimodal: descargar PDF
            pdfBase64 = await descargarPdfBase64(pdfUrl)
            promptFinal = PROMPT_CONTRARREFERENCIA.replace('{especialidad}', especialidad)
        }

        // Modelos con fallback (Gemini 3 Flash como principal, mas rapido y multimodal nativo)
        const MODELS_FALLBACK = [
            'gemini-3-flash-preview',  // Modelo principal (rapido, multimodal nativo)
            'gemini-2.5-flash',        // Fallback (estable)
        ]

        let lastError: unknown = null

        // Intentar con cada modelo hasta que uno funcione
        for (const modelName of MODELS_FALLBACK) {
            try {
                console.log(`[API] Intentando con modelo: ${modelName} (${mode})`)

                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`
                const geminiBody = buildGeminiBody(mode, promptFinal, pdfBase64)

                const geminiResponse = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(geminiBody)
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
                    console.log(`[API] Contrarreferencia generada con ${modelName} (${textoGenerado.length} chars, modo: ${mode})`)

                    return new Response(
                        JSON.stringify({
                            success: true,
                            texto: textoGenerado,
                            model: modelName,
                            mode
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
