/**
 * Vercel Serverless Function: OCR para Anexo 8
 * Endpoint: POST /api/ocr-anexo8
 * 
 * Extrae datos de una receta de medicamentos controlados usando Document AI
 * y mapea los campos al formato del Anexo 8.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { DocumentProcessorServiceClient } from '@google-cloud/documentai'

// Configuración desde variables de entorno
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'document-ai-ocr-484713'
const LOCATION = process.env.GCP_LOCATION || 'us'
const PROCESSOR_ID = process.env.GCP_PROCESSOR_ID || 'f59453255feb1e3f'

// Credenciales de Google Cloud desde variable de entorno
const credentials = process.env.GCP_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
    : null

// Lista de medicamentos controlados para matching
const MEDICAMENTOS_CONTROLADOS = [
    'alprazolam', 'bromazepam', 'buprenorfina', 'clobazam', 'clonazepam',
    'clozapina', 'diazepam', 'fentanilo', 'fenobarbital', 'hidrato de cloral',
    'hidromorfona', 'ketamina', 'lisdexanfetamina', 'lorazepam', 'meperidina',
    'metadona', 'metilfenidato', 'mexazolam', 'midazolam', 'morfina',
    'oxicodona', 'primidona', 'remifentanilo', 'tapentadol', 'tetrahidrocannabinol',
    'tiopental', 'triazolam', 'zolpidem'
]

// Patrones para extraer datos
const PATRONES = {
    // Documento del paciente
    documento: /(?:c\.?c\.?|t\.?i\.?|c\.?e\.?|documento|identificaci[oó]n)[:\s]*(\d{4,15})/i,

    // Nombres (buscar después de "nombres" o patrón de nombres)
    nombres: /nombres?[:\s]*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i,

    // Apellidos
    apellido1: /primer\s*apellido[:\s]*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,
    apellido2: /segundo\s*apellido[:\s]*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,

    // Edad
    edad: /edad[:\s]*(\d{1,3})\s*(?:años?)?/i,

    // Género
    genero: /(?:g[eé]nero|sexo)[:\s]*([FM])|(?:\[x?\])\s*(femenino|masculino)/i,

    // Diagnóstico CIE-10
    diagnosticoCie10: /diagn[oó]stico[:\s]*([A-Z]\d{2,3}(?:\.\d{1,2})?)/i,
    diagnosticoDesc: /diagn[oó]stico[:\s]*(?:[A-Z]\d{2,3}(?:\.\d)?)?[\s-]*([A-Za-záéíóúñ\s]+?)(?:\n|$)/i,

    // Cantidad
    cantidad: /cantidad[:\s]*(\d{1,4})|(\d{1,4})\s*(?:tabletas?|c[aá]psulas?|ampollas?|mg)/i,

    // Concentración
    concentracion: /concentraci[oó]n[:\s]*([\d.,]+\s*(?:mg|ml|g|mcg|%)[\/\w]*)/i,

    // Medicamento (buscar coincidencias con lista)
    medicamento: new RegExp(`(${MEDICAMENTOS_CONTROLADOS.join('|')})`, 'i')
}

interface OcrAnexo8Result {
    pacienteDocumento?: string
    pacienteTipoId?: string
    pacienteNombres?: string
    pacienteApellido1?: string
    pacienteApellido2?: string
    pacienteEdad?: number
    pacienteGenero?: 'F' | 'M'
    medicamentoNombre?: string
    concentracion?: string
    formaFarmaceutica?: string
    dosisVia?: string
    cantidadNumero?: number
    diagnosticoCie10?: string
    diagnosticoDescripcion?: string
    textoCompleto?: string
    confidence: number
}

/**
 * Extraer datos estructurados del texto OCR
 */
