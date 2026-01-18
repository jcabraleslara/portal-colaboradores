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

    // Altura total de la página (aprox 841pt para A4, o 792pt para Letter)
    // La plantilla parece ser tamaño oficio o carta larga.
    const { height } = page.getSize()
    const fontSize = 9 // Reducir un poco para encajar mejor
    const color = rgb(0.1, 0.1, 0.1)

    // Función helper para dibujar texto
    // yOffset permite dibujar en la segunda copia (parte inferior)
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
    // La segunda copia empieza aprox a mitad de página.
    // En la imagen HTML, "RECETARIO..." superior está en top~6.5em, e inferior en top~24.6em. Diferencia ~18em.
    // Estimación en puntos PDF: ~250-260 pt diferencia. Ajustaremos a 425pt aprox (mitad de hoja oficio/carta alargada).
    const COPIA_Y_OFFSET = 422

    // === INSERTAR DATOS (Iteramos 2 veces: Original y Copia) ===
    const offsets = [0, COPIA_Y_OFFSET]

    offsets.forEach(offset => {
        // -- ENCABEZADO --
        // Número (Nº) - Ajustado: más arriba y derecha
        draw(`${data.numero_recetario}`, 480, 78, offset, 11, fontBold)

        // Fecha - Ajustado: alineado con "Fecha Día Mes Año"
        // Usar split para evitar problemas de zona horaria
        const [anio, mes, dia] = data.fecha_prescripcion.split('-')
        draw(dia, 300, 92, offset)
        draw(mes, 370, 92, offset)
        draw(anio, 450, 92, offset)

        // -- 1. PACIENTE --
        const fila1 = 106 // Prima Apellido, Segundo, Nombres
        draw(data.paciente_apellido1, 110, fila1, offset)
        draw(data.paciente_apellido2 || '', 270, fila1, offset)
        draw(data.paciente_nombres, 410, fila1, offset)

        // Checks TI/CC/Otro
        if (data.paciente_tipo_id === 'CC') draw('X', 80, 133, offset, 10) // Ajuste fino check
        else if (data.paciente_tipo_id === 'TI') draw('X', 45, 133, offset, 10)
        else draw('X', 125, 133, offset, 10) // Otro

        draw(data.paciente_documento, 170, 137, offset, 10) // Número documento
        draw(data.paciente_edad?.toString() || '', 360, 137, offset) // Edad

        // Genero
        if (data.paciente_genero === 'F') draw('X', 428, 133, offset, 8)
        else if (data.paciente_genero === 'M') draw('X', 463, 133, offset, 8)

        draw(data.paciente_telefono || '', 90, 169, offset) // Bajado un poco
        draw(data.paciente_municipio || '', 180, 169, offset)
        draw(data.paciente_direccion || '', 290, 169, offset) // Dirección Residencia
        draw(data.paciente_departamento || 'CORDOBA', 460, 169, offset)

        // Checks
        if (data.paciente_regimen === 'Subsidiado') draw('X', 135, 203, offset, 10)
        else if (data.paciente_regimen === 'Contributivo') draw('X', 225, 203, offset, 10)
        else if (data.paciente_regimen === 'Vinculado') draw('X', 320, 203, offset, 10)

        draw(data.paciente_eps || '', 380, 203, offset, 8) // EPS

        // -- 2. MEDICAMENTOS --
        // Ajustado para caer dentro de la tabla
        const filaMed = 242
        let nombreMed = data.medicamento_nombre as string // Cast para permitir manipulación
        if (nombreMed.length > 25) nombreMed = nombreMed.substring(0, 25) // Truncar si es muy largo

        draw(nombreMed, 40, filaMed, offset, 8)
        draw(data.medicamento_concentracion || '', 230, filaMed, offset, 8)
        draw(data.medicamento_forma_farmaceutica, 305, filaMed + 5, offset, 7) // +5 para centrar verticalmente si es largo
        draw(data.medicamento_dosis_via || '', 380, filaMed, offset, 7)
        draw(data.cantidad_numero.toString(), 460, filaMed, offset)
        draw(data.cantidad_letras, 485, filaMed, offset, 6) // Letra pequeña para que quepa

        const filaDiag = 295 // Diagnóstico
        const diagTexto = `${data.diagnostico_cie10 || ''} - ${data.diagnostico_descripcion || ''}`
        draw(diagTexto.substring(0, 90), 80, 295, offset, 8) // Diagnóstico texto

        // -- 3. PROFESIONAL --
        // Tipo Médico (Checks) - Asumiendo posiciones
        if (data.medico_tipo === 'General') draw('X', 100, 325, offset, 10)
        else draw('X', 190, 325, offset, 10) // Especializado

        if (data.medico_especialidad) {
            draw(data.medico_especialidad, 360, 325, offset, 9)
        }

        const filaProf2 = 340 // Apellidos Nombres Médico
        draw(data.medico_nombres, 180, 340, offset, 9) // Nombre completo centrado

        const filaProf3 = 368 // Doc, Res, Firma
        draw(data.medico_documento, 60, 368, offset, 9) // Documento
        draw(data.medico_documento, 260, 368, offset, 9) // Resolución (misma)
        // Firma: Dejamos espacio en blanco o ponemos nombre como firma digital simple
        // draw(data.medico_nombres, 400, 360, offset, 6) 

        draw('GESTAR SALUD DE COLOMBIA IPS', 60, 385, offset, 8) // Institución subida un poco
        draw(data.medico_direccion || 'CRA 6 n 65 24', 260, 385, offset, 8)
        draw(data.medico_ciudad || 'MONTERIA', 390, 385, offset, 8)
        draw(data.medico_telefono || '3103157229', 460, 385, offset, 8)
    })

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
