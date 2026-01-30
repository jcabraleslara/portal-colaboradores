/**
 * Generador de PDF de Carta de Autorización para Recobros
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * Genera un documento PDF institucional usando pdf-lib (confiable)
 * Respeta el formato SIG-MD-DE-FT-06 del Sistema Integrado de Gestión
 */

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib'
import { Recobro } from '@/types/recobros.types'

interface PdfAprobacionResult {
    blob: Blob
    filename: string
}

// Colores institucionales
const COLOR_AZUL_GESTAR = rgb(0, 0.584, 0.922) // #0095EB
const COLOR_AZUL_CLARO = rgb(0.902, 0.957, 0.992) // #E6F4FD
const COLOR_NEGRO = rgb(0, 0, 0)
const COLOR_GRIS = rgb(0.4, 0.4, 0.4)

/**
 * Genera un hash simple para la firma electrónica
 */
function generarHashVerificacion(data: string): string {
    let hash = 0
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
    }
    const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')
    return hexHash.slice(0, 8)
}

/**
 * Formatea fecha en español
 */
function formatearFecha(fecha: Date): string {
    return fecha.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

/**
 * Formatea timestamp
 */
function formatearTimestamp(): string {
    return new Date().toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    })
}

/**
 * Trunca texto si excede el ancho máximo
 */
function truncarTexto(texto: string, font: PDFFont, fontSize: number, maxWidth: number): string {
    let truncated = texto
    while (font.widthOfTextAtSize(truncated, fontSize) > maxWidth && truncated.length > 3) {
        truncated = truncated.slice(0, -4) + '...'
    }
    return truncated
}

/**
 * Limpia caracteres de Markdown para el PDF
 */
