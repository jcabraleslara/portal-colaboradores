/**
 * Servicio de Extracción de PDF para Anexo 8
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Extrae datos de PDFs nativos de fórmulas médicas de Gestar Salud
 * Usa pdfjs-dist en el frontend para extraer texto
 */

import * as pdfjsLib from 'pdfjs-dist'
import { Anexo8OcrResult } from '@/types/anexo8.types'

// Configurar worker de pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

// Lista de medicamentos controlados para matching (minúsculas para comparación)
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
 * Extrae datos estructurados del texto del PDF de fórmula de Gestar Salud
 */
function extraerDatosDeTexto(texto: string): Anexo8OcrResult {
    const resultado: Anexo8OcrResult = {
        confidence: 0
    }

    let camposEncontrados = 0
    const totalCampos = 10

    console.log('[PDF-EXTRACT] Texto extraído:', texto.substring(0, 500))

    // ===== DOCUMENTO DEL PACIENTE =====
    // Formato: CC: 1067925976
    const matchDoc = texto.match(/CC[:\s]+(\d{6,15})/i)
    if (matchDoc) {
        resultado.pacienteDocumento = matchDoc[1]
        resultado.pacienteTipoId = 'CC'
        camposEncontrados++
        console.log('✓ Documento:', resultado.pacienteDocumento)
    }

    // ===== NOMBRE DEL PACIENTE =====
    // Formato: Nombre: MOLINA QUINTANA SASKIA DEL CARMEN
    const matchNombre = texto.match(/Nombre[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?=CC|Fecha|$)/i)
    if (matchNombre) {
        const nombreCompleto = matchNombre[1].trim()
        const partes = nombreCompleto.split(/\s+/).filter(p => p.length > 1)
        // Formato típico: APELLIDO1 APELLIDO2 NOMBRES
        if (partes.length >= 4) {
            resultado.pacienteApellido1 = partes[0]
            resultado.pacienteApellido2 = partes[1]
            resultado.pacienteNombres = partes.slice(2).join(' ')
        } else if (partes.length === 3) {
            resultado.pacienteApellido1 = partes[0]
            resultado.pacienteApellido2 = partes[1]
            resultado.pacienteNombres = partes[2]
        } else if (partes.length === 2) {
            resultado.pacienteApellido1 = partes[0]
            resultado.pacienteNombres = partes[1]
        }
        camposEncontrados++
        console.log('✓ Nombre:', resultado.pacienteNombres, resultado.pacienteApellido1, resultado.pacienteApellido2)
    }

    // ===== EDAD =====
    // Formato: Edad: 30 años
    const matchEdad = texto.match(/Edad[:\s]+(\d{1,3})\s*años/i)
    if (matchEdad) {
        resultado.pacienteEdad = parseInt(matchEdad[1], 10)
        camposEncontrados++
        console.log('✓ Edad:', resultado.pacienteEdad)
    }

    // ===== GÉNERO =====
    // Formato: Sexo: F
    const matchGenero = texto.match(/Sexo[:\s]+([FM])/i)
    if (matchGenero) {
        resultado.pacienteGenero = matchGenero[1].toUpperCase() as 'F' | 'M'
        camposEncontrados++
        console.log('✓ Género:', resultado.pacienteGenero)
    }

    // ===== DIAGNÓSTICO CIE-10 =====
    // Formato: Dx Principal: G824 - CUADRIPLEJIA ESPASTICA
    const matchDx = texto.match(/Dx\s*Principal[:\s]+([A-Z]\d{2,4})\s*[-–]\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=Contrato|Municipio|$)/i)
    if (matchDx) {
        resultado.diagnosticoCie10 = matchDx[1].toUpperCase()
        resultado.diagnosticoDescripcion = matchDx[2].trim()
        camposEncontrados++
        console.log('✓ Diagnóstico:', resultado.diagnosticoCie10, '-', resultado.diagnosticoDescripcion)
    }

    // ===== MEDICAMENTO CONTROLADO =====
    // Buscar cualquier medicamento de la lista en el texto
    // Formato en tabla: CLONAZEPAM 2 mg (TABLETA)
    for (const med of MEDICAMENTOS_CONTROLADOS) {
        const regexMed = new RegExp(`(${med})\\s+(\\d+(?:[.,]\\d+)?\\s*(?:mg|ml|g|mcg))(?:\\s*\\(?(TABLETA|CAPSUL|SOLUCION|JARABE|GOTAS|AMPOLLA)?\\)?)?`, 'gi')
        const matchMed = regexMed.exec(texto)
        if (matchMed) {
            resultado.medicamentoNombre = med.charAt(0).toUpperCase() + med.slice(1)
            resultado.concentracion = matchMed[2].toUpperCase().replace(',', '.')
            if (matchMed[3]) {
                resultado.formaFarmaceutica = matchMed[3].toUpperCase()
                if (resultado.formaFarmaceutica === 'CAPSUL') {
                    resultado.formaFarmaceutica = 'CAPSULA'
                }
            }
            camposEncontrados += 2
            console.log('✓ Medicamento:', resultado.medicamentoNombre, resultado.concentracion, resultado.formaFarmaceutica)
            break // Solo tomar el primer medicamento controlado encontrado
        }
    }

    // ===== FORMA FARMACÉUTICA (si no se encontró arriba) =====
    if (!resultado.formaFarmaceutica) {
        const matchForma = texto.match(/\b(TABLETA|TABLETAS|CAPSULA|CAPSULAS|SOLUCION|JARABE|GOTAS|AMPOLLA|COMPRIMIDO)\b/i)
        if (matchForma) {
            resultado.formaFarmaceutica = matchForma[1].toUpperCase()
            console.log('✓ Forma (alternativo):', resultado.formaFarmaceutica)
        }
    }

    // ===== CANTIDAD Y DÍAS DE LA TABLA DE MEDICAMENTOS =====
    // La tabla tiene columnas: Código | Descripción | Cantidad | Posología | Días
    // Buscar después del medicamento encontrado: número de cantidad y días
    if (resultado.medicamentoNombre) {
        const medNombre = resultado.medicamentoNombre.toUpperCase()
        // Buscar la línea que contiene el medicamento y extraer cantidad y días
        // Formato: CLONAZEPAM 2 mg (TABLETA) 180 1 TAB VO NOCHE 180
        const regexLinea = new RegExp(`${medNombre}[^\\d]*(\\d+)\\s*(?:mg|ml|g)?[^\\d]*(\\d{1,4})\\s+([^\\d]+?)\\s+(\\d{1,4})(?:\\s|$)`, 'i')
        const matchLinea = texto.match(regexLinea)

        if (matchLinea) {
            const cantidadTotal = parseInt(matchLinea[2], 10)
            const posologia = matchLinea[3].trim()
            const diasTratamiento = parseInt(matchLinea[4], 10)

            console.log('✓ Datos tabla - Cantidad:', cantidadTotal, 'Posología:', posologia, 'Días:', diasTratamiento)

            // Guardar posología como dosis/vía
            resultado.dosisVia = posologia
            resultado.diasTratamiento = diasTratamiento

            // ===== LÓGICA DE CÁLCULO PARA ANEXO 8 =====
            // El Anexo 8 es MENSUAL, así que debemos calcular la cantidad por mes
            if (cantidadTotal > 0 && diasTratamiento > 0) {
                // Calcular cantidad mensual (para 30 días)
                const cantidadPorMes = Math.round((cantidadTotal / diasTratamiento) * 30)
                resultado.cantidadNumero = cantidadPorMes
                resultado.cantidadPorMes = cantidadPorMes

                // Calcular meses de tratamiento (máximo 6)
                resultado.mesesTratamiento = Math.min(6, Math.ceil(diasTratamiento / 30))

                camposEncontrados += 3
                console.log('✓ Cálculo Anexo 8 - Cantidad/mes:', cantidadPorMes, 'Meses:', resultado.mesesTratamiento)
            }
        } else {
            // Fallback: buscar patrones simples de cantidad y días
            // Buscar "Cantidad" seguido de número en tabla
            const matchCantidad = texto.match(/(?:Cantidad|Cant)[:\s]*(\d{1,4})/i)
            if (matchCantidad) {
                const cantidadTotal = parseInt(matchCantidad[1], 10)
                resultado.cantidadNumero = cantidadTotal
                camposEncontrados++
                console.log('✓ Cantidad (fallback):', cantidadTotal)
            }

            // Buscar "Días" seguido de número
            const matchDias = texto.match(/(?:Días|Dias)[:\s]*(\d{1,4})/i)
            if (matchDias) {
                resultado.diasTratamiento = parseInt(matchDias[1], 10)
                console.log('✓ Días (fallback):', resultado.diasTratamiento)
            }
        }
    }

    // ===== POSOLOGÍA (si no se encontró en la tabla) =====
    if (!resultado.dosisVia) {
        // Buscar patrón de posología: "1 TAB VO NOCHE" o similar
        const matchPosologia = texto.match(/(\d+\s*TAB(?:LETA)?S?\s*(?:VO|VIA\s*ORAL|ORAL)?\s*(?:CADA\s*\d+\s*HORAS?|NOCHE|DIA|MAÑANA|TARDE)?)/i)
        if (matchPosologia) {
            resultado.dosisVia = matchPosologia[1].trim()
            console.log('✓ Posología (alternativo):', resultado.dosisVia)
        }
    }

    // ===== MÉDICO =====
    // Formato: Médico: JULIO CESAR VILLALOBOS COMAS
    const matchMedico = texto.match(/Médico[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?=Proveedor|Direccion|$)/i)
    if (matchMedico) {
        resultado.medicoNombre = matchMedico[1].trim()
        console.log('✓ Médico:', resultado.medicoNombre)
    }

    // Buscar cédula/registro del médico
    // Formato: Cedula: 70031515 o Reg. med: 70031515
    const matchMedicoDoc = texto.match(/(?:Cedula|Cédula|Reg\.?\s*med)[:\s]*(\d{6,15})/i)
    if (matchMedicoDoc) {
        resultado.medicoDocumento = matchMedicoDoc[1]
        resultado.medicoRegistro = matchMedicoDoc[1]
        console.log('✓ Documento médico:', resultado.medicoDocumento)
    }

    // Calcular confianza
    resultado.confidence = Math.min(100, Math.round((camposEncontrados / totalCampos) * 100))

    console.log(`[PDF-EXTRACT] Confianza: ${resultado.confidence}% (${camposEncontrados}/${totalCampos} campos)`)
    console.log('[PDF-EXTRACT] Resultado final:', resultado)

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
