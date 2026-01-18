/**
 * Generador de PDF para Anexo 8
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Genera PDF del Recetario Oficial para Medicamentos de Control Especial (FNE)
 */

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib'
import { Anexo8Record } from '@/types/anexo8.types'

// Configuración de página
const PAGE_WIDTH = 595.28 // A4 width in points
const PAGE_HEIGHT = 841.89 // A4 height in points
const MARGIN = 40
const LINE_HEIGHT = 14
const FONT_SIZE = 9
const HEADER_FONT_SIZE = 11
const TITLE_FONT_SIZE = 14

interface PdfGeneratorResult {
    blob: Blob
    filename: string
}

/**
 * Genera un PDF del Anexo 8 con los datos proporcionados
 */
export async function generarAnexo8Pdf(data: Anexo8Record): Promise<PdfGeneratorResult> {
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

    // Cargar fuentes
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    let y = PAGE_HEIGHT - MARGIN

    // === ENCABEZADO ===
    y = dibujarEncabezado(page, fontBold, fontRegular, y, data.numero_recetario)

    // === SECCIÓN 1: PACIENTE ===
    y = dibujarSeccionPaciente(page, fontBold, fontRegular, y, data)

    // === SECCIÓN 2: MEDICAMENTOS ===
    y = dibujarSeccionMedicamento(page, fontBold, fontRegular, y, data)

    // === SECCIÓN 3: PROFESIONAL ===
    y = dibujarSeccionProfesional(page, fontBold, fontRegular, y, data)

    // === SECCIÓN 4: ENTREGA (vacía) ===
    y = dibujarSeccionEntrega(page, fontBold, fontRegular, y)

    // Generar blob
    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })

    // Nombre del archivo
    const fechaStr = data.fecha_prescripcion.replace(/-/g, '')
    const medNombre = data.medicamento_nombre.replace(/ /g, '_').substring(0, 15)
    const filename = `ANEXO8_${data.paciente_documento}_${medNombre}_${fechaStr}.pdf`

    return { blob, filename }
}

/**
 * Dibuja el encabezado con escudo y datos del FNE
 */
function dibujarEncabezado(
    page: PDFPage,
    fontBold: PDFFont,
    fontRegular: PDFFont,
    y: number,
    numeroRecetario: string
): number {
    const { width } = page.getSize()

    // Título principal
    page.drawText('República de Colombia', {
        x: width / 2 - 70,
        y,
        size: FONT_SIZE,
        font: fontRegular,
        color: rgb(0, 0, 0)
    })
    y -= LINE_HEIGHT

    page.drawText('U.A.E. Fondo Nacional de Estupefacientes', {
        x: width / 2 - 100,
        y,
        size: FONT_SIZE,
        font: fontBold,
        color: rgb(0, 0, 0)
    })
    y -= LINE_HEIGHT

    page.drawText('Ministerio de la Protección Social', {
        x: width / 2 - 80,
        y,
        size: FONT_SIZE,
        font: fontRegular,
        color: rgb(0, 0, 0)
    })
    y -= LINE_HEIGHT * 2

    // Título ANEXO
    page.drawText('ANEXO No. 8', {
        x: width / 2 - 40,
        y,
        size: TITLE_FONT_SIZE,
        font: fontBold,
        color: rgb(0, 0, 0)
    })
    y -= LINE_HEIGHT * 2

    // Subtítulo y número
    const subtitulo = 'RECETARIO OFICIAL PARA MEDICAMENTOS DE CONTROL ESPECIAL'
    page.drawText(subtitulo, {
        x: MARGIN,
        y,
        size: HEADER_FONT_SIZE,
        font: fontBold,
        color: rgb(0, 0, 0)
    })

    page.drawText(`Nº ${numeroRecetario}`, {
        x: width - MARGIN - 80,
        y,
        size: HEADER_FONT_SIZE,
        font: fontBold,
        color: rgb(0, 0, 0)
    })
    y -= LINE_HEIGHT * 2

    return y
}

/**
 * Dibuja la sección 1: Datos del Paciente
 */
