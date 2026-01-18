/**
 * Generador de PDF para Anexo 8 usando Plantilla Oficial
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { Anexo8Record } from '@/types/anexo8.types'

interface PdfGeneratorResult {
    blob: Blob
    filename: string
}

/**
 * Genera un PDF del Anexo 8 utilizando la plantilla oficial
 */
export async function generarAnexo8Pdf(data: Anexo8Record): Promise<PdfGeneratorResult> {
    // 1. Cargar la plantilla desde public/templates
    const url = '/templates/anexo8_plantilla.pdf'
    const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer())

    // 2. Cargar el documento PDF
    const pdfDoc = await PDFDocument.load(existingPdfBytes)
    const page = pdfDoc.getPages()[0]

    // 3. incrustar fuente standar
    // Usamos Helvetica o Courier para simular llenado digital/máquina
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const { height } = page.getSize()
    const fontSize = 10
    const color = rgb(0.1, 0.1, 0.1) // Negro suave

    // Función helper para dibujar texto
    const draw = (text: string, x: number, yFromTop: number, size: number = fontSize, font = fontRegular) => {
        // Convertir coordenadas: en PDF (0,0) es abajo-izquierda, pero es más fácil pensar desde arriba
        page.drawText(String(text || '').toUpperCase(), {
            x,
            y: height - yFromTop,
            size,
            font,
            color
        })
    }

    // === INSERTAR DATOS ===

    // -- ENCABEZADO --
    // Número (M-XXXX) - Asumiendo posición cerca de esquina superior derecha
    draw(`Nº ${data.numero_recetario}`, 450, 95, 12, fontBold)

    // Fecha Prescripción
    // Usar split para evitar problemas de zona horaria con new Date("YYYY-MM-DD")
    const [anio, mes, dia] = data.fecha_prescripcion.split('-')

    draw(`${dia}   /   ${mes}   /   ${anio}`, 440, 137, 11)

    // -- 1. PACIENTE --
    // Coordenadas estimadas basadas en formato estándar
    const fila1 = 165
    draw(data.paciente_apellido1, 120, fila1)           // Primer Apellido
    draw(data.paciente_apellido2 || '', 280, fila1)     // Segundo Apellido
    draw(data.paciente_nombres, 430, fila1)             // Nombres

    const fila2 = 188
    // Tipo ID (Check simple basado en texto)
    draw(data.paciente_tipo_id, 95, fila2)
    draw(data.paciente_documento, 180, fila2)           // Número
    draw(data.paciente_edad?.toString() || '', 350, fila2) // Edad
    draw(data.paciente_genero || '', 450, fila2)        // Género

    const fila3 = 212
    draw(data.paciente_telefono || '', 100, fila3)      // Teléfono
    draw(data.paciente_municipio || '', 260, fila3)     // Municipio

    const fila4 = 235
    draw(data.paciente_direccion || '', 100, fila4)     // Dirección
    draw(data.paciente_departamento || '', 450, fila4)  // Departamento (CORDOBA)

    const fila5 = 258 // Afiliación y EPS
    // Marcar con X según régimen
    if (data.paciente_regimen === 'Subsidiado') draw('X', 205, fila5)
    if (data.paciente_regimen === 'Contributivo') draw('X', 285, fila5)
    if (data.paciente_regimen === 'Vinculado') draw('X', 355, fila5)

    draw(data.paciente_eps || '', 430, fila5)           // EPS

    // -- 2. MEDICAMENTOS --
    const filaMed = 320
    draw(data.medicamento_nombre, 40, filaMed)                     // Nombre Genérico
    draw(data.medicamento_concentracion || '', 240, filaMed)       // Concentración
    draw(data.medicamento_forma_farmaceutica, 320, filaMed)        // Forma Farm. (ajustar x)
    draw(data.medicamento_dosis_via || '', 420, filaMed, 9)        // Dosis / Vía
    draw(data.cantidad_numero.toString(), 515, filaMed)            // Cantidad Num
    draw(data.cantidad_letras, 545, filaMed, 8)                    // En Letras (ajustar x/size)

    const filaDiag = 355
    const diagTexto = `${data.diagnostico_cie10 || ''} - ${data.diagnostico_descripcion || ''}`
    draw(diagTexto.substring(0, 85), 110, filaDiag, 9)             // Diagnóstico

    // -- 3. PROFESIONAL --
    const filaProf1 = 405
    // Tipo Médico
    if (data.medico_tipo === 'General') draw('X', 145, filaProf1)
    if (data.medico_tipo === 'Especializado') draw('X', 235, filaProf1)

    // Especialidad
    if (data.medico_especialidad) {
        draw(data.medico_especialidad, 450, filaProf1)
    }

    const filaProf2 = 430
    draw(data.medico_nombres, 150, filaProf2) // Nombre Completo

    const filaProf3 = 455
    draw(data.medico_documento, 130, filaProf3) // Documento
    draw(data.medico_documento, 380, filaProf3) // Resolución (usamos mismo documento o dejar vacío si es otro)

    const filaInst = 480
    draw('GESTAR SALUD DE COLOMBIA IPS', 210, filaInst) // Institución

    const filaDirProf = 505
    draw(data.medico_direccion || 'CRA 6 n 65 24', 90, filaDirProf) // Dirección
    draw(data.medico_ciudad || 'MONTERIA', 350, filaDirProf)      // Ciudad
    draw(data.medico_telefono || '', 500, filaDirProf)            // Teléfono

    // 4. Guardar
    const pdfBytes = await pdfDoc.save()

    // 5. Convertir a Blob
    const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' })

    // Nombre del archivo
    const fechaStr = data.fecha_prescripcion.replace(/-/g, '')
    // Sanitizar nombre paciente
    const pacienteNombre = (data.paciente_nombres.split(' ')[0] + (data.paciente_apellido1 || '')).replace(/[^a-zA-Z0-9]/g, '')
    const filename = `ANEXO8_${data.paciente_documento}_${pacienteNombre}_${fechaStr}.pdf`

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