function extraerDatosDeTexto(texto: string): OcrAnexo8Result {
    const resultado: OcrAnexo8Result = {
        confidence: 0
    }

    let camposEncontrados = 0
    const totalCampos = 10

    // Documento
    const matchDoc = texto.match(PATRONES.documento)
    if (matchDoc) {
        resultado.pacienteDocumento = matchDoc[1]
        resultado.pacienteTipoId = 'CC' // Por defecto
        camposEncontrados++
    }

    // Nombres
    const matchNombres = texto.match(PATRONES.nombres)
    if (matchNombres) {
        resultado.pacienteNombres = matchNombres[1]
        camposEncontrados++
    }

    // Apellidos
    const matchApellido1 = texto.match(PATRONES.apellido1)
    if (matchApellido1) {
        resultado.pacienteApellido1 = matchApellido1[1]
        camposEncontrados++
    }

    const matchApellido2 = texto.match(PATRONES.apellido2)
    if (matchApellido2) {
        resultado.pacienteApellido2 = matchApellido2[1]
    }

    // Edad
    const matchEdad = texto.match(PATRONES.edad)
    if (matchEdad) {
        resultado.pacienteEdad = parseInt(matchEdad[1], 10)
        camposEncontrados++
    }

    // Género
    const matchGenero = texto.match(PATRONES.genero)
    if (matchGenero) {
        const valor = matchGenero[1] || matchGenero[2]
        if (valor) {
            resultado.pacienteGenero = valor.toUpperCase().startsWith('F') ? 'F' : 'M'
            camposEncontrados++
        }
    }

    // Medicamento
    const matchMedicamento = texto.match(PATRONES.medicamento)
    if (matchMedicamento) {
        // Capitalizar correctamente
        const med = matchMedicamento[1].toLowerCase()
        resultado.medicamentoNombre = med.charAt(0).toUpperCase() + med.slice(1)
        camposEncontrados++
    }

    // Concentración
    const matchConcentracion = texto.match(PATRONES.concentracion)
    if (matchConcentracion) {
        resultado.concentracion = matchConcentracion[1].toUpperCase()
        camposEncontrados++
    }

    // Cantidad
    const matchCantidad = texto.match(PATRONES.cantidad)
    if (matchCantidad) {
        resultado.cantidadNumero = parseInt(matchCantidad[1] || matchCantidad[2], 10)
        camposEncontrados++
    }

    // Diagnóstico CIE-10
    const matchCie10 = texto.match(PATRONES.diagnosticoCie10)
    if (matchCie10) {
        resultado.diagnosticoCie10 = matchCie10[1].toUpperCase()
        camposEncontrados++
    }

    // Descripción diagnóstico
    const matchDiagDesc = texto.match(PATRONES.diagnosticoDesc)
    if (matchDiagDesc && matchDiagDesc[1]) {
        resultado.diagnosticoDescripcion = matchDiagDesc[1].trim().substring(0, 100)
        camposEncontrados++
    }

    // Calcular confianza
    resultado.confidence = Math.round((camposEncontrados / totalCampos) * 100)
    resultado.textoCompleto = texto.substring(0, 2000) // Primeros 2000 caracteres para debug

    return resultado
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!credentials) {
        console.error('GCP_SERVICE_ACCOUNT_KEY no configurada')
        return res.status(500).json({ error: 'OCR service not configured' })
    }

    try {
        const { imageBase64, mimeType = 'image/png' } = req.body

        if (!imageBase64) {
            return res.status(400).json({ error: 'imageBase64 is required' })
        }

        // Crear cliente de Document AI
        const client = new DocumentProcessorServiceClient({ credentials })

        // Nombre del procesador
        const processorName = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`

        // Preparar la solicitud para imagen
        const request = {
            name: processorName,
            rawDocument: {
                content: imageBase64,
                mimeType: mimeType,
            },
        }

        // Procesar documento
        const [result] = await client.processDocument(request)
        const { document } = result

        if (!document || !document.text) {
            return res.status(200).json({
                success: true,
                data: { confidence: 0 },
                message: 'No se pudo extraer texto de la imagen'
            })
        }

        // Extraer datos estructurados
        const datosExtraidos = extraerDatosDeTexto(document.text)

        return res.status(200).json({
            success: true,
            data: datosExtraidos
        })

    } catch (error) {
        console.error('OCR Anexo 8 error:', error)
        return res.status(500).json({
            error: 'OCR processing failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        })
    }
}