function dibujarSeccionPaciente(
    page: PDFPage,
    fontBold: PDFFont,
    fontRegular: PDFFont,
    y: number,
    data: Anexo8Record
): number {
    const { width } = page.getSize()

    // Título de sección
    page.drawText('1. PACIENTE', {
        x: MARGIN,
        y,
        size: FONT_SIZE + 1,
        font: fontBold,
        color: rgb(0, 0, 0)
    })

    // Fecha
    const fecha = new Date(data.fecha_prescripcion)
    const dia = fecha.getDate().toString().padStart(2, '0')
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0')
    const anio = fecha.getFullYear()

    page.drawText(`Fecha: ${dia} / ${mes} / ${anio}`, {
        x: width - MARGIN - 120,
        y,
        size: FONT_SIZE,
        font: fontRegular,
        color: rgb(0, 0, 0)
    })
    y -= LINE_HEIGHT * 1.5

    // Línea de nombre
    const labelWidth = 100
    dibujarCampo(page, fontBold, fontRegular, MARGIN, y, 'Primer Apellido:', data.paciente_apellido1, labelWidth)
    dibujarCampo(page, fontBold, fontRegular, MARGIN + 180, y, 'Segundo Apellido:', data.paciente_apellido2 || '', labelWidth)
    dibujarCampo(page, fontBold, fontRegular, MARGIN + 360, y, 'Nombres:', data.paciente_nombres, 60)
    y -= LINE_HEIGHT * 1.5

    // Documento
    dibujarCampo(page, fontBold, fontRegular, MARGIN, y, 'Tipo ID:', data.paciente_tipo_id, 50)
    dibujarCampo(page, fontBold, fontRegular, MARGIN + 100, y, 'Número:', data.paciente_documento, 50)
    dibujarCampo(page, fontBold, fontRegular, MARGIN + 240, y, 'Edad:', data.paciente_edad?.toString() || '', 40)
    dibujarCampo(page, fontBold, fontRegular, MARGIN + 320, y, 'Género:', data.paciente_genero || '', 50)
    y -= LINE_HEIGHT * 1.5

    // Contacto
    dibujarCampo(page, fontBold, fontRegular, MARGIN, y, 'Teléfono:', data.paciente_telefono || '', 60)
    dibujarCampo(page, fontBold, fontRegular, MARGIN + 130, y, 'Municipio:', data.paciente_municipio || '', 70)
    y -= LINE_HEIGHT * 1.5

    // Dirección
    dibujarCampo(page, fontBold, fontRegular, MARGIN, y, 'Dirección:', data.paciente_direccion || '', 70)
    dibujarCampo(page, fontBold, fontRegular, MARGIN + 300, y, 'Departamento:', data.paciente_departamento || '', 90)
    y -= LINE_HEIGHT * 1.5

    // Afiliación
    const subsidiado = data.paciente_regimen === 'Subsidiado' ? '●' : '○'
    const contributivo = data.paciente_regimen === 'Contributivo' ? '●' : '○'
    const vinculado = data.paciente_regimen === 'Vinculado' ? '●' : '○'

    page.drawText(`Afiliación al SGSSS: Subsidiado ${subsidiado}  Contributivo ${contributivo}  Vinculado ${vinculado}`, {
        x: MARGIN,
        y,
        size: FONT_SIZE,
        font: fontRegular,
        color: rgb(0, 0, 0)
    })

    dibujarCampo(page, fontBold, fontRegular, MARGIN + 350, y, 'EPS:', data.paciente_eps || '', 40)
    y -= LINE_HEIGHT * 2

    return y
}

/**
 * Dibuja la sección 2: Medicamentos
 */
function dibujarSeccionMedicamento(
    page: PDFPage,
    fontBold: PDFFont,
    fontRegular: PDFFont,
    y: number,
    data: Anexo8Record
): number {
    // Título
    page.drawText('2. MEDICAMENTOS', {
        x: MARGIN,
        y,
        size: FONT_SIZE + 1,
        font: fontBold,
        color: rgb(0, 0, 0)
    })
    y -= LINE_HEIGHT * 1.5

    // Encabezados de columnas
    const colWidths = [150, 80, 100, 100, 50, 70]
    const colX = [MARGIN, 190, 270, 370, 470, 520]
    const headers = ['Nombre Genérico', 'Concentración', 'Forma Farmacéutica', 'Dosis / Vía', 'Cant.', 'En Letras']

    headers.forEach((header, i) => {
        page.drawText(header, {
            x: colX[i],
            y,
            size: FONT_SIZE - 1,
            font: fontBold,
            color: rgb(0, 0, 0)
        })
    })
    y -= LINE_HEIGHT

    // Línea separadora
    page.drawLine({
        start: { x: MARGIN, y: y + 5 },
        end: { x: PAGE_WIDTH - MARGIN, y: y + 5 },
        thickness: 0.5,
        color: rgb(0, 0, 0)
    })
    y -= LINE_HEIGHT * 0.5

    // Datos del medicamento
    const values = [
        data.medicamento_nombre,
        data.medicamento_concentracion || '',
        data.medicamento_forma_farmaceutica,
        data.medicamento_dosis_via || '',
        data.cantidad_numero.toString(),
        data.cantidad_letras
    ]

    values.forEach((val, i) => {
        // Truncar si es muy largo
        const maxLen = i === 0 ? 25 : (i === 3 || i === 5) ? 20 : 15
        const displayVal = val.length > maxLen ? val.substring(0, maxLen) + '...' : val

        page.drawText(displayVal, {
            x: colX[i],
            y,
            size: FONT_SIZE,
            font: fontRegular,
            color: rgb(0, 0, 0)
        })
    })
    y -= LINE_HEIGHT * 2

    // Diagnóstico
    dibujarCampo(page, fontBold, fontRegular, MARGIN, y, 'Diagnóstico:',
        `${data.diagnostico_cie10 || ''} - ${data.diagnostico_descripcion || ''}`, 80)
    y -= LINE_HEIGHT * 2

    return y
}