function limpiarMarkdown(texto: string): string {
    if (!texto) return ''
    return texto
        // Eliminar negrita (**texto** o __texto__)
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        // Eliminar cursiva (*texto* o _texto_)
        .replace(/(\*|_)(.*?)\1/g, '$2')
        // Eliminar encabezados (### Texto)
        .replace(/^#+\s+/gm, '')
        // Reemplazar items de lista (* Item o - Item) por bullet
        .replace(/^[\*\-]\s+/gm, '• ')
        // Eliminar enlaces [Texto](url) -> Texto
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
}

/**
 * Dibuja una celda de tabla con borde
 */
function dibujarCelda(
    page: PDFPage,
    x: number,
    y: number,
    width: number,
    height: number,
    texto: string,
    font: PDFFont,
    fontSize: number,
    options: {
        bgColor?: typeof COLOR_AZUL_CLARO
        textColor?: typeof COLOR_NEGRO
        bold?: boolean
        align?: 'left' | 'center'
        padding?: number
    } = {}
) {
    const { bgColor, textColor = COLOR_NEGRO, align = 'left', padding = 5 } = options

    // Fondo
    if (bgColor) {
        page.drawRectangle({
            x,
            y: y - height,
            width,
            height,
            color: bgColor,
        })
    }

    // Borde
    page.drawRectangle({
        x,
        y: y - height,
        width,
        height,
        borderColor: COLOR_NEGRO,
        borderWidth: 0.5,
    })

    // Texto
    const textoTruncado = truncarTexto(texto, font, fontSize, width - padding * 2)
    const textWidth = font.widthOfTextAtSize(textoTruncado, fontSize)
    const textX = align === 'center' ? x + (width - textWidth) / 2 : x + padding
    const textY = y - height / 2 - fontSize / 3

    page.drawText(textoTruncado, {
        x: textX,
        y: textY,
        size: fontSize,
        font,
        color: textColor,
    })
}

/**
 * Genera un PDF de aprobación para un recobro
 */
export async function generarPdfAprobacion(
    recobro: Recobro,
    aprobadoPor?: string
): Promise<PdfAprobacionResult> {
    const nombreAprobador = aprobadoPor || recobro.radicadorNombre || recobro.radicadorEmail || 'Sistema'
    const fecha = formatearFecha(new Date())
    const timestamp = formatearTimestamp()
    const codigoVerificacion = `GS-${generarHashVerificacion(`${recobro.consecutivo}-${recobro.pacienteId}-${timestamp}`)}`

    // Crear documento
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([612, 792]) // Tamaño carta
    const { width, height } = page.getSize()

    // Cargar fuentes
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Márgenes
    const marginX = 40
    const contentWidth = width - marginX * 2
    let cursorY = height - 40

    // ========================================
    // ENCABEZADO INSTITUCIONAL
    // ========================================
    const headerHeight = 80
    const logoWidth = contentWidth * 0.25
    const titleWidth = contentWidth * 0.75

    // Borde exterior del encabezado
    page.drawRectangle({
        x: marginX,
        y: cursorY - headerHeight,
        width: contentWidth,
        height: headerHeight,
        borderColor: COLOR_NEGRO,
        borderWidth: 1, // Reduced from 2 to match standard
    })

    // Celda del logo (izquierda)
    page.drawRectangle({
        x: marginX,
        y: cursorY - headerHeight,
        width: logoWidth,
        height: headerHeight,
        borderColor: COLOR_NEGRO,
        borderWidth: 1,
    })

    // Cargar e insertar logo
    try {
        const logoResponse = await fetch('/logo_gestar.png')
        const logoBytes = await logoResponse.arrayBuffer()
        const logoImage = await pdfDoc.embedPng(logoBytes)
        const logoDims = logoImage.scale(0.35)
        const logoX = marginX + (logoWidth - logoDims.width) / 2
        const logoY = cursorY - headerHeight / 2 - logoDims.height / 2
        page.drawImage(logoImage, {
            x: logoX,
            y: logoY,
            width: logoDims.width,
            height: logoDims.height,
        })
    } catch {
        // Si falla el logo, escribir texto
        page.drawText('GESTAR SALUD', {
            x: marginX + 10,
            y: cursorY - headerHeight / 2,
            size: 10,
            font: fontBold,
            color: COLOR_AZUL_GESTAR,
        })
    }

    // Filas del título
    const titleX = marginX + logoWidth
    const rowHeight = headerHeight / 4

    // Fila 1: SISTEMA INTEGRADO DE GESTIÓN
    page.drawRectangle({
        x: titleX,
        y: cursorY - rowHeight,
        width: titleWidth,
        height: rowHeight,
        // color: COLOR_VERDE_CLARO, // Removed background
        borderColor: COLOR_NEGRO,
        borderWidth: 0.5,
    })
    const texto1 = 'SISTEMA INTEGRADO DE GESTIÓN'
    page.drawText(texto1, {
        x: titleX + (titleWidth - fontBold.widthOfTextAtSize(texto1, 11)) / 2,
        y: cursorY - rowHeight / 2 - 4,
        size: 11,
        font: fontBold,
        color: COLOR_NEGRO,
    })

    // Fila 2: GESTIÓN DEL TALENTO HUMANO
    page.drawRectangle({
        x: titleX,
        y: cursorY - rowHeight * 2,
        width: titleWidth,
        height: rowHeight,
        borderColor: COLOR_NEGRO,
        borderWidth: 0.5,
    })
    const texto2 = 'GESTIÓN DEL TALENTO HUMANO'
    page.drawText(texto2, {
        x: titleX + (titleWidth - fontRegular.widthOfTextAtSize(texto2, 10)) / 2,
        y: cursorY - rowHeight * 1.5 - 4,
        size: 10,
        font: fontRegular,
        color: COLOR_NEGRO,
    })

    // Fila 3: CARTA DE AUTORIZACIÓN...
    page.drawRectangle({
        x: titleX,
        y: cursorY - rowHeight * 3,
        width: titleWidth,
        height: rowHeight,
        // color: COLOR_GRIS_CLARO, // Removed background
        borderColor: COLOR_NEGRO,
        borderWidth: 0.5,
    })
    const texto3 = 'CARTA DE AUTORIZACIÓN DE RECOBRO POR SERVICIOS DE SALUD'
    page.drawText(texto3, {
        x: titleX + (titleWidth - fontBold.widthOfTextAtSize(texto3, 9)) / 2,
        y: cursorY - rowHeight * 2.5 - 4,
        size: 9,
        font: fontBold,
        color: COLOR_NEGRO,
    })

    // Fila 4: Código, Versión, Emisión, Página
    const metaY = cursorY - rowHeight * 4
    page.drawRectangle({
        x: marginX,
        y: metaY,
        width: contentWidth,
        height: rowHeight,
        // color: COLOR_GRIS_CLARO, // Removed background
        borderColor: COLOR_NEGRO,
        borderWidth: 0.5,
    })

    page.drawText('CÓDIGO: SIG-MD-DE-FT-06', {
        x: marginX + 10,
        y: metaY + rowHeight / 2 - 3,
        size: 8,
        font: fontBold,
        color: COLOR_NEGRO,
    })

    const metaTexto = 'VERSIÓN: 01  |  EMISIÓN: 30-01-2023  |  PÁGINA 1 DE 1'
    page.drawText(metaTexto, {
        x: titleX + (titleWidth - fontBold.widthOfTextAtSize(metaTexto, 8)) / 2,
        y: metaY + rowHeight / 2 - 3,
        size: 8,
        font: fontBold,
        color: COLOR_NEGRO,
    })

    cursorY -= headerHeight + 20

    // ========================================
    // CONSECUTIVO
    // ========================================
    const consecutivoTexto = `Consecutivo: ${recobro.consecutivo}`
    page.drawText(consecutivoTexto, {
        x: width - marginX - fontBold.widthOfTextAtSize(consecutivoTexto, 10),
        y: cursorY,
        size: 10,
        font: fontBold,
        color: COLOR_NEGRO,
    })
    cursorY -= 20

    // ========================================
    // FECHA Y CIUDAD
    // ========================================
    page.drawText(`Montería, ${fecha}`, {
        x: marginX,
        y: cursorY,
        size: 10,
        font: fontRegular,
        color: COLOR_NEGRO,
    })
    cursorY -= 25

    // ========================================
    // DESTINATARIO
    // ========================================
    page.drawText('Sres.', { x: marginX, y: cursorY, size: 10, font: fontRegular, color: COLOR_NEGRO })
    cursorY -= 14
    page.drawText('NUEVA EMPRESA PROMOTORA DE SALUD S.A. - NUEVA EPS', { x: marginX, y: cursorY, size: 10, font: fontBold, color: COLOR_NEGRO })
    cursorY -= 14
    page.drawText('La Ciudad', { x: marginX, y: cursorY, size: 10, font: fontRegular, color: COLOR_NEGRO })
    cursorY -= 20

    // ========================================
    // REFERENCIA
    // ========================================
    const refTexto = `Ref.: CARTA DE AUTORIZACIÓN DE RECOBRO POR SERVICIOS DE SALUD, USUARIO ${recobro.pacienteTipoId || 'CC'} ${recobro.pacienteId} ${recobro.pacienteNombres || ''}`

    // Implement text wrapping for Ref
    let refLinea = ''
    const refPalabras = refTexto.split(' ')

    for (const palabra of refPalabras) {
        const prueba = refLinea + (refLinea ? ' ' : '') + palabra
        if (fontBold.widthOfTextAtSize(prueba, 9) > contentWidth) {
            page.drawText(refLinea, {
                x: marginX,
                y: cursorY,
                size: 9,
                font: fontBold,
                color: COLOR_NEGRO
            })
            cursorY -= 12 // Line height
            refLinea = palabra
        } else {
            refLinea = prueba
        }
    }

    // Draw the last line
    if (refLinea) {
        page.drawText(refLinea, {
            x: marginX,
            y: cursorY,
            size: 9,
            font: fontBold,
            color: COLOR_NEGRO
        })
    }
    cursorY -= 20

    // ========================================
    // SALUDO Y PÁRRAFO
    // ========================================
    page.drawText('Cordial saludo,', { x: marginX, y: cursorY, size: 10, font: fontRegular, color: COLOR_NEGRO })
    cursorY -= 18

    const parrafo = 'Mediante la presente, nos permitimos dar visto bueno para realización de los servicios abajo relacionados a través de la Red de la EAPB, con recobro al Pago Global Prospectivo según las tarifas pactadas en el acuerdo de voluntades vigentes (Dec. 441 de 2022, Artículo 2.5.3.4.2.2).'
    const palabras = parrafo.split(' ')
    let linea = ''
    const maxLineWidth = contentWidth

    for (const palabra of palabras) {
        const prueba = linea + (linea ? ' ' : '') + palabra
        if (fontRegular.widthOfTextAtSize(prueba, 10) > maxLineWidth) {
            page.drawText(linea, { x: marginX, y: cursorY, size: 10, font: fontRegular, color: COLOR_NEGRO })
            cursorY -= 14
            linea = palabra
        } else {
            linea = prueba
        }
    }
    if (linea) {
        page.drawText(linea, { x: marginX, y: cursorY, size: 10, font: fontRegular, color: COLOR_NEGRO })
        cursorY -= 20
    }

    // ========================================
    // TABLA DE DATOS DEL CASO
    // ========================================
    const labelWidth = contentWidth * 0.35
    const valueWidth = contentWidth * 0.65

    // Función auxiliar para dibujar filas con altura dinámica
    const drawFlexibleRow = (label: string, value: string) => {
        // Limpiar markdown del valor
        const cleanValue = limpiarMarkdown(value || '')

        // Calcular líneas del valor
        const valueLines: string[] = []
        let currentLine = ''
        const words = cleanValue.split(/\s+/)

        for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word
            if (fontRegular.widthOfTextAtSize(testLine, 9) > valueWidth - 10) {
                valueLines.push(currentLine)
                currentLine = word
            } else {
                currentLine = testLine
            }
        }
        if (currentLine) valueLines.push(currentLine)

        // Calcular altura
        const minHeight = 20
        const textHeight = valueLines.length * 12 + 8
        const realHeight = Math.max(minHeight, textHeight)

        // Dibujar Label
        page.drawRectangle({
            x: marginX,
            y: cursorY - realHeight,
            width: labelWidth,
            height: realHeight,
            color: COLOR_AZUL_CLARO,
            borderColor: COLOR_NEGRO,
            borderWidth: 0.5,
        })

        page.drawText(label, {
            x: marginX + 5,
            y: cursorY - realHeight / 2 - 3,
            size: 9,
            font: fontBold,
            color: COLOR_NEGRO,
        })

        // Dibujar Value
        page.drawRectangle({
            x: marginX + labelWidth,
            y: cursorY - realHeight,
            width: valueWidth,
            height: realHeight,
            borderColor: COLOR_NEGRO,
            borderWidth: 0.5,
        })

        // Dibujar texto del valor (centrado verticalmente si es una línea, o top-aligned si son varias)
        if (valueLines.length === 1) {
            page.drawText(valueLines[0], {
                x: marginX + labelWidth + 5,
                y: cursorY - realHeight / 2 - 3,
                size: 9,
                font: fontRegular,
                color: COLOR_NEGRO,
            })
        } else {
            let textY = cursorY - 12
            for (const line of valueLines) {
                page.drawText(line, {
                    x: marginX + labelWidth + 5,
                    y: textY,
                    size: 9,
                    font: fontRegular,
                    color: COLOR_NEGRO,
                })
                textY -= 12
            }
        }

        cursorY -= realHeight
    }

    // 1. Identificación
    drawFlexibleRow('Identificación Usuario(a)', `${recobro.pacienteTipoId || 'CC'} ${recobro.pacienteId}`)

    // 2. Nombres
    drawFlexibleRow('Nombres y Apellidos Usuario', recobro.pacienteNombres || 'No especificado')

    // 3. Solicitado por
    drawFlexibleRow('Solicitado por', recobro.radicadorNombre || 'No especificado')

    // 4. Justificación
    drawFlexibleRow('Justificación', recobro.justificacion || 'Sin justificación')

    // 5. Respuesta Auditoría
    drawFlexibleRow('Respuesta de auditoría', recobro.respuestaAuditor || 'Sin observaciones')

    cursorY -= 15

    // ========================================
    // SERVICIOS AUTORIZADOS (Todos los CUPS)
    // ========================================
    page.drawText('Servicios Autorizados:', { x: marginX, y: cursorY, size: 9, font: fontBold, color: COLOR_NEGRO })
    cursorY -= 15

    const col1Width = contentWidth * 0.15
    const col2Width = contentWidth * 0.70
    const col3Width = contentWidth * 0.15

    // Encabezados
    dibujarCelda(page, marginX, cursorY, col1Width, 18, 'Código', fontBold, 8, { bgColor: COLOR_AZUL_GESTAR, textColor: rgb(1, 1, 1), align: 'center' })
    dibujarCelda(page, marginX + col1Width, cursorY, col2Width, 18, 'Descripción', fontBold, 8, { bgColor: COLOR_AZUL_GESTAR, textColor: rgb(1, 1, 1), align: 'center' })
    dibujarCelda(page, marginX + col1Width + col2Width, cursorY, col3Width, 18, 'Cantidad', fontBold, 8, { bgColor: COLOR_AZUL_GESTAR, textColor: rgb(1, 1, 1), align: 'center' })
    cursorY -= 18

    // Filas de CUPS (Dinámicas para descripción)
    for (const cups of recobro.cupsData) {
        // Calcular altura basada en la descripción
        const descLines: string[] = []
        let currentDesc = ''
        const cleanDesc = limpiarMarkdown(cups.descripcion)
        const descWords = cleanDesc.split(/\s+/)

        for (const word of descWords) {
            const testLine = currentDesc + (currentDesc ? ' ' : '') + word
            if (fontRegular.widthOfTextAtSize(testLine, 8) > col2Width - 10) {
                descLines.push(currentDesc)
                currentDesc = word
            } else {
                currentDesc = testLine
            }
        }
        if (currentDesc) descLines.push(currentDesc)

        const rowHeight = Math.max(16, descLines.length * 10 + 6)

        // Dibujar Código
        dibujarCelda(page, marginX, cursorY, col1Width, rowHeight, cups.cups, fontRegular, 8, { align: 'center' })

        // Dibujar Descripción (Manual para soporte multilínea)
        page.drawRectangle({
            x: marginX + col1Width,
            y: cursorY - rowHeight,
            width: col2Width,
            height: rowHeight,
            borderColor: COLOR_NEGRO,
            borderWidth: 0.5,
        })
        let descY = cursorY - 10
        for (const line of descLines) {
            page.drawText(line, {
                x: marginX + col1Width + 5,
                y: descY,
                size: 8,
                font: fontRegular,
                color: COLOR_NEGRO,
            })
            descY -= 10
        }

        // Dibujar Cantidad
        dibujarCelda(page, marginX + col1Width + col2Width, cursorY, col3Width, rowHeight, String(cups.cantidad), fontRegular, 8, { align: 'center' })

        cursorY -= rowHeight
    }
    cursorY -= 10

    // ========================================
    // DESPEDIDA
    // ========================================
    cursorY -= 5
    page.drawText('Cordialmente,', { x: marginX, y: cursorY, size: 10, font: fontRegular, color: COLOR_NEGRO })
    cursorY -= 25

    // ========================================
    // FIRMA ELECTRÓNICA
    // ========================================
    const firmaWidth = 250
    const firmaHeight = 90
    const firmaX = marginX

    // Borde punteado (simulado con rectángulo)
    page.drawRectangle({
        x: firmaX,
        y: cursorY - firmaHeight,
        width: firmaWidth,
        height: firmaHeight,
        borderColor: COLOR_AZUL_GESTAR,
        borderWidth: 1.5,
        color: COLOR_AZUL_CLARO,
    })

    let firmaY = cursorY - 15
    const firmaTexto1 = '[X] APROBADO ELECTRONICAMENTE'
    page.drawText(firmaTexto1, {
        x: firmaX + (firmaWidth - fontBold.widthOfTextAtSize(firmaTexto1, 10)) / 2,
        y: firmaY,
        size: 10,
        font: fontBold,
        color: COLOR_AZUL_GESTAR,
    })

    firmaY -= 16
    const firmaNombre = nombreAprobador.toUpperCase()
    page.drawText(firmaNombre, {
        x: firmaX + (firmaWidth - fontBold.widthOfTextAtSize(firmaNombre, 10)) / 2,
        y: firmaY,
        size: 10,
        font: fontBold,
        color: COLOR_NEGRO,
    })

    firmaY -= 12
    const firmaCargo = 'Coordinacion Asistencial'
    page.drawText(firmaCargo, {
        x: firmaX + (firmaWidth - fontRegular.widthOfTextAtSize(firmaCargo, 9)) / 2,
        y: firmaY,
        size: 9,
        font: fontRegular,
        color: COLOR_GRIS,
    })

    firmaY -= 12
    const firmaEmpresa = 'Gestar Salud de Colombia IPS'
    page.drawText(firmaEmpresa, {
        x: firmaX + (firmaWidth - fontRegular.widthOfTextAtSize(firmaEmpresa, 9)) / 2,
        y: firmaY,
        size: 9,
        font: fontRegular,
        color: COLOR_GRIS,
    })

    // Línea separadora
    firmaY -= 8
    page.drawLine({
        start: { x: firmaX + 10, y: firmaY },
        end: { x: firmaX + firmaWidth - 10, y: firmaY },
        thickness: 0.5,
        color: COLOR_AZUL_GESTAR,
    })

    firmaY -= 10
    page.drawText(`Fecha/Hora: ${timestamp}`, { x: firmaX + 10, y: firmaY, size: 7, font: fontRegular, color: COLOR_GRIS })
    firmaY -= 10
    page.drawText(`Código verificación: ${codigoVerificacion}`, { x: firmaX + 10, y: firmaY, size: 7, font: fontBold, color: COLOR_AZUL_GESTAR })

    cursorY -= firmaHeight + 15


    // ========================================
    // GENERAR BLOB
    // ========================================
    const pdfBytes = await pdfDoc.save()
    const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' })

    const fechaStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const filename = `CARTA_AUTORIZACION_${recobro.consecutivo}_${fechaStr}.pdf`

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

/**
 * Genera y descarga el PDF en un solo paso
 */
export async function generarYDescargarPdfAprobacion(
    recobro: Recobro,
    aprobadoPor?: string
): Promise<void> {
    const { blob, filename } = await generarPdfAprobacion(recobro, aprobadoPor)
    descargarPdfAprobacion(blob, filename)
}

export default { generarPdfAprobacion, descargarPdfAprobacion, generarYDescargarPdfAprobacion }
