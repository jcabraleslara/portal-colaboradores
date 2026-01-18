/**
 * Generador de PDF para Anexo 8 usando PDF-LIB
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Estrategia: Llenar campos de formulario del PDF plantilla
 * El PDF debe tener campos AcroForm con los nombres correctos
 */

import { PDFDocument } from 'pdf-lib'
import { Anexo8Record } from '@/types/anexo8.types'

interface PdfGeneratorResult {
    blob: Blob
    filename: string
}

/**
 * Genera un PDF del Anexo 8 rellenando los campos del formulario
 * Tiempo estimado: <500ms (instantáneo)
 */
export async function generarAnexo8Pdf(data: Anexo8Record): Promise<PdfGeneratorResult> {
    // 1. Cargar el PDF plantilla con campos de formulario
    const templateUrl = '/templates/anexo8_plantilla.pdf'
    const templateBytes = await fetch(templateUrl).then(res => res.arrayBuffer())
    const pdfDoc = await PDFDocument.load(templateBytes)

    // 2. Obtener el formulario y la primera página
    const form = pdfDoc.getForm()
    const pages = pdfDoc.getPages()
    const firstPage = pages[0]

    // 3. Extraer fecha
    const [anio, mes, dia] = data.fecha_prescripcion.split('-')

    // 4. Separar nombres del médico
    // IMPORTANTE: El formato puede ser "NOMBRES APELLIDO1 APELLIDO2"
    // Asumimos que los últimos 2 elementos son apellidos y el resto son nombres
    const medicoPartes = data.medico_nombres.trim().split(' ').filter(p => p.length > 0)
    let medicoNombres = ''
    let medicoApellido1 = ''
    let medicoApellido2 = ''

    if (medicoPartes.length >= 3) {
        // Caso: "HUGO ALBERTO BERASTEGUI SOTO" → nombres: "HUGO ALBERTO", apellidos: "BERASTEGUI", "SOTO"
        medicoApellido2 = medicoPartes[medicoPartes.length - 1]
        medicoApellido1 = medicoPartes[medicoPartes.length - 2]
        medicoNombres = medicoPartes.slice(0, -2).join(' ')
    } else if (medicoPartes.length === 2) {
        // Caso: "HUGO BERASTEGUI" → nombres: "HUGO", apellido1: "BERASTEGUI"
        medicoNombres = medicoPartes[0]
        medicoApellido1 = medicoPartes[1]
    } else if (medicoPartes.length === 1) {
        // Solo un elemento, lo ponemos como nombre
        medicoNombres = medicoPartes[0]
    }

    // 5. Función helper para llenar campos de texto de forma segura
    const setText = (fieldName: string, value: string | number | null | undefined, fontSize?: number) => {
        try {
            const field = form.getTextField(fieldName)
            const textValue = String(value ?? '').toUpperCase()
            field.setText(textValue)

            // Ajustar tamaño de fuente si se especifica
            if (fontSize) {
                field.setFontSize(fontSize)
            }
        } catch (e) {
            console.warn(`Campo no encontrado: ${fieldName}`)
        }
    }

    // 6. Función helper para seleccionar radio buttons
    const setRadio = (fieldName: string, value: string | null | undefined) => {
        try {
            if (value) {
                const radio = form.getRadioGroup(fieldName)
                radio.select(value)
            }
        } catch (e) {
            console.warn(`Radio group no encontrado: ${fieldName}`)
        }
    }

    // ========================================
    // LLENAR CAMPOS DE TEXTO
    // ========================================

    // Encabezado
    setText('numero_recetario', data.numero_recetario)
    setText('dia', dia)
    setText('mes', mes)
    setText('anio', anio)

    // Paciente
    setText('paciente_apellido1', data.paciente_apellido1)
    setText('paciente_apellido2', data.paciente_apellido2)
    setText('paciente_nombres', data.paciente_nombres)
    setText('paciente_documento', data.paciente_documento)
    setText('paciente_edad', data.paciente_edad)
    setText('paciente_telefono', data.paciente_telefono)
    setText('paciente_municipio', data.paciente_municipio)
    setText('paciente_direccion', data.paciente_direccion)
    setText('paciente_departamento', data.paciente_departamento || 'CÓRDOBA')
    setText('paciente_eps', data.paciente_eps)

    // Medicamento - AJUSTAR TAMAÑOS DE FUENTE
    setText('medicamento_nombre', data.medicamento_nombre, 9)
    setText('medicamento_concentracion', data.medicamento_concentracion, 9)
    setText('medicamento_forma', data.medicamento_forma_farmaceutica, 9)

    // Para dosis: Permitir que el texto fluya naturalmente
    setText('medicamento_dosis', data.medicamento_dosis_via, 8)

    setText('cantidad_numero', data.cantidad_numero, 9)
    setText('cantidad_letras', data.cantidad_letras, 8)

    // Diagnóstico
    const diagnosticoCompleto = data.diagnostico_cie10
        ? `${data.diagnostico_cie10} - ${data.diagnostico_descripcion || ''}`
        : data.diagnostico_descripcion || ''
    setText('diagnostico', diagnosticoCompleto)

    // Médico
    setText('medico_apellido1', medicoApellido1)
    setText('medico_apellido2', medicoApellido2)
    setText('medico_nombres', medicoNombres)
    setText('medico_documento', data.medico_documento)
    setText('medico_especialidad', data.medico_especialidad)

    // ========================================
    // LLENAR RADIO BUTTONS
    // ========================================

    // Tipo de identificación
    const tipoIdMap: Record<string, string> = {
        'TI': 'TI',
        'CC': 'CC',
        'CE': 'Otro',
        'PA': 'Otro',
        'RC': 'Otro',
        'MS': 'Otro',
        'AS': 'Otro',
        'NV': 'Otro'
    }
    setRadio('tipo_id', tipoIdMap[data.paciente_tipo_id] || 'Otro')

    // Género
    if (data.paciente_genero) {
        setRadio('genero', data.paciente_genero)
    }

    // ========================================
    // INSERTAR FIRMA DEL MÉDICO
    // ========================================
    if (data.medico_firma_url) {
        try {
            // Descargar la imagen de firma
            const firmaResponse = await fetch(data.medico_firma_url)
            const firmaBytes = await firmaResponse.arrayBuffer()

            // Determinar tipo de imagen (PNG o JPG)
            let firmaImage
            if (data.medico_firma_url.toLowerCase().includes('.png')) {
                firmaImage = await pdfDoc.embedPng(firmaBytes)
            } else {
                firmaImage = await pdfDoc.embedJpg(firmaBytes)
            }

            // Obtener dimensiones del campo de firma (aprox)
            // Los campos de firma están en las posiciones Y: ~485 (primera copia) y ~55 (segunda copia)
            const firmaDims = firmaImage.scale(0.5) // Escalar al 50% del tamaño original

            // Posiciones aproximadas del campo firma (necesitan ajuste)
            // Primera firma (Original): Y ~485
            // Segunda firma (Copia): Y ~55
            const firmaWidth = 80 // Ancho del campo
            const firmaHeight = 35 // Alto del campo

            // Calcular escala para que quepa en el campo
            const scaleX = firmaWidth / firmaDims.width
            const scaleY = firmaHeight / firmaDims.height
            const scale = Math.min(scaleX, scaleY, 1) // No agrandar

            const finalWidth = firmaDims.width * scale
            const finalHeight = firmaDims.height * scale

            // Posiciones (estas son aproximadas, ajustar según necesidad)
            const firmaX1 = 500 // Posición X aproximada
            const firmaY1 = 485 // Primera firma
            const firmaY2 = 55  // Segunda firma

            // Centrar horizontalmente en el campo
            const offsetX = (firmaWidth - finalWidth) / 2

            // Dibujar firma en ambas copias
            firstPage.drawImage(firmaImage, {
                x: firmaX1 + offsetX,
                y: firmaY1,
                width: finalWidth,
                height: finalHeight
            })

            firstPage.drawImage(firmaImage, {
                x: firmaX1 + offsetX,
                y: firmaY2,
                width: finalWidth,
                height: finalHeight
            })
        } catch (e) {
            console.warn('Error al cargar firma del médico:', e)
        }
    }

    // ========================================
    // FINALIZAR Y EXPORTAR
    // ========================================

    // Aplanar el formulario para que los campos no sean editables
    form.flatten()

    // Guardar el PDF
    const pdfBytes = await pdfDoc.save()

    // Convertir a Blob
    const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' })

    // Generar nombre del archivo
    const fechaStr = data.fecha_prescripcion.replace(/-/g, '')
    const timestamp = Date.now().toString().slice(-6)
    const pacienteNombre = (
        data.paciente_nombres.split(' ')[0] +
        (data.paciente_apellido1 || '')
    ).replace(/[^a-zA-Z0-9]/g, '')
    const filename = `ANEXO8_${data.paciente_documento}_${pacienteNombre}_${fechaStr}_${timestamp}.pdf`

    return { blob, filename }
}

/**
 * Descarga el PDF en el navegador
 */
export function descargarPdf(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export default { generarAnexo8Pdf, descargarPdf }