/**
 * Dibuja la sección 3: Profesional
 */
function dibujarSeccionProfesional(
    page: PDFPage,
    fontBold: PDFFont,
    fontRegular: PDFFont,
    y: number,
    data: Anexo8Record
): number {
    // Título
    page.drawText('3. PROFESIONAL', {
        x: MARGIN,
        y,
        size: FONT_SIZE + 1,
        font: fontBold,
        color: rgb(0, 0, 0)
    })
    y -= LINE_HEIGHT * 1.5

    // Tipo de médico
    const general = data.medico_tipo === 'General' ? 'X' : '○'
    const especializado = data.medico_tipo === 'Especializado' ? 'X' : '○'

    page.drawText(`Médico: General [${general}]  Especializado [${especializado}]`, {
        x: MARGIN,
        y,
        size: FONT_SIZE,
        font: fontRegular,
        color: rgb(0, 0, 0)
    })

    if (data.medico_especialidad) {
        dibujarCampo(page, fontBold, fontRegular, MARGIN + 250, y, 'Especialidad:', data.medico_especialidad, 80)
    }
    y -= LINE_HEIGHT * 1.5

    // Nombre del médico
    dibujarCampo(page, fontBold, fontRegular, MARGIN, y, 'Nombre Completo:', data.medico_nombres, 110)
    y -= LINE_HEIGHT * 1.5

    // Documento
    dibujarCampo(page, fontBold, fontRegular, MARGIN, y, 'Documento:', data.medico_documento, 70)
    dibujarCampo(page, fontBold, fontRegular, MARGIN + 200, y, 'Resolución Prof. N°:', data.medico_documento, 110)
    y -= LINE_HEIGHT * 1.5

    // Institución
    page.drawText('Institución donde labora: Gestar Salud de Colombia IPS', {
        x: MARGIN,
        y,
        size: FONT_SIZE,
        font: fontRegular,
        color: rgb(0, 0, 0)
    })
    y -= LINE_HEIGHT * 1.5

    // Dirección y contacto
    dibujarCampo(page, fontBold, fontRegular, MARGIN, y, 'Dirección:', data.medico_direccion || '', 60)
    dibujarCampo(page, fontBold, fontRegular, MARGIN + 250, y, 'Ciudad:', data.medico_ciudad || '', 50)
    dibujarCampo(page, fontBold, fontRegular, MARGIN + 380, y, 'Teléfono:', data.medico_telefono || '', 60)
    y -= LINE_HEIGHT * 2

    return y
}

/**
 * Dibuja la sección 4: Entrega del medicamento (vacía)
 */
function dibujarSeccionEntrega(
    page: PDFPage,
    fontBold: PDFFont,
    fontRegular: PDFFont,
    y: number
): number {
    // Título
    page.drawText('4. ENTREGA DEL MEDICAMENTO (A diligenciar por el establecimiento farmacéutico Minorista)', {
        x: MARGIN,
        y,
        size: FONT_SIZE,
        font: fontBold,
        color: rgb(0.3, 0.3, 0.3)
    })
    y -= LINE_HEIGHT * 1.5

    // Campos vacíos
    const campos = [
        'Apellidos y Nombres de quien recibe:',
        'N° de Identidad:',
        'Firma:',
        'Apellidos y Nombres de quien dispensa:',
        'Establecimiento Farmacéutico Minorista:',
        'Dirección:',
        'Fecha Despacho:'
    ]

    campos.forEach(campo => {
        page.drawText(campo + ' _______________________', {
            x: MARGIN,
            y,
            size: FONT_SIZE - 1,
            font: fontRegular,
            color: rgb(0.5, 0.5, 0.5)
        })
        y -= LINE_HEIGHT
    })

    return y
}

/**
 * Dibuja un campo con etiqueta y valor
 */
function dibujarCampo(
    page: PDFPage,
    fontBold: PDFFont,
    fontRegular: PDFFont,
    x: number,
    y: number,
    label: string,
    value: string,
    labelWidth: number
): void {
    page.drawText(label, {
        x,
        y,
        size: FONT_SIZE,
        font: fontBold,
        color: rgb(0, 0, 0)
    })

    page.drawText(value, {
        x: x + labelWidth,
        y,
        size: FONT_SIZE,
        font: fontRegular,
        color: rgb(0, 0, 0)
    })
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
