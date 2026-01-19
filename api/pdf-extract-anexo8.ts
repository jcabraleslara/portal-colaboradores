/**
 * Vercel Serverless Function: Extracción de PDF Nativo para Anexo 8
 * Endpoint: POST /api/pdf-extract-anexo8
 * 
 * Extrae texto de PDFs nativos de fórmulas médicas y mapea campos al Anexo 8
 * Usando pdf-lib (compatible con serverless)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PDFDocument } from 'pdf-lib'

// Lista de medicamentos controlados para matching
const MEDICAMENTOS_CONTROLADOS = [
    'alprazolam', 'bromazepam', 'buprenorfina', 'clobazam', 'clonazepam',
    'clozapina', 'diazepam', 'fentanilo', 'fenobarbital', 'hidrato de cloral',
    'hidromorfona', 'ketamina', 'lisdexanfetamina', 'lorazepam', 'meperidina',
    'metadona', 'metilfenidato', 'mexazolam', 'midazolam', 'morfina',
    'oxicodona', 'primidona', 'remifentanilo', 'tapentadol', 'tetrahidrocannabinol',
    'tiopental', 'triazolam', 'zolpidem'
]

// Patrones optimizados para PDF nativo (texto perfecto)
const PATRONES = {
    // Documento del paciente - más flexible
    documento: /(?:CC|C\.C\.|Documento|Identificación)[:\s]*(\d{4,15})/i,

    // Nombre completo
    nombreCompleto: /Nombre[:\s]*([A-ZÁÉÍÓÚÑ\s]{10,60})/i,

    // Edad
    edad: /Edad[:\s]*(\d{1,3})\s*años/i,

    // Género
    genero: /Sexo[:\s]*([FM])/i,

    // Diagnóstico
    diagnosticoCie10: /Diagnóstico[:\s]*([A-Z]\d{2,3}(?:\.\d{1,2})?)/i,
    diagnosticoTexto: /\b([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚÑ\s]{5,50}?)\s+(?:POR|PARA)?\s*(?:NUEVA)?\s*EPS/i,

    // Medicamento en tabla: MEDICAMENTO cantidad (FORMA)
    medicamentoTabla: new RegExp(
        `(${MEDICAMENTOS_CONTROLADOS.join('|')})\\s+(\\d+(?:\\.\\d+)?\\s*(?:mg|ml|g|mcg|MG|ML))\\s*\\(([^)]+)\\)`,
        'gi'
    ),

    // Medicamento simple sin paréntesis
    medicamentoSimple: new RegExp(
        `(${MEDICAMENTOS_CONTROLADOS.join('|')})\\s+(\\d+(?:\\.\\d+)?\\s*(?:mg|ml|g|mcg|MG|ML))`,
        'gi'
    ),

    // Cantidad en columna de tabla
    cantidadColumna: /\b(\d{1,3})\s+(?:1\s+)?TAB/i,

    // Días en última columna (solo números de 1-3 dígitos)
    diasColumna: /\b(\d{1,3})$/m,

    // Posología completa
    posologia: /(\d+\s+TAB\s+(?:VO|VIA\s+ORAL)\s+[A-ZÁÉÍÓÚ\s]+)/i,

    // Médico que firma
    medicoNombre: /(?:ATENDIDO\s+POR|Médico)[:\s\n]*([A-ZÁÉÍÓÚÑ\s]{15,60})\s*\(/i,
    medicoRegistro: /(?:Reg\.\s*méd|Cédula|Código)[:\s]*(\d{4,15})/i
}

interface PdfExtractResult {
    // Paciente
    pacienteDocumento?: string
    pacienteTipoId?: string
    pacienteNombres?: string
    pacienteApellido1?: string
    pacienteApellido2?: string
    pacienteEdad?: number
    pacienteGenero?: 'F' | 'M'

    // Medicamento
    medicamentoNombre?: string
    concentracion?: string
    formaFarmaceutica?: string
    dosisVia?: string
    cantidadNumero?: number
    diasTratamiento?: number

    // Cálculo automático
    cantidadPorMes?: number
    mesesTratamiento?: number

    // Diagnóstico
    diagnosticoCie10?: string
    diagnosticoDescripcion?: string

    // Médico
    medicoNombre?: string
    medicoDocumento?: string

    // Metadata
    confidence: number
    textoExtraido?: string
    metodo?: string
}

/**
 * Extraer texto de los campos de formulario de un PDF
 */
async function extraerTextoDeFormulario(pdfDoc: PDFDocument): Promise<string> {
    const textos: string[] = []

    try {
        const form = pdfDoc.getForm()
        const fields = form.getFields()

        for (const field of fields) {
            try {
                const fieldName = field.getName()
                // Intentar obtener valor como texto
                if ('getText' in field) {
                    const texto = (field as { getText: () => string }).getText()
                    if (texto) {
                        textos.push(`${fieldName}: ${texto}`)
                    }
                }
            } catch {
                // Ignorar campos que no se pueden leer
            }
        }
    } catch {
        // PDF sin formulario
    }

    return textos.join('\n')
}

/**
 * Extraer datos estructurados del texto del PDF
 */
