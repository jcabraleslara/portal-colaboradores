/**
 * Generador de PDF para Anexo 8 usando HTML2PDF
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Estrategia: HTML → PDF usando html2pdf.js para máxima fidelidad visual
 * Tamaño: Carta (8.5" x 11" = 612pt x 792pt)
 */

import html2pdf from 'html2pdf.js'
import { Anexo8Record } from '@/types/anexo8.types'

interface PdfGeneratorResult {
    blob: Blob
    filename: string
}

/**
 * Genera el HTML completo del Anexo 8 con estilos embebidos
 * Optimizado para caber en una sola hoja tamaño Carta
 */
function generarHtmlAnexo8(data: Anexo8Record): string {
    const [anio, mes, dia] = data.fecha_prescripcion.split('-')

    // Separar nombres del médico
    const medicoNombresArr = data.medico_nombres.split(' ')
    const medicoApellido1 = medicoNombresArr[0] || ''
    const medicoApellido2 = medicoNombresArr[1] || ''
    const medicoNombres = medicoNombresArr.slice(2).join(' ') || medicoNombresArr.slice(1).join(' ')

    // Función para renderizar checkbox
    const checkbox = (checked: boolean) => checked ? 'X' : ''

    // Estilos CSS optimizados para tamaño Carta
    const styles = `
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; font-size: 7.5px; }
            .container { width: 580px; background: #fff; margin: 0 auto; }
            .seccion { width: 100%; border: 1.5px solid #000; margin-bottom: 6px; background: #fff; }
            
            /* Header */
            .header { display: flex; border-bottom: 1px solid #000; }
            .escudo { width: 65px; padding: 4px; border-right: 1px solid #000; text-align: center; }
            .escudo img { width: 50px; height: auto; }
            .titulo-container { flex: 1; text-align: center; padding: 4px 2px; }
            .titulo-1 { font-size: 8.5px; font-weight: bold; margin-bottom: 1px; }
            .titulo-2, .titulo-3 { font-size: 7.5px; font-weight: bold; margin-bottom: 1px; }
            .anexo-num { font-size: 11px; font-weight: bold; margin-top: 2px; }
            
            /* Recetario row */
            .recetario-row { display: flex; border-bottom: 1px solid #000; background: #e0e0e0; }
            .recetario-titulo { flex: 1; font-size: 7.5px; font-weight: bold; padding: 2px 6px; text-align: center; }
            .numero-rec { width: 85px; font-size: 7.5px; font-weight: bold; padding: 2px 4px; text-align: center; border-left: 1px solid #000; }
            .numero-val { font-size: 9px; color: #c00; }
            
            /* Paciente header */
            .paciente-header { display: flex; border-bottom: 1px solid #000; background: #d0d0d0; }
            .seccion-titulo { padding: 2px 6px; font-size: 7.5px; font-weight: bold; }
            .fecha-container { display: flex; margin-left: auto; border-left: 1px solid #000; }
            .fecha-item { display: flex; flex-direction: column; align-items: center; padding: 1px 6px; border-left: 1px solid #000; min-width: 38px; }
            .fecha-item:first-child { border-left: none; }
            .fecha-label { font-size: 6.5px; font-weight: bold; }
            .fecha-value { font-size: 8px; font-weight: bold; }
            
            /* Rows and cells */
            .row { display: flex; border-bottom: 1px solid #000; }
            .cell { padding: 2px 4px; border-left: 1px solid #000; display: flex; flex-direction: column; }
            .cell:first-child { border-left: none; }
            .cell-label { font-size: 6px; font-weight: bold; color: #333; }
            .cell-value { font-size: 7.5px; min-height: 10px; text-transform: uppercase; }
            
            /* Document row */
            .doc-row { display: flex; border-bottom: 1px solid #000; }
            .doc-label { padding: 2px 4px; font-size: 6.5px; font-weight: bold; width: 115px; }
            .doc-tipos { display: flex; align-items: center; padding: 2px 4px; border-left: 1px solid #000; }
            .doc-tipo { display: flex; align-items: center; margin-right: 8px; font-size: 6.5px; }
            .checkbox { width: 10px; height: 10px; border: 1px solid #000; margin-right: 2px; text-align: center; font-weight: bold; line-height: 10px; font-size: 8px; }
            .doc-numero { flex: 1; padding: 2px 4px; border-left: 1px solid #000; }
            .edad { width: 50px; padding: 2px 4px; border-left: 1px solid #000; }
            .genero { width: 70px; padding: 2px 4px; border-left: 1px solid #000; display: flex; align-items: center; gap: 4px; }
            .genero-item { display: flex; align-items: center; font-size: 6.5px; }
            
            /* Afiliación */
            .afil-row { display: flex; border-bottom: 1px solid #000; font-size: 6.5px; }
            .afil-label { padding: 2px 4px; font-weight: bold; }
            .afil-opciones { display: flex; align-items: center; gap: 10px; padding: 2px 4px; }
            .afil-item { display: flex; align-items: center; }
            .eps-container { display: flex; align-items: center; margin-left: auto; padding: 2px 4px; border-left: 1px solid #000; }
            .eps-label { font-weight: bold; margin-right: 4px; }
            
            /* Medicamentos */
            .med-header { background: #d0d0d0; border-bottom: 1px solid #000; padding: 2px 6px; font-size: 7.5px; font-weight: bold; }
            .med-labels { display: flex; border-bottom: 1px solid #000; font-size: 6px; font-weight: bold; text-align: center; }
            .med-cell { padding: 2px 3px; border-left: 1px solid #000; display: flex; flex-direction: column; align-items: center; justify-content: center; }
            .med-cell:first-child { border-left: none; }
            .med-nombre { width: 130px; }
            .med-conc { width: 75px; }
            .med-forma { width: 70px; }
            .med-dosis { width: 90px; }
            .med-cant { flex: 1; }
            .med-cant-sub { display: flex; font-size: 5px; margin-top: 1px; width: 100%; }
            .med-cant-num { width: 50%; text-align: center; }
            .med-cant-let { width: 50%; text-align: center; }
            .med-data { display: flex; border-bottom: 1px solid #000; min-height: 22px; }
            .med-data-cell { padding: 2px 3px; border-left: 1px solid #000; display: flex; align-items: center; justify-content: center; font-size: 7px; text-transform: uppercase; text-align: center; word-break: break-word; }
            .med-data-cell:first-child { border-left: none; }
            
            /* Diagnóstico */
            .diag-row { display: flex; border-bottom: 1px solid #000; }
            .diag-label { padding: 2px 6px; font-size: 6.5px; font-weight: bold; width: 65px; }
            .diag-value { flex: 1; padding: 2px 6px; font-size: 7px; text-transform: uppercase; border-left: 1px solid #000; }
            
            /* Profesional */
            .prof-header { background: #d0d0d0; border-bottom: 1px solid #000; padding: 2px 6px; font-size: 7.5px; font-weight: bold; }
            .med-tipo-row { display: flex; border-bottom: 1px solid #000; font-size: 6.5px; }
            .med-tipo-label { padding: 2px 6px; font-weight: bold; }
            .med-tipos { display: flex; align-items: center; gap: 12px; padding: 2px 6px; }
            .med-tipo-item { display: flex; align-items: center; }
            .espec-container { display: flex; align-items: center; margin-left: auto; padding: 2px 6px; border-left: 1px solid #000; }
            .espec-label { font-weight: bold; margin-right: 4px; }
            .espec-value { font-size: 6.5px; text-transform: uppercase; }
            
            /* Cell widths */
            .w-primer-ap { width: 120px; }
            .w-segundo-ap { width: 120px; }
            .w-nombres { flex: 1; }
            .w-tel { width: 75px; }
            .w-mun { width: 85px; }
            .w-dir { flex: 1; }
            .w-depto { width: 75px; }
            .w-tipodoc { width: 30px; }
            .w-doc { width: 100px; }
            .w-res { width: 130px; }
            .w-firma { flex: 1; min-height: 30px; }
            .w-inst { width: 155px; }
            .w-dir-inst { width: 130px; }
            .w-ciudad { width: 75px; }
            
            /* Separador */
            .separador { height: 8px; border-bottom: 1px dashed #999; margin-bottom: 6px; }
            
            /* Copia label */
            .copia-label { text-align: center; font-size: 6px; color: #666; padding: 1px; background: #f5f5f5; }
        </style>
    `

    // Ruta del escudo oficial (desde public/templates)
    const escudoUrl = '/templates/escudo_colombia.jpg'

    // Función para generar una sección (Original o Copia)
    const generarSeccion = (esCopia: boolean) => `
        <div class="seccion">
            <!-- Header -->
            <div class="header">
                <div class="escudo">
                    <img src="${escudoUrl}" alt="Escudo" crossorigin="anonymous">
                </div>
                <div class="titulo-container">
                    <div class="titulo-1">República de Colombia</div>
                    <div class="titulo-2">U.A.E. Fondo Nacional de Estupefacientes</div>
                    <div class="titulo-3">Ministerio de la Protección Social</div>
                    <div class="anexo-num">ANEXO No. 8</div>
                </div>
            </div>

            <!-- Recetario -->
            <div class="recetario-row">
                <div class="recetario-titulo">RECETARIO OFICIAL PARA MEDICAMENTOS DE CONTROL ESPECIAL</div>
                <div class="numero-rec">Nº <span class="numero-val">${data.numero_recetario}</span></div>
            </div>

            <!-- 1. Paciente + Fecha -->
            <div class="paciente-header">
                <span class="seccion-titulo">1. PACIENTE</span>
                <div class="fecha-container">
                    <div class="fecha-item"><span class="fecha-label">Fecha</span></div>
                    <div class="fecha-item"><span class="fecha-label">Día</span><span class="fecha-value">${dia}</span></div>
                    <div class="fecha-item"><span class="fecha-label">Mes</span><span class="fecha-value">${mes}</span></div>
                    <div class="fecha-item" style="border-left: 1px solid #000;"><span class="fecha-label">Año</span><span class="fecha-value">${anio}</span></div>
                </div>
            </div>

            <!-- Nombres -->
            <div class="row">
                <div class="cell w-primer-ap"><span class="cell-label">Primer Apellido</span><span class="cell-value">${data.paciente_apellido1}</span></div>
                <div class="cell w-segundo-ap"><span class="cell-label">Segundo Apellido</span><span class="cell-value">${data.paciente_apellido2 || ''}</span></div>
                <div class="cell w-nombres"><span class="cell-label">Nombres</span><span class="cell-value">${data.paciente_nombres}</span></div>
            </div>

            <!-- Documento -->
            <div class="doc-row">
                <div class="doc-label">Documento de Identificación</div>
                <div class="doc-tipos">
                    <div class="doc-tipo"><div class="checkbox">${checkbox(data.paciente_tipo_id === 'TI')}</div><span>TI</span></div>
                    <div class="doc-tipo"><div class="checkbox">${checkbox(data.paciente_tipo_id === 'CC')}</div><span>CC</span></div>
                    <div class="doc-tipo"><div class="checkbox">${checkbox(!['TI', 'CC'].includes(data.paciente_tipo_id))}</div><span>Otro:</span></div>
                </div>
                <div class="doc-numero"><span class="cell-label">Número</span><span class="cell-value">${data.paciente_documento}</span></div>
                <div class="edad"><span class="cell-label">Edad</span><span class="cell-value">${data.paciente_edad || ''}</span></div>
                <div class="genero">
                    <span class="cell-label">Género</span>
                    <div class="genero-item"><div class="checkbox">${checkbox(data.paciente_genero === 'F')}</div><span>F</span></div>
                    <div class="genero-item"><div class="checkbox">${checkbox(data.paciente_genero === 'M')}</div><span>M</span></div>
                </div>
            </div>

            <!-- Teléfono, Municipio, Dirección -->
            <div class="row">
                <div class="cell w-tel"><span class="cell-label">Teléfono</span><span class="cell-value">${data.paciente_telefono || ''}</span></div>
                <div class="cell w-mun"><span class="cell-label">Municipio</span><span class="cell-value">${data.paciente_municipio || ''}</span></div>
                <div class="cell w-dir"><span class="cell-label">Dirección de Residencia</span><span class="cell-value">${data.paciente_direccion || ''}</span></div>
                <div class="cell w-depto"><span class="cell-label">Departamento</span><span class="cell-value">${data.paciente_departamento || 'CÓRDOBA'}</span></div>
            </div>

            <!-- Afiliación -->
            <div class="afil-row">
                <div class="afil-label">Afiliación al SGSSS</div>
                <div class="afil-opciones">
                    <div class="afil-item"><div class="checkbox">${checkbox(data.paciente_regimen === 'Subsidiado')}</div><span>Subsidiado</span></div>
                    <div class="afil-item"><div class="checkbox">${checkbox(data.paciente_regimen === 'Contributivo')}</div><span>Contributivo</span></div>
                    <div class="afil-item"><div class="checkbox">${checkbox(data.paciente_regimen === 'Vinculado')}</div><span>Vinculado</span></div>
                </div>
                <div class="eps-container"><span class="eps-label">EPS</span><span>${data.paciente_eps || ''}</span></div>
            </div>

            <!-- 2. Medicamentos -->
            <div class="med-header">2. MEDICAMENTOS</div>
            <div class="med-labels">
                <div class="med-cell med-nombre">Nombre Genérico</div>
                <div class="med-cell med-conc">Concentración</div>
                <div class="med-cell med-forma"><span>Forma</span><span>farmacéutica</span></div>
                <div class="med-cell med-dosis"><span>Dosis / Vía de</span><span>Administración</span></div>
                <div class="med-cell med-cant">
                    <span>Cantidad Prescrita</span>
                    <div class="med-cant-sub"><span class="med-cant-num">En Números</span><span class="med-cant-let">Letras</span></div>
                </div>
            </div>
            <div class="med-data">
                <div class="med-data-cell med-nombre">${data.medicamento_nombre}</div>
                <div class="med-data-cell med-conc">${data.medicamento_concentracion || ''}</div>
                <div class="med-data-cell med-forma">${data.medicamento_forma_farmaceutica}</div>
                <div class="med-data-cell med-dosis">${data.medicamento_dosis_via || ''}</div>
                <div class="med-data-cell med-cant"><strong>${data.cantidad_numero}</strong>&nbsp;&nbsp;${data.cantidad_letras}</div>
            </div>

            <!-- Diagnóstico -->
            <div class="diag-row">
                <div class="diag-label">Diagnóstico</div>
                <div class="diag-value">${data.diagnostico_cie10 ? `${data.diagnostico_cie10} - ` : ''}${data.diagnostico_descripcion || ''}</div>
            </div>

            <!-- 3. Profesional -->
            <div class="prof-header">3. PROFESIONAL</div>
            <div class="med-tipo-row">
                <div class="med-tipo-label">Médico</div>
                <div class="med-tipos">
                    <div class="med-tipo-item"><div class="checkbox">${checkbox(data.medico_tipo === 'General')}</div><span>General</span></div>
                    <div class="med-tipo-item"><div class="checkbox">${checkbox(data.medico_tipo === 'Especializado')}</div><span>Especializado</span></div>
                </div>
                <div class="espec-container"><span class="espec-label">Especialidad, cuál:</span><span class="espec-value">${data.medico_especialidad || ''}</span></div>
            </div>

            <!-- Nombres médico -->
            <div class="row">
                <div class="cell w-primer-ap"><span class="cell-label">Primer Apellido</span><span class="cell-value">${medicoApellido1}</span></div>
                <div class="cell w-segundo-ap"><span class="cell-label">Segundo Apellido</span><span class="cell-value">${medicoApellido2}</span></div>
                <div class="cell w-nombres"><span class="cell-label">Nombres</span><span class="cell-value">${medicoNombres}</span></div>
            </div>

            <!-- Doc y Resolución -->
            <div class="row">
                <div class="cell w-tipodoc"><span class="cell-label">CC</span></div>
                <div class="cell w-doc"><span class="cell-label">Documento de Identidad</span><span class="cell-value">${data.medico_documento}</span></div>
                <div class="cell w-res"><span class="cell-label">Resolución profesión N.º</span><span class="cell-value">${data.medico_documento}</span></div>
                <div class="cell w-firma"><span class="cell-label">Firma</span></div>
            </div>

            <!-- Institución -->
            <div class="row" style="border-bottom: none;">
                <div class="cell w-inst"><span class="cell-label">Institución donde labora</span><span class="cell-value">GESTAR SALUD DE COLOMBIA IPS</span></div>
                <div class="cell w-dir-inst"><span class="cell-label">Dirección</span><span class="cell-value">${data.medico_direccion || 'CRA 6 N 65 24'}</span></div>
                <div class="cell w-ciudad"><span class="cell-label">Ciudad</span><span class="cell-value">${data.medico_ciudad || 'MONTERÍA'}</span></div>
                <div class="cell" style="flex:1;"><span class="cell-label">Teléfono</span><span class="cell-value">${data.medico_telefono || '3103157229'}</span></div>
            </div>

            ${esCopia ? '<div class="copia-label">COPIA</div>' : ''}
        </div>
    `

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            ${styles}
        </head>
        <body>
            <div class="container">
                ${generarSeccion(false)}
                <div class="separador"></div>
                ${generarSeccion(true)}
            </div>
        </body>
        </html>
    `
}

/**
 * Genera un PDF del Anexo 8 utilizando html2pdf.js
 * Configurado para tamaño Carta (8.5" x 11")
 */
export async function generarAnexo8Pdf(data: Anexo8Record): Promise<PdfGeneratorResult> {
    // 1. Generar HTML
    const html = generarHtmlAnexo8(data)

    // 2. Crear elemento temporal en el DOM
    const container = document.createElement('div')
    container.innerHTML = html
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '0'
    document.body.appendChild(container)

    // 3. Configurar opciones de html2pdf para tamaño Carta exacto
    const opt = {
        margin: [8, 8, 8, 8] as [number, number, number, number],
        filename: `anexo8_${data.numero_recetario}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
            scale: 2.5, // Alta resolución
            useCORS: true,
            logging: false,
            letterRendering: true
        },
        jsPDF: {
            unit: 'mm',
            format: 'letter', // Tamaño carta exacto
            orientation: 'portrait' as const
        }
    }

    try {
        // 4. Obtener contenedor y validar
        const pdfContainer = container.querySelector('.container') as HTMLElement
        if (!pdfContainer) throw new Error('No se encontró el contenedor del PDF')

        // 5. Generar PDF como Blob
        const blob = await html2pdf()
            .set(opt)
            .from(pdfContainer)
            .outputPdf('blob')

        // 5. Limpiar el DOM
        document.body.removeChild(container)

        // 6. Generar nombre del archivo
        const fechaStr = data.fecha_prescripcion.replace(/-/g, '')
        const timestamp = Date.now().toString().slice(-6)
        const pacienteNombre = (data.paciente_nombres.split(' ')[0] + (data.paciente_apellido1 || '')).replace(/[^a-zA-Z0-9]/g, '')
        const filename = `ANEXO8_${data.paciente_documento}_${pacienteNombre}_${fechaStr}_${timestamp}.pdf`

        return { blob, filename }
    } catch (error) {
        // Limpiar en caso de error
        if (document.body.contains(container)) {
            document.body.removeChild(container)
        }
        throw error
    }
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
