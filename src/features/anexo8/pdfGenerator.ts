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

    // 2. Obtener el formulario
    const form = pdfDoc.getForm()

    // 3. Extraer fecha
    const [anio, mes, dia] = data.fecha_prescripcion.split('-')

    // 4. Separar nombres del médico (formato: APELLIDO1 APELLIDO2 NOMBRES)
    const medicoPartes = data.medico_nombres.trim().split(' ')
    const medicoApellido1 = medicoPartes[0] || ''
    const medicoApellido2 = medicoPartes[1] || ''
    const medicoNombres = medicoPartes.slice(2).join(' ') || ''

    // 5. Función helper para llenar campos de texto de forma segura
    const setText = (fieldName: string, value: string | number | null | undefined) => {
        try {
            const field = form.getTextField(fieldName)
            field.setText(String(value ?? '').toUpperCase())
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

    // Medicamento
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
    setText('medico_firma', '') // Espacio para firma física

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
