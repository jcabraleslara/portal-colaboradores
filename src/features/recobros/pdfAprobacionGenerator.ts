/**
 * Generador de PDF de Aprobación para Recobros
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * Genera un documento PDF institucional para solicitudes de recobro aprobadas.
 * Destinatario fijo: NUEVA EPS
 * Firma fija: VIVIANA ESTHELA DORIA GONZÁLEZ
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { Recobro } from '@/types/recobros.types'

interface PdfAprobacionResult {
    blob: Blob
    filename: string
}

/**
 * Genera un PDF de aprobación para un recobro
 */
export async function generarPdfAprobacion(recobro: Recobro): Promise<PdfAprobacionResult> {
    // Crear nuevo documento
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([612, 792]) // Carta
    const { width, height } = page.getSize()

    // Cargar fuentes
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

    // Colores
    const colorPrimario = rgb(0.114, 0.447, 0.263) // Verde institucional
    const colorTexto = rgb(0.1, 0.1, 0.1)
    const colorGris = rgb(0.4, 0.4, 0.4)

    // Márgenes
    const margenX = 50
    let cursorY = height - 60

    // ========================================
    // ENCABEZADO
    // ========================================
    page.drawText('GESTAR SALUD DE COLOMBIA IPS SAS', {
        x: margenX,
        y: cursorY,
        size: 16,
        font: fontBold,
        color: colorPrimario,
    })

    cursorY -= 18
    page.drawText('NIT: 900.842.629-2', {
        x: margenX,
        y: cursorY,
        size: 10,
        font: fontRegular,
        color: colorGris,
    })

    cursorY -= 12
    page.drawText('Montería, Córdoba', {
        x: margenX,
        y: cursorY,
        size: 10,
        font: fontRegular,
        color: colorGris,
    })

    // Línea divisoria
    cursorY -= 20
    page.drawLine({
        start: { x: margenX, y: cursorY },
        end: { x: width - margenX, y: cursorY },
        thickness: 1,
        color: colorPrimario,
    })

    // ========================================
    // TÍTULO Y CONSECUTIVO
    // ========================================
    cursorY -= 40
    page.drawText('SOLICITUD DE RECOBRO', {
        x: margenX,
        y: cursorY,
        size: 14,
        font: fontBold,
        color: colorTexto,
    })

    // Consecutivo a la derecha
    const textoConsecutivo = `Radicado: ${recobro.consecutivo}`
    const anchoConsecutivo = fontBold.widthOfTextAtSize(textoConsecutivo, 12)
    page.drawText(textoConsecutivo, {
        x: width - margenX - anchoConsecutivo,
        y: cursorY,
        size: 12,
        font: fontBold,
        color: colorPrimario,
    })

    // Fecha
    cursorY -= 20
    const fechaActual = new Date().toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
    page.drawText(`Fecha: ${fechaActual}`, {
        x: margenX,
        y: cursorY,
        size: 10,
        font: fontRegular,
        color: colorGris,
    })

    // ========================================
    // DESTINATARIO
    // ========================================
    cursorY -= 40
    page.drawText('Señores:', {
        x: margenX,
        y: cursorY,
        size: 11,
        font: fontRegular,
        color: colorTexto,
    })

    cursorY -= 18
    page.drawText('NUEVA EPS', {
        x: margenX,
        y: cursorY,
        size: 12,
        font: fontBold,
        color: colorTexto,
    })

    cursorY -= 16
    page.drawText('Departamento de Recobros y Cartera', {
        x: margenX,
        y: cursorY,
        size: 10,
        font: fontRegular,
        color: colorGris,
    })

    // ========================================
    // ASUNTO
    // ========================================
    cursorY -= 30
    page.drawText('ASUNTO:', {
        x: margenX,
        y: cursorY,
        size: 10,
        font: fontBold,
        color: colorTexto,
    })
    page.drawText(`Solicitud de Recobro - Radicado ${recobro.consecutivo}`, {
        x: margenX + 55,
        y: cursorY,
        size: 10,
        font: fontRegular,
        color: colorTexto,
    })

    // ========================================
    // DATOS DEL PACIENTE
    // ========================================
    cursorY -= 35
    page.drawText('DATOS DEL PACIENTE', {
        x: margenX,
        y: cursorY,
        size: 11,
        font: fontBold,
        color: colorPrimario,
    })

    cursorY -= 20
    page.drawText(`Nombre: ${recobro.pacienteNombres || 'No especificado'}`, {
        x: margenX,
        y: cursorY,
        size: 10,
        font: fontRegular,
        color: colorTexto,
    })

    cursorY -= 16
    page.drawText(`Identificación: ${recobro.pacienteTipoId || ''} ${recobro.pacienteId}`, {
        x: margenX,
        y: cursorY,
        size: 10,
        font: fontRegular,
        color: colorTexto,
    })

    // ========================================
    // PROCEDIMIENTOS (CUPS)
    // ========================================
    cursorY -= 35
    page.drawText('PROCEDIMIENTOS SOLICITADOS', {
        x: margenX,
        y: cursorY,
        size: 11,
        font: fontBold,
        color: colorPrimario,
    })

    // Tabla de CUPS
    cursorY -= 25

    // Encabezados de tabla
    page.drawText('Código', { x: margenX, y: cursorY, size: 9, font: fontBold, color: colorTexto })
    page.drawText('Descripción', { x: margenX + 80, y: cursorY, size: 9, font: fontBold, color: colorTexto })
    page.drawText('Cant.', { x: width - margenX - 40, y: cursorY, size: 9, font: fontBold, color: colorTexto })

    cursorY -= 5
    page.drawLine({
        start: { x: margenX, y: cursorY },
        end: { x: width - margenX, y: cursorY },
        thickness: 0.5,
        color: colorGris,
    })

    // Filas de CUPS
    for (const cups of recobro.cupsData) {
        cursorY -= 18

        // Marcar principal con asterisco
        const codigoTexto = cups.es_principal ? `* ${cups.cups}` : cups.cups
        page.drawText(codigoTexto, {
            x: margenX,
            y: cursorY,
            size: 9,
            font: cups.es_principal ? fontBold : fontRegular,
            color: colorTexto,
        })

        // Truncar descripción si es muy larga
        let descripcion = cups.descripcion
        const maxAncho = 350
        while (fontRegular.widthOfTextAtSize(descripcion, 9) > maxAncho && descripcion.length > 10) {
            descripcion = descripcion.slice(0, -4) + '...'
        }

        page.drawText(descripcion, {
            x: margenX + 80,
            y: cursorY,
            size: 9,
            font: fontRegular,
            color: colorTexto,
        })

        page.drawText(cups.cantidad.toString(), {
            x: width - margenX - 30,
            y: cursorY,
            size: 9,
            font: fontRegular,
            color: colorTexto,
        })
    }

    // Nota de procedimiento principal
    cursorY -= 25
    page.drawText('* Procedimiento principal', {
        x: margenX,
        y: cursorY,
        size: 8,
        font: fontRegular,
        color: colorGris,
    })

    // ========================================
    // JUSTIFICACIÓN (si existe)
    // ========================================
    if (recobro.justificacion) {
        cursorY -= 30
        page.drawText('JUSTIFICACIÓN CLÍNICA', {
            x: margenX,
            y: cursorY,
            size: 11,
            font: fontBold,
            color: colorPrimario,
        })

        cursorY -= 18
        // Dividir texto en líneas
        const palabras = recobro.justificacion.split(' ')
        let linea = ''
        const maxAnchoLinea = width - 2 * margenX

        for (const palabra of palabras) {
            const prueba = linea + (linea ? ' ' : '') + palabra
            if (fontRegular.widthOfTextAtSize(prueba, 10) > maxAnchoLinea) {
                page.drawText(linea, {
                    x: margenX,
                    y: cursorY,
                    size: 10,
                    font: fontRegular,
                    color: colorTexto,
                })
                cursorY -= 14
                linea = palabra
            } else {
                linea = prueba
            }
        }
        if (linea) {
            page.drawText(linea, {
                x: margenX,
                y: cursorY,
                size: 10,
                font: fontRegular,
                color: colorTexto,
            })
        }
    }

    // ========================================
    // ESTADO DE APROBACIÓN
    // ========================================
    cursorY -= 40
    page.drawRectangle({
        x: margenX,
        y: cursorY - 25,
        width: width - 2 * margenX,
        height: 35,
        color: rgb(0.9, 0.97, 0.93), // Verde claro
        borderColor: colorPrimario,
        borderWidth: 1,
    })

    page.drawText('ESTADO: APROBADO', {
        x: margenX + 15,
        y: cursorY - 10,
        size: 12,
        font: fontBold,
        color: colorPrimario,
    })

    // ========================================
    // FIRMA
    // ========================================
    cursorY -= 80
    page.drawText('Atentamente,', {
        x: margenX,
        y: cursorY,
        size: 10,
        font: fontRegular,
        color: colorTexto,
    })

    cursorY -= 40
    page.drawLine({
        start: { x: margenX, y: cursorY },
        end: { x: margenX + 200, y: cursorY },
        thickness: 1,
        color: colorTexto,
    })

    cursorY -= 15
    page.drawText('VIVIANA ESTHELA DORIA GONZÁLEZ', {
        x: margenX,
        y: cursorY,
        size: 10,
        font: fontBold,
        color: colorTexto,
    })

    cursorY -= 14
    page.drawText('Coordinadora de Calidad y Auditoría', {
        x: margenX,
        y: cursorY,
        size: 9,
        font: fontRegular,
        color: colorGris,
    })

    cursorY -= 12
    page.drawText('GESTAR SALUD DE COLOMBIA IPS SAS', {
        x: margenX,
        y: cursorY,
        size: 9,
        font: fontRegular,
        color: colorGris,
    })

    // ========================================
    // PIE DE PÁGINA
    // ========================================
    const pieY = 40
    page.drawLine({
        start: { x: margenX, y: pieY + 15 },
        end: { x: width - margenX, y: pieY + 15 },
        thickness: 0.5,
        color: colorGris,
    })

    page.drawText('Documento generado automáticamente por el Portal de Colaboradores', {
        x: margenX,
        y: pieY,
        size: 8,
        font: fontRegular,
        color: colorGris,
    })

    const timestamp = new Date().toISOString()
    const textoTimestamp = `Generado: ${timestamp}`
    const anchoTimestamp = fontRegular.widthOfTextAtSize(textoTimestamp, 8)
    page.drawText(textoTimestamp, {
        x: width - margenX - anchoTimestamp,
        y: pieY,
        size: 8,
        font: fontRegular,
        color: colorGris,
    })

    // ========================================
    // GENERAR BLOB
    // ========================================
    const pdfBytes = await pdfDoc.save()
    const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' })

    // Nombre del archivo
    const fechaStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const filename = `APROBACION_${recobro.consecutivo}_${fechaStr}.pdf`

    return { blob, filename }
}

/**
 * Descarga el PDF en el navegador
 */
export function descargarPdfAprobacion(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export default { generarPdfAprobacion, descargarPdfAprobacion }
