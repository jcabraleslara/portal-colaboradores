/**
 * Servicio de Generación Automática de Contrarreferencias
 * Utiliza Gemini 3 Flash para generar contrarreferencias médicas
 * basadas en documentos vectorizados
 */

import { supabase } from '@/config/supabase.config'
import { ragService } from './rag.service'
import type { ContrarreferenciaResult } from '@/types/back.types'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

/**
 * Prompt especializado de auditor médico senior
 * Variables: {texto_soporte}, {especialidad}
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

Cuando encuentres que la remisión NO cumple criterios de pertinencia, debes generar una CONTRA REFERENCIA concisa y técnica con el siguiente formato:

---

**CONTRA REFERENCIA**

Se contra remite el caso al primer nivel de atención por las siguientes razones:

1. **Completitud documental:** [Especificar si faltan elementos de la HC]
2. **Criterios clínicos:** [Indicar incongruencias o falta de justificación]
3. **Tratamiento previo:** [Señalar tratamientos de primer nivel no instaurados]
4. **Estudios paraclínicos:** [Indicar estudios básicos pendientes del primer nivel]

---

IMPORTANTE:
- Sé técnico pero claro en tu lenguaje médico
- Fundamenta cada contra referencia en criterios clínicos objetivos
- Proporciona alternativas terapéuticas concretas para el primer nivel
- Mantén un tono profesional orientado a mejorar la calidad de atención
- No debes recomendar la realización de terapias físicas, ecografías de ningún tipo, resonancias, pruebas de aliento para helicobacter, ni tomografías, puesto que no son de manejo del primer nivel de atención.

La respuesta debe ser directa e inmediata, no debe contar con introducciones previas, ni encabezados previos ni con pregunta finales al usuario. Debe arrancar directamente con el encabezado "CONTRA REFERENCIA".

Tampoco debe contener referencias tipo link a las fuentes, solo el texto disponible para copiar y pegar en el software de Historias Clínicas que es externo a gemini. No incluir citation markers [1], [2], etc.`

/**
 * Obtiene el texto completo de un documento desde sus chunks vectorizados
 */
async function obtenerTextoCompleto(radicado: string): Promise<string> {
    console.log(`[Contrarreferencia] Obteniendo chunks de ${radicado}...`)

    const { data: chunks, error } = await supabase
        .from('pdf_embeddings')
        .select('content, chunk_index')
        .eq('radicado', radicado)
        .order('chunk_index', { ascending: true })

    if (error) {
        console.error('[Contrarreferencia] Error obteniendo chunks:', error)
        throw new Error('Error obteniendo texto vectorizado')
    }

    if (!chunks || chunks.length === 0) {
        return ''
    }

    // Reconstruir texto completo concatenando chunks ordenados
    const textoCompleto = chunks.map(chunk => chunk.content).join('\n\n')
    console.log(`[Contrarreferencia] ${chunks.length} chunks reconstruidos (${textoCompleto.length} caracteres)`)

    return textoCompleto
}

/**
 * Genera contrarreferencia usando Gemini 3 Flash
 */
async function generarContrarreferenciaConIA(
    textoSoporte: string,
    especialidad: string = 'No especificada'
): Promise<{ success: boolean; texto?: string; error?: string }> {
    if (!GEMINI_API_KEY) {
        return {
            success: false,
            error: 'VITE_GEMINI_API_KEY no configurada'
        }
    }

    console.log('[Contrarreferencia] Generando con Gemini 3 Flash...')

    try {
        // Reemplazar variables en el prompt
        const promptFinal = PROMPT_CONTRARREFERENCIA
            .replace('{texto_soporte}', textoSoporte)
            .replace('{especialidad}', especialidad)

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: promptFinal }]
                }],
                generationConfig: {
                    temperature: 0,
                    maxOutputTokens: 2048,
                    topP: 0.95,
                    topK: 40
                }
            })
        })

        if (!response.ok) {
            const errorData = await response.text()
            console.error('[Contrarreferencia] Gemini error:', response.status, errorData)
            return {
                success: false,
                error: `Error de Gemini API: ${response.status}`
            }
        }

        const data = await response.json()

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const textoGenerado = data.candidates[0].content.parts[0].text.trim()
            console.log(`[Contrarreferencia] ✅ Generación exitosa (${textoGenerado.length} caracteres)`)

            return {
                success: true,
                texto: textoGenerado
            }
        }

        return {
            success: false,
            error: 'Respuesta de Gemini sin contenido válido'
        }

    } catch (error) {
        console.error('[Contrarreferencia] Error en generación:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        }
    }
}

/**
 * Función principal: genera contrarreferencia automática
 * 
 * Flujo:
 * 1. Intenta obtener texto desde chunks vectorizados
 * 2. Si no existe, vectoriza el PDF on-the-fly
 * 3. Genera contrarreferencia con Gemini 3 Flash
 * 
 * @param radicado - Número de radicado del caso
 * @param pdfUrl - URL del PDF soporte
 * @param especialidad - Especialidad a la que se remite (opcional)
 */
export async function generarContrarreferenciaAutomatica(
    radicado: string,
    pdfUrl: string,
    especialidad?: string
): Promise<ContrarreferenciaResult> {
    const inicio = Date.now()

    try {
        console.log(`[Contrarreferencia] === Iniciando generación para ${radicado} ===`)

        // 1. Intentar obtener texto desde vectorización existente
        let textoSoporte = await obtenerTextoCompleto(radicado)
        let metodo: 'vectorizado' | 'vectorizado-on-fly' = 'vectorizado'

        // 2. Si no existe, vectorizar on-the-fly
        if (!textoSoporte || textoSoporte.length < 100) {
            console.log('[Contrarreferencia] No hay vectorización, vectorizando on-the-fly...')
            
            const resultadoVectorizacion = await ragService.vectorizarPdf(radicado, pdfUrl)

            if (!resultadoVectorizacion.success) {
                return {
                    success: false,
                    error: `Error en vectorización: ${resultadoVectorizacion.error}`,
                    tiempoMs: Date.now() - inicio
                }
            }

            // Obtener texto recién vectorizado
            textoSoporte = await obtenerTextoCompleto(radicado)
            metodo = 'vectorizado-on-fly'

            if (!textoSoporte || textoSoporte.length < 100) {
                return {
                    success: false,
                    error: 'No se pudo extraer texto del PDF',
                    tiempoMs: Date.now() - inicio
                }
            }
        }

        // 3. Generar contrarreferencia con IA
        const resultado = await generarContrarreferenciaConIA(textoSoporte, especialidad)

        const tiempoMs = Date.now() - inicio
        console.log(`[Contrarreferencia] === Completado en ${tiempoMs}ms (${metodo}) ===`)

        return {
            success: resultado.success,
            texto: resultado.texto,
            error: resultado.error,
            metodo,
            tiempoMs
        }

    } catch (error) {
        console.error('[Contrarreferencia] Error general:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido',
            tiempoMs: Date.now() - inicio
        }
    }
}

export default {
    generarContrarreferenciaAutomatica
}