function extraerDatos(texto: string): PdfExtractResult {
    const resultado: PdfExtractResult = {
        confidence: 0
    }

    let camposEncontrados = 0
    const totalCampos = 12

    // ===== PACIENTE =====
    const matchDoc = texto.match(PATRONES.documento)
    if (matchDoc) {
        resultado.pacienteDocumento = matchDoc[1]
        resultado.pacienteTipoId = 'CC'
        camposEncontrados++
    }

    const matchNombre = texto.match(PATRONES.nombreCompleto)
    if (matchNombre) {
        const nombreCompleto = matchNombre[1].trim()
        const partes = nombreCompleto.split(/\s+/)
        if (partes.length >= 3) {
            resultado.pacienteApellido1 = partes[0]
            resultado.pacienteApellido2 = partes[1]
            resultado.pacienteNombres = partes.slice(2).join(' ')
        } else if (partes.length === 2) {
            resultado.pacienteApellido1 = partes[0]
            resultado.pacienteNombres = partes[1]
        }
        camposEncontrados++
    }

    const matchEdad = texto.match(PATRONES.edad)
    if (matchEdad) {
        resultado.pacienteEdad = parseInt(matchEdad[1], 10)
        camposEncontrados++
    }

    const matchGenero = texto.match(PATRONES.genero)
    if (matchGenero) {
        resultado.pacienteGenero = matchGenero[1] as 'F' | 'M'
        camposEncontrados++
    }

    // ===== MEDICAMENTO =====
    // Intentar primero con tabla completa
    const matchMed = PATRONES.medicamentoTabla.exec(texto)
    if (matchMed) {
        const med = matchMed[1].toLowerCase()
        resultado.medicamentoNombre = med.charAt(0).toUpperCase() + med.slice(1)
        resultado.concentracion = matchMed[2].toUpperCase()
        resultado.formaFarmaceutica = matchMed[3]
        camposEncontrados += 3
    } else {
        // Fallback: medicamento sin paréntesis
        const matchSimple = PATRONES.medicamentoSimple.exec(texto)
        if (matchSimple) {
            const med = matchSimple[1].toLowerCase()
            resultado.medicamentoNombre = med.charAt(0).toUpperCase() + med.slice(1)
            resultado.concentracion = matchSimple[2].toUpperCase()
            camposEncontrados += 2
        }
    }

    const matchPosologia = texto.match(PATRONES.posologia)
    if (matchPosologia) {
        resultado.dosisVia = matchPosologia[1].trim()
        camposEncontrados++
    }

    const matchCantidad = texto.match(PATRONES.cantidadColumna)
    if (matchCantidad) {
        resultado.cantidadNumero = parseInt(matchCantidad[1], 10)
        camposEncontrados++
    }

    const matchDias = texto.match(PATRONES.diasColumna)
    if (matchDias) {
        const dias = parseInt(matchDias[1], 10)
        // Validar que sean días razonables (máximo 365)
        if (dias <= 365) {
            resultado.diasTratamiento = dias
            camposEncontrados++
        }
    }

    // Calcular meses
    if (resultado.cantidadNumero && resultado.diasTratamiento) {
        resultado.cantidadPorMes = Math.round((resultado.cantidadNumero / resultado.diasTratamiento) * 30)
        resultado.mesesTratamiento = Math.min(6, Math.ceil(resultado.diasTratamiento / 30))
    }

    // ===== DIAGNÓSTICO =====
    const matchCie10 = texto.match(PATRONES.diagnosticoCie10)
    if (matchCie10) {
        resultado.diagnosticoCie10 = matchCie10[1].toUpperCase()
        camposEncontrados++
    }

    const matchDiagTexto = texto.match(PATRONES.diagnosticoTexto)
    if (matchDiagTexto) {
        resultado.diagnosticoDescripcion = matchDiagTexto[1].trim().toUpperCase()
        camposEncontrados++
    }

    // ===== MÉDICO =====
    const matchMedico = texto.match(PATRONES.medicoNombre)
    if (matchMedico) {
        resultado.medicoNombre = matchMedico[1].trim()
        camposEncontrados++
    }

    const matchMedicoReg = texto.match(PATRONES.medicoRegistro)
    if (matchMedicoReg) {
        resultado.medicoDocumento = matchMedicoReg[1]
        camposEncontrados++
    }

    // Calcular confianza (máximo 100%)
    resultado.confidence = Math.min(100, Math.round((camposEncontrados / totalCampos) * 100))
    resultado.textoExtraido = texto.substring(0, 1000)

    return resultado
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { pdfBase64 } = req.body

        if (!pdfBase64) {
            return res.status(400).json({ error: 'pdfBase64 is required' })
        }

        console.log('[PDF-EXTRACT] Procesando PDF con pdf-lib...')

        // Convertir base64 a buffer
        const pdfBuffer = Buffer.from(pdfBase64, 'base64')

        // Cargar PDF con pdf-lib
        const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })

        // Extraer texto de campos de formulario
        const textoFormulario = await extraerTextoDeFormulario(pdfDoc)

        console.log('[PDF-EXTRACT] Texto de formulario:', textoFormulario.substring(0, 200))

        // Si hay texto de formulario, extraer datos
        let datosExtraidos: PdfExtractResult

        if (textoFormulario.length > 50) {
            datosExtraidos = extraerDatos(textoFormulario)
            datosExtraidos.metodo = 'formulario'
        } else {
            // PDF sin campos de formulario - devolver respuesta vacía con mensaje
            datosExtraidos = {
                confidence: 0,
                metodo: 'sin_texto',
                textoExtraido: 'Este PDF no contiene texto extraíble. Es posible que sea un PDF escaneado (imagen). Para estos casos, recomendamos ingresar los datos manualmente.'
            }
        }

        console.log('[PDF-EXTRACT] Datos extraídos:', datosExtraidos)

        return res.status(200).json({
            success: true,
            data: datosExtraidos
        })

    } catch (error) {
        console.error('[PDF-EXTRACT] Error:', error)
        return res.status(500).json({
            success: false,
            error: 'Error al procesar el PDF',
            details: error instanceof Error ? error.message : 'Unknown error'
        })
    }
}
