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
    documento: /(?:c\.?c\.?|t\.?i\.?|c\.?e\.?|documento|identificación)[:\s]*(\d{4,15})/i,

    // Nombre completo (más flexible para capturar todo el nombre)
    nombreCompleto: /nombre[:\s]*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/i,

    // Nombres individuales (fallback si no encuentra nombre completo)
    nombres: /nombres?[:\s]*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i,

    // Apellidos
    apellido1: /primer\s*apellido[:\s]*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,
    apellido2: /segundo\s*apellido[:\s]*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,

    // Edad
    edad: /edad[:\s]*(\d{1,3})\s*(?:años?)?/i,

    // Género
    genero: /(?:g[eé]nero|sexo)[:\s]*([FM])|(?:\[x?\])\s*(femenino|masculino)/i,

    // Diagnóstico - MEJORADO para capturar múltiples formatos
    diagnosticoCie10: /(?:diagnóstico|motivo)[:\s]*([A-Z]\d{2,3}(?:\.\d{1,2})?)/i,
    diagnosticoDescGlobal: /(?:diagnóstico|motivo)[:\s]*(?:[A-Z]\d{2,3})?[:\s-]*([A-ZÁÉÍÓÚ][a-záéíóúñ\s]{3,50})/i,
    // Buscar diagnóstico en encabezado antes de "EPS"
    diagnosticoTexto: /\b([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚÑ\s]{3,40}?)\s+(?:POR|PARA)?\s*(?:NUEVA)?\s*EPS\s+SUBSIDIADO/i,

    // Cantidad y días - CORREGIDO para evitar números largos
    cantidadTabla: /(?:cantidad|cant\.?)[:\s]*(\d{1,3})\b|^(\d{1,3})\s+(?:\d+\s+)?(?:TAB|CAP|AMP|ML)/mi,
    cantidad: /cantidad[:\s]*(\d{1,3})\b|(\d{1,3})\s*(?:TOMAR|APLICAR|tabletas?|cápsulas?)/i,
    // Días SOLO al final de línea o antes de salto, NO números de más de 3 dígitos
    dias: /\b(\d{1,3})\s*(?:d[ií]as?)?$/m,

    // Medicamento completo (nombre + concentración + forma en una sola captura)
    medicamentoCompleto: new RegExp(`(${MEDICAMENTOS_CONTROLADOS.join('|')})\\s+(\\d+(?:\\.\\d+)?\\s*(?:mg|ml|g|mcg|UI|%))\\s*\\(([^)]+)\\)`, 'gi'),

    // Concentración individual (fallback) - MEJORADO
    concentracion: /(\d+(?:\.\d+)?\s*(?:mg|ml|g|mcg|UI|%)(?:\/(?:ml|g|tableta|cápsula))?)/i,

    // Forma farmacéutica individual (fallback)
    formaFarmaceutica: /\((TABLETA|CÁPSULA|SOLUCIÓN\s+(?:INYECTABLE|ORAL|NASAL)|JARABE|PARCHE|POLVO)\)/i,

    // Posología - MEJORADO para capturar más variantes
    posologiaCompleta: /(\d+\s+TAB\s+(?:VO|VIA\s+ORAL)\s+[A-ZÁÉÍÓÚ]+)/i,
    posologia: /(?:TOMAR|APLICAR|ADMINISTRAR|VIA)\s+([^\d]{5,100})/i,
    posologiaTabla: /\d+\s+((?:TAB|CAP|AMP)\s+(?:VO|VIA)?\s*[A-ZÁÉÍÓÚÑ\s]{3,50})/i,

    // Medicamento simple (fallback)
    medicamento: new RegExp(`(${MEDICAMENTOS_CONTROLADOS.join('|')})`, 'i'),

    // Médico que firma - MEJORADO para múltiples formatos
    medicoNombreCompleto: /(?:ATENDIDO\s+POR|MÉDICO)[:\s]*[\r\n]*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){2,5})/i,
    medicoNombre: /ATENDIDO\s+POR\s*[\r\n]+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/i,
    medicoRegistro: /reg\.\s*méd[:\s]*(\d{4,15})/i,
    medicoCedula: /c[eé]dula[:\s]*(\d{4,15})/i
}

interface OcrAnexo8Result {
    // Datos del paciente
    pacienteDocumento?: string
    pacienteTipoId?: string
    pacienteNombres?: string
    pacienteApellido1?: string
    pacienteApellido2?: string
    pacienteEdad?: number
    pacienteGenero?: 'F' | 'M'

