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

    // Altura total de la página (Carta es 792pt)
    const { height } = page.getSize()
    const fontSize = 9
    const color = rgb(0.1, 0.1, 0.1)

    // Función helper para dibujar texto
    const draw = (text: string, x: number, yFromTopBase: number, yOffset: number = 0, size: number = fontSize, font = fontRegular) => {
        page.drawText(String(text || '').toUpperCase(), {
            x,
            y: height - (yFromTopBase + yOffset),
            size,
            font,
            color
        })
    }

    // Definir offset para la copia inferior
    // Hoja Carta = 792pt de alto. Mitad = 396pt.
    // La copia empieza un poco más abajo de la mitad según imagen.
    const COPIA_Y_OFFSET = 396

    // === INSERTAR DATOS (Iteramos 2 veces: Original y Copia) ===
    const offsets = [0, COPIA_Y_OFFSET]

    offsets.forEach(offset => {
        // -- ENCABEZADO --
        // Bajamos todo aprox 30-40pt respecto a versión anterior
        // Número (Nº)
        draw(`${data.numero_recetario}`, 485, 105, offset, 11, fontBold)

        // Fecha
        const [anio, mes, dia] = data.fecha_prescripcion.split('-')
        draw(dia, 280, 122, offset)
        draw(mes, 360, 122, offset)
        draw(anio, 440, 122, offset)

        // -- 1. PACIENTE --
        const fila1 = 140 // Prima Apellido, Segundo, Nombres
        draw(data.paciente_apellido1, 110, fila1, offset)
        draw(data.paciente_apellido2 || '', 270, fila1, offset)
        draw(data.paciente_nombres, 410, fila1, offset)

        const fila2 = 175 // Identificación
        // Checks TI/CC/Otro
        if (data.paciente_tipo_id === 'CC') draw('X', 82, 168, offset, 10)
        else if (data.paciente_tipo_id === 'TI') draw('X', 45, 168, offset, 10)
        else draw('X', 128, 168, offset, 10) // Otro

        draw(data.paciente_documento, 170, 175, offset, 10)
        draw(data.paciente_edad?.toString() || '', 360, 175, offset)

        // Genero
        if (data.paciente_genero === 'F') draw('X', 430, 168, offset, 8)
        else if (data.paciente_genero === 'M') draw('X', 465, 168, offset, 8)

        // Teléfono, Municipio - Fila 3
        draw(data.paciente_telefono || '', 80, 195, offset)
        draw(data.paciente_municipio || '', 180, 195, offset)
        draw(data.paciente_direccion || '', 300, 195, offset)
        draw(data.paciente_departamento || 'CORDOBA', 460, 195, offset)

        // Afiliación SGSSS - Fila 4
        // Checks
        if (data.paciente_regimen === 'Subsidiado') draw('X', 135, 235, offset, 10)
        else if (data.paciente_regimen === 'Contributivo') draw('X', 225, 235, offset, 10)
        else if (data.paciente_regimen === 'Vinculado') draw('X', 320, 235, offset, 10)

        draw(data.paciente_eps || '', 380, 235, offset, 8)

        // -- 2. MEDICAMENTOS --
        const filaMed = 275
        let nombreMed = data.medicamento_nombre as string
        if (nombreMed.length > 25) nombreMed = nombreMed.substring(0, 25)

        draw(nombreMed, 40, filaMed, offset, 8)
        draw(data.medicamento_concentracion || '', 220, filaMed, offset, 8)
        draw(data.medicamento_forma_farmaceutica, 305, filaMed + 5, offset, 7)
        draw(data.medicamento_dosis_via || '', 370, filaMed, offset, 7)
        draw(data.cantidad_numero.toString(), 460, filaMed, offset)
        draw(data.cantidad_letras, 485, filaMed, offset, 6)

        // Diagnóstico
        const diagTexto = `${data.diagnostico_cie10 || ''} - ${data.diagnostico_descripcion || ''}`
        draw(diagTexto.substring(0, 90), 80, 305, offset, 8)

        // -- 3. PROFESIONAL --
        // Tipo Médico
        if (data.medico_tipo === 'General') draw('X', 100, 335, offset, 10)
        else draw('X', 190, 335, offset, 10) // Especializado

        if (data.medico_especialidad) {
            draw(data.medico_especialidad, 360, 335, offset, 9)
        }

        // Apellidos Nombres Médico
        draw(data.medico_nombres, 180, 350, offset, 9)

        // Doc, Res
        const filaProf3 = 370
        draw(data.medico_documento, 60, filaProf3, offset, 9)
        draw(data.medico_documento, 260, filaProf3, offset, 9)

        // Inst, Dir, Ciudad, Tel
        const filaInst = 385
        draw('GESTAR SALUD DE COLOMBIA IPS', 60, filaInst, offset, 7)
        draw(data.medico_direccion || 'CRA 6 n 65 24', 260, filaInst, offset, 7)
        draw(data.medico_ciudad || 'MONTERIA', 390, filaInst, offset, 7)
        draw(data.medico_telefono || '3103157229', 460, filaInst, offset, 7)
    })

    // 4. Guardar
    const pdfBytes = await pdfDoc.save()

    // 5. Convertir a Blob
    const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' })

    // Nombre del archivo - Agregar timestamp para evitar colisiones
    const fechaStr = data.fecha_prescripcion.replace(/-/g, '')
    const timestamp = new Date().getTime().toString().slice(-6) // Últimos 6 dígitos del timestamp
    const pacienteNombre = (data.paciente_nombres.split(' ')[0] + (data.paciente_apellido1 || '')).replace(/[^a-zA-Z0-9]/g, '')
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
