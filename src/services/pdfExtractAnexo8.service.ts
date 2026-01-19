/**
 * Servicio de Extracción de PDF para Anexo 8
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Extrae datos de PDFs nativos de fórmulas médicas
 * Usa pdfjs-dist en el frontend para extraer texto
 */

import * as pdfjsLib from 'pdfjs-dist'
import { Anexo8OcrResult } from '@/types/anexo8.types'

// Configurar worker de pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

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
    documento: /(?:CC|C\.C\.|Documento|Identificación|DOCUMENTO|IDENTIFICACION)[:\s]*(\d{4,15})/i,

    // Nombre completo - buscando la línea después de "Paciente" o "Nombre"
    nombreCompleto: /(?:Paciente|PACIENTE|Nombre|NOMBRE)[:\s]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{5,60})/i,

    // Edad - varios formatos
    edad: /(?:Edad|EDAD)[:\s]*(\d{1,3})(?:\s*años|\s*AÑOS)?/i,

    // Género/Sexo
    genero: /(?:Sexo|SEXO|Género|GENERO)[:\s]*([FM]|Masculino|Femenino|MASCULINO|FEMENINO)/i,

    // Diagnóstico CIE-10
    diagnosticoCie10: /(?:Diagnóstico|DIAGNOSTICO|CIE)[:\s]*([A-Z]\d{2,3}(?:\.\d{1,2})?)/i,
    diagnosticoTexto: /(?:Diagnóstico|DIAGNOSTICO)[:\s]*([A-ZÁÉÍÓÚÑ\s]{5,80})/i,

    // Medicamento - buscar cualquier medicamento controlado
    medicamentoTabla: new RegExp(
        `(${MEDICAMENTOS_CONTROLADOS.join('|')})\\s+(\\d+(?:[.,]\\d+)?\\s*(?:mg|ml|g|mcg|MG|ML|Mg|Ml))`,
        'gi'
    ),

    // Forma farmacéutica
    formaFarmaceutica: /\b(TABLETAS?|CAPSULAS?|COMPRIMIDOS?|GOTAS|AMPOLLA|JARABE|SOLUCION|TAB|CAPS?)\b/i,

    // Cantidad (número seguido de unidades)
    cantidadNumero: /(?:Cantidad|CANTIDAD|Cant)[:\s#]*(\d{1,3})/i,
    cantidadAlternativo: /\b(\d{1,3})\s*(?:TAB|TABLETAS?|CAPSULAS?|UNIDADES?|UND)\b/i,

    // Días de tratamiento
    diasTratamiento: /(?:Días|DIAS|dias)[:\s]*(\d{1,3})/i,

    // Posología
    posologia: /(\d+\s*(?:TAB|TABLETA|CAPSULAS?)?[,\s]*(?:CADA\s*)?\d*\s*(?:HORAS?|\d+H)?\s*(?:VO|VIA\s*ORAL|ORAL)?[A-ZÁÉÍÓÚÑ\s]*)/i,

    // Médico
    medicoNombre: /(?:Médico|MEDICO|ATENDIDO\s*POR|Dr\.|DRA\.)[:\s]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{5,50})/i,
    medicoDocumento: /(?:Reg\.|Registro|REGISTRO|CC|C\.C\.)[:\s]*(\d{6,15})/i
}

/**
 * Extrae texto completo de todas las páginas del PDF
 */
async function extraerTextoPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let textoCompleto = ''

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const strings = content.items
            .map((item) => ('str' in item ? item.str : ''))
            .filter(str => str.trim().length > 0)
        textoCompleto += strings.join(' ') + '\n'
    }

    return textoCompleto
}

/**
 * Extrae datos estructurados del texto del PDF
 */
