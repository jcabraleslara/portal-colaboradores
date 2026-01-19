/**
 * Servicio de Extracción de PDF para Anexo 8
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Extrae datos de PDFs nativos de fórmulas médicas de Gestar Salud
 * Formato específico: Recetas del sistema Sisma-Salud
 */

import * as pdfjsLib from 'pdfjs-dist'
import { Anexo8OcrResult } from '@/types/anexo8.types'

// Configurar worker de pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

// Lista de medicamentos controlados (minúsculas)
const MEDICAMENTOS_CONTROLADOS = [
    'alprazolam', 'bromazepam', 'buprenorfina', 'clobazam', 'clonazepam',
    'clozapina', 'diazepam', 'fentanilo', 'fenobarbital', 'hidrato de cloral',
    'hidromorfona', 'ketamina', 'lisdexanfetamina', 'lorazepam', 'meperidina',
    'metadona', 'metilfenidato', 'mexazolam', 'midazolam', 'morfina',
    'oxicodona', 'primidona', 'remifentanilo', 'tapentadol', 'tetrahidrocannabinol',
    'tiopental', 'triazolam', 'zolpidem'
]

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
 * Formato: Recetas Sisma-Salud de Gestar Salud IPS
 */
function extraerDatosDeTexto(texto: string): Anexo8OcrResult {
    const resultado: Anexo8OcrResult = {
        confidence: 0
    }

    let camposEncontrados = 0
    const totalCampos = 10

    console.log('[PDF-EXTRACT] === ANÁLISIS DE TEXTO ===')
    console.log('[PDF-EXTRACT] Primeros 800 caracteres:', texto.substring(0, 800))

    // ===== 1. DOCUMENTO DEL PACIENTE =====
    // Formato: CC: 25910874
    const matchDoc = texto.match(/CC[:\s]+(\d{6,15})/i)
    if (matchDoc) {
        resultado.pacienteDocumento = matchDoc[1]
        resultado.pacienteTipoId = 'CC'
        camposEncontrados++
        console.log('✓ [1] Documento:', resultado.pacienteDocumento)
    }

    // ===== 2. NOMBRE DEL PACIENTE =====
    // Formato: Nombre: FIGUEROA MENDOZA LUZ MARINA
    const matchNombre = texto.match(/Nombre[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?:\s+CC|\s+Fecha)/i)
    if (matchNombre) {
        const nombreCompleto = matchNombre[1].trim()
        const partes = nombreCompleto.split(/\s+/).filter(p => p.length > 1)
        // Formato: APELLIDO1 APELLIDO2 NOMBRES
        if (partes.length >= 3) {
            resultado.pacienteApellido1 = partes[0]
            resultado.pacienteApellido2 = partes[1]
            resultado.pacienteNombres = partes.slice(2).join(' ')
        } else if (partes.length === 2) {
            resultado.pacienteApellido1 = partes[0]
            resultado.pacienteNombres = partes[1]
        }
        camposEncontrados++
        console.log('✓ [2] Nombre:', resultado.pacienteNombres, resultado.pacienteApellido1, resultado.pacienteApellido2)
    }

    // ===== 3. DIAGNÓSTICO CIE-10 =====
    // Formato: Dx Principal: F200 - ESQUIZOFRENIA PARANOIDE
    const matchDx = texto.match(/Dx\s*Principal[:\s]+([A-Z]\d{2,4})\s*[-–]\s*([A-ZÁÉÍÓÚÑ\s]+?)(?:\s+Contrato|\s+Municipio|$)/i)
    if (matchDx) {
        resultado.diagnosticoCie10 = matchDx[1].toUpperCase()
        resultado.diagnosticoDescripcion = matchDx[2].trim()
        camposEncontrados++
        console.log('✓ [3] Diagnóstico:', resultado.diagnosticoCie10, '-', resultado.diagnosticoDescripcion)
    }

    // ===== 4. MÉDICO =====
    // Formato: Médico: HUGO ALBERTO BERASTEGUI SOTO
    const matchMedico = texto.match(/Médico[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?:\s+Proveedor|\s+Direccion|$)/i)
    if (matchMedico) {
        resultado.medicoNombre = matchMedico[1].trim()
        console.log('✓ [4a] Médico nombre:', resultado.medicoNombre)
    }

    // Formato: Cedula: 71312439 o Reg. med: 71312439
    const matchMedicoDoc = texto.match(/(?:Cedula|Cédula)[:\s]+(\d{6,15})/i)
    if (matchMedicoDoc) {
        resultado.medicoDocumento = matchMedicoDoc[1]
        resultado.medicoRegistro = matchMedicoDoc[1]
        camposEncontrados++
        console.log('✓ [4b] Médico documento:', resultado.medicoDocumento)
    }

    // ===== 5. BUSCAR MEDICAMENTO CONTROLADO EN LA TABLA =====
    // La tabla tiene formato: MEDICAMENTO concentración (FORMA) cantidad posología días
    // Ejemplo: CLONAZEPAM 2 mg (TABLETA) 360 TOMAR UNA CADA 12 HORAS 180

    let medicamentoEncontrado = false

    for (const med of MEDICAMENTOS_CONTROLADOS) {
        // Patrón: MEDICAMENTO + concentración + (FORMA) + cantidad + posología + días
        // Ejemplo: CLONAZEPAM 2 mg (TABLETA) 360 TOMAR UNA CADA 12 HORAS 180
        const regexMedicamento = new RegExp(
            `(${med})\\s+(\\d+(?:[.,]\\d+)?\\s*(?:mg|ml|g|mcg|MG))\\s*\\(?(TABLETA|CAPSUL[A]?|SOLUCION|JARABE|GOTAS)?\\)?\\s+(\\d{2,4})\\s+([A-ZÁÉÍÓÚÑ0-9\\s]+?)\\s+(\\d{2,4})(?:\\s|$)`,
            'gi'
        )

        const matchMed = regexMedicamento.exec(texto)

        if (matchMed) {
            const nombreMed = matchMed[1]
            const concentracion = matchMed[2]
            const forma = matchMed[3] || 'TABLETA'
            const cantidad = parseInt(matchMed[4], 10)
            const posologia = matchMed[5].trim()
            const dias = parseInt(matchMed[6], 10)

            console.log('✓ [5] Medicamento encontrado:', nombreMed, concentracion, forma)
            console.log('   Cantidad:', cantidad, '| Posología:', posologia, '| Días:', dias)

            resultado.medicamentoNombre = nombreMed.charAt(0).toUpperCase() + nombreMed.slice(1).toLowerCase()
            resultado.concentracion = concentracion.toUpperCase()
            resultado.formaFarmaceutica = forma.toUpperCase()
            resultado.dosisVia = posologia
            resultado.diasTratamiento = dias

            // Cálculo para Anexo 8 (mensual)
            if (cantidad > 0 && dias > 0) {
                const cantidadPorMes = Math.round((cantidad / dias) * 30)
                resultado.cantidadNumero = cantidadPorMes
                resultado.cantidadPorMes = cantidadPorMes
                resultado.mesesTratamiento = Math.min(6, Math.ceil(dias / 30))

                console.log('✓ [5] Cálculo Anexo 8:', cantidad, '/', dias, '× 30 =', cantidadPorMes, 'por mes,', resultado.mesesTratamiento, 'meses')
            }

            camposEncontrados += 4
            medicamentoEncontrado = true
            break
        }
    }

    // ===== FALLBACK: Buscar tabla con formato más simple =====
    if (!medicamentoEncontrado) {
        console.log('[PDF-EXTRACT] Intentando fallback para medicamento...')

        // Buscar cualquier medicamento controlado seguido de números
        for (const med of MEDICAMENTOS_CONTROLADOS) {
            const regexSimple = new RegExp(`(${med})\\s+(\\d+(?:[.,]\\d+)?\\s*(?:mg|ml))`, 'gi')
            const matchSimple = regexSimple.exec(texto)

            if (matchSimple) {
                resultado.medicamentoNombre = matchSimple[1].charAt(0).toUpperCase() + matchSimple[1].slice(1).toLowerCase()
                resultado.concentracion = matchSimple[2].toUpperCase()
                camposEncontrados += 2
                console.log('✓ [5-fallback] Medicamento:', resultado.medicamentoNombre, resultado.concentracion)

                // Buscar números grandes cercanos (cantidad y días)
                const posicionMed = texto.toLowerCase().indexOf(med.toLowerCase())
                const textoRestante = texto.substring(posicionMed)

                // Buscar patrón: número + texto + número (cantidad + posología + días)
                const matchTabla = textoRestante.match(/\)\s*(\d{2,4})\s+([A-ZÁÉÍÓÚÑ0-9\s]{5,50}?)\s+(\d{2,4})(?:\s|GS)/i)

                if (matchTabla) {
                    const cantidad = parseInt(matchTabla[1], 10)
                    const posologia = matchTabla[2].trim()
                    const dias = parseInt(matchTabla[3], 10)

                    if (cantidad >= 30 && dias >= 30 && dias <= 365) {
                        resultado.dosisVia = posologia
                        resultado.diasTratamiento = dias

                        const cantidadPorMes = Math.round((cantidad / dias) * 30)
                        resultado.cantidadNumero = cantidadPorMes
                        resultado.cantidadPorMes = cantidadPorMes
                        resultado.mesesTratamiento = Math.min(6, Math.ceil(dias / 30))

                        camposEncontrados += 2
                        console.log('✓ [5-fallback] Tabla:', cantidad, posologia, dias, '→ Por mes:', cantidadPorMes)
                    }
                }

                break
            }
        }
    }

    // ===== 6. FORMA FARMACÉUTICA (si no se encontró) =====
    if (!resultado.formaFarmaceutica) {
        const matchForma = texto.match(/\b(TABLETA|TABLETAS|CAPSULA|CAPSULAS|SOLUCION|JARABE|GOTAS)\b/i)
        if (matchForma) {
            resultado.formaFarmaceutica = matchForma[1].toUpperCase()
            console.log('✓ [6] Forma farmacéutica:', resultado.formaFarmaceutica)
        }
    }

    // Calcular confianza
    resultado.confidence = Math.min(100, Math.round((camposEncontrados / totalCampos) * 100))

    console.log('[PDF-EXTRACT] === RESULTADO FINAL ===')
    console.log('[PDF-EXTRACT] Confianza:', resultado.confidence, '% (', camposEncontrados, '/', totalCampos, ')')
    console.log('[PDF-EXTRACT] Datos:', JSON.stringify(resultado, null, 2))

    return resultado
}

/**
 * Extrae datos de un PDF de fórmula médica
 */
export async function extraerDatosPdf(file: File): Promise<{
    success: boolean
    data?: Anexo8OcrResult
    error?: string
}> {
    try {
        if (!file.type.includes('pdf')) {
            return { success: false, error: 'El archivo debe ser un PDF' }
        }

        if (file.size > 5 * 1024 * 1024) {
            return { success: false, error: 'El archivo PDF es demasiado grande (máximo 5MB)' }
        }

        console.log('[PDF-EXTRACT] Procesando:', file.name)

        const texto = await extraerTextoPdf(file)

        if (texto.trim().length < 50) {
            return { success: false, error: 'No se pudo extraer texto del PDF. Puede ser una imagen escaneada.' }
        }

        const datos = extraerDatosDeTexto(texto)

        return { success: true, data: datos }
    } catch (error) {
        console.error('Error en PDF service:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error al procesar el PDF' }
    }
}

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