    // Datos del medicamento
    medicamentoNombre?: string
    concentracion?: string
    formaFarmaceutica?: string
    dosisVia?: string
    cantidadNumero?: number
    diasTratamiento?: number

    // Cálculo de meses
    cantidadPorMes?: number
    mesesTratamiento?: number

    // Diagnóstico
    diagnosticoCie10?: string
    diagnosticoDescripcion?: string

    // Datos del médico
    medicoNombre?: string
    medicoDocumento?: string
    medicoRegistro?: string

    // Metadata
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
    const totalCampos = 15 // Incrementado para incluir nuevos campos

    // ===== DATOS DEL PACIENTE =====

    // Documento
    const matchDoc = texto.match(PATRONES.documento)
    if (matchDoc) {
        resultado.pacienteDocumento = matchDoc[1]
        resultado.pacienteTipoId = 'CC' // Por defecto
        camposEncontrados++
    }

    // Nombre completo (intentar primero)
    const matchNombreCompleto = texto.match(PATRONES.nombreCompleto)
    if (matchNombreCompleto) {
        const nombreCompleto = matchNombreCompleto[1]
        // Dividir en apellidos y nombres (asumiendo: Apellido1 Apellido2 Nombre1 Nombre2...)
        const partes = nombreCompleto.split(/\s+/)
        if (partes.length >= 3) {
            resultado.pacienteApellido1 = partes[0]
            resultado.pacienteApellido2 = partes[1]
            resultado.pacienteNombres = partes.slice(2).join(' ')
            camposEncontrados += 2
        } else if (partes.length === 2) {
            resultado.pacienteApellido1 = partes[0]
            resultado.pacienteNombres = partes[1]
            camposEncontrados++
        } else {
            resultado.pacienteNombres = nombreCompleto
        }
        camposEncontrados++
    } else {
        // Fallback: buscar nombres y apellidos por separado
        const matchNombres = texto.match(PATRONES.nombres)
        if (matchNombres) {
            resultado.pacienteNombres = matchNombres[1]
            camposEncontrados++
        }

        const matchApellido1 = texto.match(PATRONES.apellido1)
        if (matchApellido1) {
            resultado.pacienteApellido1 = matchApellido1[1]
            camposEncontrados++
        }

        const matchApellido2 = texto.match(PATRONES.apellido2)
        if (matchApellido2) {
            resultado.pacienteApellido2 = matchApellido2[1]
        }
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

    // ===== DATOS DEL MEDICAMENTO =====

    // Intentar primero capturar medicamento completo (nombre + concentración + forma)
    const matchMedCompleto = PATRONES.medicamentoCompleto.exec(texto)
    if (matchMedCompleto) {
        // Capitalizar correctamente
        const med = matchMedCompleto[1].toLowerCase()
        resultado.medicamentoNombre = med.charAt(0).toUpperCase() + med.slice(1)
        resultado.concentracion = matchMedCompleto[2].toUpperCase()
        resultado.formaFarmaceutica = matchMedCompleto[3]
        camposEncontrados += 3
    } else {
        // Fallback: buscar por separado

        // Medicamento
        const matchMedicamento = texto.match(PATRONES.medicamento)
        if (matchMedicamento) {
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

        // Forma farmacéutica
        const matchForma = texto.match(PATRONES.formaFarmaceutica)
        if (matchForma) {
            resultado.formaFarmaceutica = matchForma[1]
            camposEncontrados++
        }
    }

    // Posología - intentar múltiples formatos
    let posologiaEncontrada = false

    // Primero intentar posología completa (ej: "1 TAB VO NOCHE")
    const matchPosologiaCompleta = texto.match(PATRONES.posologiaCompleta)
    if (matchPosologiaCompleta) {
        resultado.dosisVia = matchPosologiaCompleta[1].trim()
        camposEncontrados++
        posologiaEncontrada = true
    }

    // Si no, intentar posología de tabla
    if (!posologiaEncontrada) {
        const matchPosologiaTabla = texto.match(PATRONES.posologiaTabla)
        if (matchPosologiaTabla) {
            resultado.dosisVia = matchPosologiaTabla[1].trim()
            camposEncontrados++
            posologiaEncontrada = true
        }
    }

    // Fallback: posología general
    if (!posologiaEncontrada) {
        const matchPosologia = texto.match(PATRONES.posologia)
        if (matchPosologia) {
            resultado.dosisVia = matchPosologia[1].trim()
            camposEncontrados++
        }
    }

    // Cantidad - intentar primero desde tablas
    const matchCantidadTabla = texto.match(PATRONES.cantidadTabla)
    if (matchCantidadTabla) {
        resultado.cantidadNumero = parseInt(matchCantidadTabla[1] || matchCantidadTabla[2], 10)
        camposEncontrados++
    } else {
        // Fallback: patrón general
        const matchCantidad = texto.match(PATRONES.cantidad)
        if (matchCantidad) {
            resultado.cantidadNumero = parseInt(matchCantidad[1] || matchCantidad[2], 10)
            camposEncontrados++
        }
    }

    // Días de tratamiento
    const matchDias = texto.match(PATRONES.dias)
    if (matchDias) {
        resultado.diasTratamiento = parseInt(matchDias[1] || matchDias[2], 10)
        camposEncontrados++
    }

    // ===== CÁLCULO DE MESES DE TRATAMIENTO =====
    if (resultado.cantidadNumero && resultado.diasTratamiento) {
        // Calcular cantidad por mes (asumiendo 30 días/mes)
        resultado.cantidadPorMes = Math.round((resultado.cantidadNumero / resultado.diasTratamiento) * 30)

        // Calcular meses de tratamiento (redondeando al múltiplo de 30 más cercano)
        resultado.mesesTratamiento = Math.ceil(resultado.diasTratamiento / 30)

        camposEncontrados++
    } else if (resultado.cantidadNumero) {
        // Si no hay días, asumir cantidad por mes = cantidad / 30
        resultado.cantidadPorMes = Math.floor(resultado.cantidadNumero / 30)
        resultado.mesesTratamiento = resultado.cantidadPorMes > 0 ? Math.ceil(resultado.cantidadNumero / resultado.cantidadPorMes) : 1
    }

    // ===== DIAGNÓSTICO =====

    // Intentar múltiples patrones para diagnóstico
    const matchCie10 = texto.match(PATRONES.diagnosticoCie10)
    if (matchCie10) {
        resultado.diagnosticoCie10 = matchCie10[1].toUpperCase()
        camposEncontrados++
    }

    // Descripción diagnóstico - intentar varios patrones
    const matchDiagDescGlobal = texto.match(PATRONES.diagnosticoDescGlobal)
    if (matchDiagDescGlobal && matchDiagDescGlobal[1]) {
        resultado.diagnosticoDescripcion = matchDiagDescGlobal[1].trim().toUpperCase().substring(0, 100)
        camposEncontrados++
    } else {
        // Fallback: buscar diagnóstico en encabezado
        const matchDiagTexto = texto.match(PATRONES.diagnosticoTexto)
        if (matchDiagTexto && matchDiagTexto[1]) {
            resultado.diagnosticoDescripcion = matchDiagTexto[1].trim().toUpperCase().substring(0, 100)
            camposEncontrados++
        }
    }

    // ===== DATOS DEL MÉDICO =====

    // Intentar múltiples patrones para el médico
    const matchMedicoNombreCompleto = texto.match(PATRONES.medicoNombreCompleto)
    if (matchMedicoNombreCompleto) {
        resultado.medicoNombre = matchMedicoNombreCompleto[1].trim()
        camposEncontrados++
    } else {
        // Fallback: patrón con salto de línea
        const matchMedicoNombre = texto.match(PATRONES.medicoNombre)
        if (matchMedicoNombre) {
            resultado.medicoNombre = matchMedicoNombre[1].trim()
            camposEncontrados++
        }
    }

    // Registro médico
    const matchMedicoReg = texto.match(PATRONES.medicoRegistro)
    if (matchMedicoReg) {
        resultado.medicoRegistro = matchMedicoReg[1]
        camposEncontrados++
    }

    // Cédula del médico (si no se encontró registro)
    if (!resultado.medicoRegistro) {
        const matchMedicoCed = texto.match(PATRONES.medicoCedula)
        if (matchMedicoCed) {
            resultado.medicoDocumento = matchMedicoCed[1]
            camposEncontrados++
        }
    }

    // ===== CALCULAR CONFIANZA =====
    // Limitar confianza al 100% máximo
    resultado.confidence = Math.min(100, Math.round((camposEncontrados / totalCampos) * 100))

    // Validar y limitar meses de tratamiento (máximo 6 meses para Anexo 8)
    if (resultado.mesesTratamiento && resultado.mesesTratamiento > 6) {
        console.warn(`⚠️ Meses de tratamiento excede límite: ${resultado.mesesTratamiento}, limitando a 6`)
        resultado.mesesTratamiento = 6
    }

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