function extraerDatosDeTexto(texto: string): Anexo8OcrResult {
    const resultado: Anexo8OcrResult = {
        confidence: 0
    }

    let camposEncontrados = 0
    const totalCampos = 10

    console.log('[PDF-EXTRACT] Texto extraído:', texto.substring(0, 500))

    // ===== DOCUMENTO =====
    const matchDoc = texto.match(PATRONES.documento)
    if (matchDoc) {
        resultado.pacienteDocumento = matchDoc[1]
        resultado.pacienteTipoId = 'CC'
        camposEncontrados++
        console.log('✓ Documento:', resultado.pacienteDocumento)
    }

    // ===== NOMBRE =====
    const matchNombre = texto.match(PATRONES.nombreCompleto)
    if (matchNombre) {
        const nombreCompleto = matchNombre[1].trim()
        const partes = nombreCompleto.split(/\s+/).filter(p => p.length > 1)
        if (partes.length >= 3) {
            resultado.pacienteApellido1 = partes[0]
            resultado.pacienteApellido2 = partes[1]
            resultado.pacienteNombres = partes.slice(2).join(' ')
        } else if (partes.length === 2) {
            resultado.pacienteApellido1 = partes[0]
            resultado.pacienteNombres = partes[1]
        } else if (partes.length === 1) {
            resultado.pacienteNombres = partes[0]
        }
        camposEncontrados++
        console.log('✓ Nombre:', resultado.pacienteNombres, resultado.pacienteApellido1)
    }

    // ===== EDAD =====
    const matchEdad = texto.match(PATRONES.edad)
    if (matchEdad) {
        resultado.pacienteEdad = parseInt(matchEdad[1], 10)
        camposEncontrados++
        console.log('✓ Edad:', resultado.pacienteEdad)
    }

    // ===== GÉNERO =====
    const matchGenero = texto.match(PATRONES.genero)
    if (matchGenero) {
        const g = matchGenero[1].toLowerCase()
        resultado.pacienteGenero = g.startsWith('m') ? 'M' : 'F'
        camposEncontrados++
        console.log('✓ Género:', resultado.pacienteGenero)
    }

    // ===== MEDICAMENTO =====
    const matchMed = PATRONES.medicamentoTabla.exec(texto)
    if (matchMed) {
        const med = matchMed[1].toLowerCase()
        resultado.medicamentoNombre = med.charAt(0).toUpperCase() + med.slice(1)
        resultado.concentracion = matchMed[2].toUpperCase().replace(',', '.')
        camposEncontrados += 2
        console.log('✓ Medicamento:', resultado.medicamentoNombre, resultado.concentracion)
    }

    // ===== FORMA FARMACÉUTICA =====
    const matchForma = texto.match(PATRONES.formaFarmaceutica)
    if (matchForma) {
        resultado.formaFarmaceutica = matchForma[1].toUpperCase()
        camposEncontrados++
        console.log('✓ Forma:', resultado.formaFarmaceutica)
    }

    // ===== CANTIDAD =====
    let matchCantidad = texto.match(PATRONES.cantidadNumero)
    if (!matchCantidad) {
        matchCantidad = texto.match(PATRONES.cantidadAlternativo)
    }
    if (matchCantidad) {
        resultado.cantidadNumero = parseInt(matchCantidad[1], 10)
        camposEncontrados++
        console.log('✓ Cantidad:', resultado.cantidadNumero)
    }

    // ===== DÍAS =====
    const matchDias = texto.match(PATRONES.diasTratamiento)
    if (matchDias) {
        resultado.diasTratamiento = parseInt(matchDias[1], 10)
        camposEncontrados++
        console.log('✓ Días:', resultado.diasTratamiento)
    }

    // ===== POSOLOGÍA =====
    const matchPosologia = texto.match(PATRONES.posologia)
    if (matchPosologia) {
        resultado.dosisVia = matchPosologia[1].trim()
        console.log('✓ Posología:', resultado.dosisVia)
    }

    // ===== DIAGNÓSTICO =====
    const matchCie10 = texto.match(PATRONES.diagnosticoCie10)
    if (matchCie10) {
        resultado.diagnosticoCie10 = matchCie10[1].toUpperCase()
        camposEncontrados++
        console.log('✓ CIE-10:', resultado.diagnosticoCie10)
    }

    const matchDiagTexto = texto.match(PATRONES.diagnosticoTexto)
    if (matchDiagTexto && !resultado.diagnosticoCie10) {
        resultado.diagnosticoDescripcion = matchDiagTexto[1].trim()
    }

    // ===== MÉDICO =====
    const matchMedico = texto.match(PATRONES.medicoNombre)
    if (matchMedico) {
        resultado.medicoNombre = matchMedico[1].trim()
        console.log('✓ Médico:', resultado.medicoNombre)
    }

    const matchMedicoDoc = texto.match(PATRONES.medicoDocumento)
    if (matchMedicoDoc) {
        resultado.medicoDocumento = matchMedicoDoc[1]
    }

    // Calcular meses automáticamente
    if (resultado.cantidadNumero && resultado.diasTratamiento) {
        resultado.cantidadPorMes = Math.round((resultado.cantidadNumero / resultado.diasTratamiento) * 30)
        resultado.mesesTratamiento = Math.min(6, Math.ceil(resultado.diasTratamiento / 30))
    }

    // Calcular confianza
    resultado.confidence = Math.min(100, Math.round((camposEncontrados / totalCampos) * 100))

    console.log(`[PDF-EXTRACT] Confianza: ${resultado.confidence}% (${camposEncontrados}/${totalCampos} campos)`)

    return resultado
}

/**
 * Extrae datos de un PDF de fórmula médica (procesamiento en frontend)
 */
export async function extraerDatosPdf(file: File): Promise<{
    success: boolean
    data?: Anexo8OcrResult
    error?: string
}> {
    try {
        // Validar que sea PDF
        if (!file.type.includes('pdf')) {
            return {
                success: false,
                error: 'El archivo debe ser un PDF'
            }
        }

        // Validar tamaño (máximo 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return {
                success: false,
                error: 'El archivo PDF es demasiado grande (máximo 5MB)'
            }
        }

        console.log('[PDF-EXTRACT] Procesando PDF en frontend con pdfjs-dist...')

        // Extraer texto del PDF usando pdfjs-dist
        const texto = await extraerTextoPdf(file)

        if (texto.trim().length < 50) {
            return {
                success: false,
                error: 'No se pudo extraer texto del PDF. Puede ser una imagen escaneada.'
            }
        }

        // Extraer datos estructurados
        const datos = extraerDatosDeTexto(texto)

        return {
            success: true,
            data: datos
        }
    } catch (error) {
        console.error('Error en PDF service:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error al procesar el PDF'
        }
    }
}

/**
 * Convierte un archivo PDF a base64 (para uso posterior si se necesita)
 */
export function pdfToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => {
            const result = reader.result as string
            const base64 = result.split(',')[1]
            resolve(base64)
        }
        reader.onerror = (error) => reject(error)
    })
}

export default { extraerDatosPdf, pdfToBase64 }
