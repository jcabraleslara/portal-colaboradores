/**
 * Generador de PDF para Anexo 8 usando PDF-LIB
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Estrategia: Llenar campos de formulario del PDF plantilla
 * El PDF debe tener campos AcroForm con los nombres correctos
 */

import { PDFDocument, rgb } from 'pdf-lib'
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

    // Medicamento (tamaños ajustados manualmente en el PDF por el usuario)
    setText('medicamento_nombre', data.medicamento_nombre)
    setText('medicamento_concentracion', data.medicamento_concentracion)
    setText('medicamento_forma', data.medicamento_forma_farmaceutica)
    setText('medicamento_dosis', data.medicamento_dosis_via)
    setText('cantidad_numero', data.cantidad_numero)
    setText('cantidad_letras', data.cantidad_letras)

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
    // No llenar medico_firma con texto, se dibujará la imagen encima
    // ========================================
    // LLENAR RADIO BUTTONS (Sección 1 y 2 separadas)
    // ========================================

    // Mapeo de tipos de ID
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
    const tipoIdValue = tipoIdMap[data.paciente_tipo_id] || 'CC'

    // Marcar tipo_id_1 (Primera sección - Original)
    try {
        const radio1 = form.getRadioGroup('tipo_id_1')
        radio1.select(tipoIdValue)
    } catch (e) {
        console.warn('Error marcando tipo_id_1')
    }

    // Marcar tipo_id_2 (Segunda sección - Copia)
    try {
        const radio2 = form.getRadioGroup('tipo_id_2')
        radio2.select(tipoIdValue)
    } catch (e) {
        console.warn('Error marcando tipo_id_2')
    }

    // Marcar género_1 (Primera sección - Original)
    if (data.paciente_genero) {
        try {
            const genero1 = form.getRadioGroup('genero_1')
            genero1.select(data.paciente_genero)
        } catch (e) {
            console.warn('Error marcando genero_1')
        }
    }

    // Marcar género_2 (Segunda sección - Copia)
    if (data.paciente_genero) {
        try {
            const genero2 = form.getRadioGroup('genero_2')
            genero2.select(data.paciente_genero)
        } catch (e) {
            console.warn('Error marcando genero_2')
        }
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

            // Obtener el campo de firma para extraer sus coordenadas
            const firmaField = form.getTextField('medico_firma')
            const widgets = firmaField.acroField.getWidgets()

            // Iterar sobre cada widget (habrá 2: uno para Original y otro para Copia)
            widgets.forEach((widget) => {
                const rect = widget.getRectangle()

                // Obtener posición y tamaño del campo
                const fieldX = rect.x
                const fieldY = rect.y
                const fieldWidth = rect.width
                const fieldHeight = rect.height

                // Calcular escala para la firma (más pequeña para dejar espacio al texto)
                const imgDims = firmaImage.scale(0.4) // Reducir a 40% para dejar espacio
                const scaleX = (fieldWidth * 0.6) / imgDims.width // Usar sólo 60% del ancho del campo
                const scaleY = fieldHeight / imgDims.height
                const scale = Math.min(scaleX, scaleY, 1)

                const finalWidth = imgDims.width * scale
                const finalHeight = imgDims.height * scale

                // Posicionar firma a la IZQUIERDA del campo
                const firmaX = fieldX + 2 // Pequeño margen izquierdo
                const firmaY = fieldY + (fieldHeight - finalHeight) / 2

                // Dibujar la firma
                firstPage.drawImage(firmaImage, {
                    x: firmaX,
                    y: firmaY,
                    width: finalWidth,
                    height: finalHeight,
                    opacity: 0.95
                })

                // Timestamp a la DERECHA de la firma
                const ahora = new Date()
                const fecha = ahora.toISOString().slice(0, 10)
                const hora = ahora.toISOString().slice(11, 19)

                const timestampX = firmaX + finalWidth + 5 // 5px de separación
                const timestampY = fieldY + fieldHeight / 2 + 3

                firstPage.drawText('Signed at:', {
                    x: timestampX,
                    y: timestampY,
                    size: 6,
                    color: rgb(0.2, 0.2, 0.8) // Azul
                })

                firstPage.drawText(`${fecha} ${hora}`, {
                    x: timestampX,
                    y: timestampY - 7,
                    size: 5,
                    color: rgb(0.3, 0.3, 0.3)
                })
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
