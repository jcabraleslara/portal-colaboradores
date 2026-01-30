/**
 * Generador de PDF de Carta de Autorización para Recobros
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * Genera un documento PDF institucional usando HTML → html2pdf.js
 * Respeta el formato SIG-MD-DE-FT-06 del Sistema Integrado de Gestión
 */

import html2pdf from 'html2pdf.js'
import { Recobro } from '@/types/recobros.types'

interface PdfAprobacionResult {
    blob: Blob
    filename: string
}

interface GenerarPdfOptions {
    recobro: Recobro
    aprobadoPor: string // Nombre del usuario que aprueba
}

/**
 * Genera un hash simple para la firma electrónica
 * No es criptográficamente seguro, pero sirve para identificación visual
 */
function generarHashVerificacion(data: string): string {
    let hash = 0
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }
    // Convertir a hexadecimal y tomar 8 caracteres
    const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')
    return hexHash.slice(0, 8)
}

/**
 * Formatea fecha en español (ej: "30 de enero de 2026")
 */
function formatearFecha(fecha: Date): string {
    return fecha.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

/**
 * Formatea timestamp en formato ISO legible
 */
function formatearTimestamp(): string {
    const ahora = new Date()
    return ahora.toLocaleString('es-CO', {
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
 * Genera el HTML de la carta de autorización
 */
function generarHtmlCarta(options: GenerarPdfOptions): string {
    const { recobro, aprobadoPor } = options
    const fecha = formatearFecha(new Date())
    const timestamp = formatearTimestamp()

    // Separar CUPS principal y relacionados
    const cupsPrincipal = recobro.cupsData.find(c => c.es_principal) || recobro.cupsData[0]
    const cupsRelacionados = recobro.cupsData.filter(c => !c.es_principal)

    // Generar código de verificación único
    const datosParaHash = `${recobro.consecutivo}-${recobro.pacienteId}-${timestamp}`
    const codigoVerificacion = `GS-${generarHashVerificacion(datosParaHash)}`

    // Generar filas de CUPS relacionados
    const filasRelacionados = cupsRelacionados.length > 0
        ? cupsRelacionados.map(c =>
            `<tr>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${c.cups}</td>
                <td style="border: 1px solid #000; padding: 4px;">${c.descripcion}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${c.cantidad}</td>
            </tr>`
        ).join('')
        : `<tr><td colspan="3" style="border: 1px solid #000; padding: 4px; text-align: center; color: #666;">N/A</td></tr>`

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page {
            size: letter;
            margin: 15mm 15mm 20mm 15mm;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #000;
        }
        .page-container {
            width: 100%;
            max-width: 190mm;
        }

        /* Encabezado institucional */
        .header-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #1d7340;
            margin-bottom: 20px;
        }
        .header-table td {
            border: 1px solid #1d7340;
            vertical-align: middle;
        }
        .logo-cell {
            width: 25%;
            padding: 5px;
            text-align: center;
        }
        .logo-cell img {
            max-height: 50px;
            max-width: 100%;
        }
        .title-cell {
            width: 75%;
            text-align: center;
        }
        .title-row-1 {
            background-color: #e8f5e9;
            font-weight: bold;
            font-size: 11pt;
            padding: 5px;
        }
        .title-row-2 {
            font-size: 10pt;
            padding: 4px;
        }
        .title-row-3 {
            font-weight: bold;
            font-size: 10pt;
            padding: 4px;
            background-color: #f5f5f5;
        }
        .meta-row td {
            font-size: 9pt;
            padding: 4px;
            text-align: center;
            font-weight: bold;
            background-color: #f9f9f9;
        }

        /* Contenido */
        .consecutivo {
            text-align: right;
            font-size: 10pt;
            margin-bottom: 10px;
        }
        .fecha-ciudad {
            margin-bottom: 15px;
        }
        .destinatario {
            margin-bottom: 15px;
        }
        .referencia {
            margin-bottom: 15px;
            font-weight: bold;
        }
        .saludo {
            margin-bottom: 10px;
        }
        .parrafo {
            text-align: justify;
            margin-bottom: 15px;
        }

        /* Tabla de datos */
        .datos-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        .datos-table td {
            border: 1px solid #000;
            padding: 6px 8px;
            font-size: 10pt;
        }
        .datos-table .label {
            background-color: #e8f5e9;
            font-weight: bold;
            width: 35%;
        }

        /* Tabla CUPS relacionados */
        .cups-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 9pt;
        }
        .cups-table th {
            border: 1px solid #000;
            padding: 5px;
            background-color: #1d7340;
            color: white;
            font-weight: bold;
            text-align: center;
        }
        .cups-table td {
            border: 1px solid #000;
            padding: 4px;
        }

        /* Firma electrónica */
        .firma-container {
            margin-top: 25px;
            margin-bottom: 20px;
        }
        .firma-electronica {
            border: 2px dashed #1d7340;
            padding: 12px;
            background-color: #f0fff4;
            display: inline-block;
            min-width: 280px;
        }
        .firma-titulo {
            font-weight: bold;
            color: #1d7340;
            font-size: 10pt;
            margin-bottom: 5px;
            text-align: center;
        }
        .firma-nombre {
            font-weight: bold;
            font-size: 11pt;
            text-align: center;
            margin-bottom: 3px;
        }
        .firma-cargo {
            font-size: 9pt;
            text-align: center;
            color: #333;
        }
        .firma-empresa {
            font-size: 9pt;
            text-align: center;
            color: #333;
            margin-bottom: 8px;
        }
        .firma-meta {
            border-top: 1px solid #1d7340;
            padding-top: 8px;
            font-size: 8pt;
            color: #555;
        }
        .firma-meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
        }
        .verificacion-code {
            font-family: 'Courier New', monospace;
            font-weight: bold;
            color: #1d7340;
            font-size: 9pt;
        }

        /* Pie de página */
        .footer {
            margin-top: 20px;
            border-top: 1px solid #ccc;
            padding-top: 10px;
            font-size: 9pt;
        }
        .footer-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
        }
        .footer-label {
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="page-container">
        <!-- ENCABEZADO INSTITUCIONAL -->
        <table class="header-table">
            <tr>
                <td class="logo-cell" rowspan="3">
                    <img src="/logo_gestar.png" alt="Gestar Salud" />
                </td>
                <td class="title-cell title-row-1">SISTEMA INTEGRADO DE GESTIÓN</td>
            </tr>
            <tr>
                <td class="title-cell title-row-2">GESTIÓN DEL TALENTO HUMANO</td>
            </tr>
            <tr>
                <td class="title-cell title-row-3">CARTA DE AUTORIZACIÓN DE RECOBRO POR SERVICIOS DE SALUD</td>
            </tr>
            <tr class="meta-row">
                <td>CÓDIGO: SIG-MD-DE-FT-06</td>
                <td>VERSIÓN: 01 &nbsp;&nbsp;|&nbsp;&nbsp; EMISIÓN: 30-01-2023 &nbsp;&nbsp;|&nbsp;&nbsp; PÁGINA 1 DE 1</td>
            </tr>
        </table>

        <!-- CONSECUTIVO -->
        <div class="consecutivo">
            <strong>Consecutivo: TRIAN-${recobro.consecutivo}</strong>
        </div>

        <!-- FECHA Y CIUDAD -->
        <div class="fecha-ciudad">
            Montería, ${fecha}
        </div>

        <!-- DESTINATARIO -->
        <div class="destinatario">
            <p>Sres.</p>
            <p><strong>NUEVA EMPRESA PROMOTORA DE SALUD S.A. - NUEVA EPS</strong></p>
            <p>La Ciudad</p>
        </div>

        <!-- REFERENCIA -->
        <div class="referencia">
            Ref.: CARTA DE AUTORIZACIÓN DE RECOBRO POR SERVICIOS DE SALUD, USUARIO [${recobro.pacienteTipoId || 'CC'} ${recobro.pacienteId} ${recobro.pacienteNombres || ''}]
        </div>

        <!-- SALUDO -->
        <div class="saludo">
            Cordial saludo,
        </div>

        <!-- PÁRRAFO PRINCIPAL -->
        <div class="parrafo">
            Mediante la presente, nos permitimos dar visto bueno para realización de los servicios abajo relacionados a través de la Red de la EAPB, con recobro al Pago Global Prospectivo según las tarifas pactadas en el acuerdo de voluntades vigentes (Dec. 441 de 2022, Artículo 2.5.3.4.2.2).
        </div>

        <!-- TABLA DE DATOS DEL USUARIO Y SERVICIO PRINCIPAL -->
        <table class="datos-table">
            <tr>
                <td class="label">Identificación Usuario(a)</td>
                <td>${recobro.pacienteTipoId || 'CC'} ${recobro.pacienteId}</td>
            </tr>
            <tr>
                <td class="label">Nombres y Apellidos Usuario</td>
                <td>${recobro.pacienteNombres || 'No especificado'}</td>
            </tr>
            <tr>
                <td class="label">CUPS Principal</td>
                <td>${cupsPrincipal?.cups || 'N/A'}</td>
            </tr>
            <tr>
                <td class="label">Descripción Principal</td>
                <td>${cupsPrincipal?.descripcion || 'N/A'}</td>
            </tr>
            <tr>
                <td class="label">Cantidad autorizada</td>
                <td>${cupsPrincipal?.cantidad || 1}</td>
            </tr>
        </table>

        <!-- CUPS RELACIONADOS -->
        ${cupsRelacionados.length > 0 || recobro.cupsData.length > 1 ? `
        <p style="margin-bottom: 8px; font-weight: bold;">CUPS Relacionados:</p>
        <table class="cups-table">
            <thead>
                <tr>
                    <th style="width: 15%;">Código</th>
                    <th style="width: 70%;">Descripción</th>
                    <th style="width: 15%;">Cantidad</th>
                </tr>
            </thead>
            <tbody>
                ${filasRelacionados}
            </tbody>
        </table>
        ` : ''}

        <!-- JUSTIFICACIÓN -->
        ${recobro.justificacion ? `
        <table class="datos-table">
            <tr>
                <td class="label">Justificación</td>
                <td>${recobro.justificacion}</td>
            </tr>
        </table>
        ` : ''}

        <!-- DESPEDIDA -->
        <div style="margin-top: 15px; margin-bottom: 25px;">
            Cordialmente,
        </div>

        <!-- FIRMA ELECTRÓNICA -->
        <div class="firma-container">
            <div class="firma-electronica">
                <div class="firma-titulo">✓ APROBADO ELECTRÓNICAMENTE</div>
                <div class="firma-nombre">VIVIANA ESTHELA DORIA GONZÁLEZ</div>
                <div class="firma-cargo">Directora Administrativa</div>
                <div class="firma-empresa">Gestar Salud de Colombia IPS</div>
                <div class="firma-meta">
                    <div class="firma-meta-row">
                        <span>Fecha/Hora:</span>
                        <span>${timestamp}</span>
                    </div>
                    <div class="firma-meta-row">
                        <span>Código verificación:</span>
                        <span class="verificacion-code">${codigoVerificacion}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- PIE DE PÁGINA - GESTIÓN -->
        <div class="footer">
            <div class="footer-row">
                <span><span class="footer-label">Gestionado por:</span> ${aprobadoPor}</span>
            </div>
            <div class="footer-row">
                <span><span class="footer-label">Revisado por:</span> COORDINACION ASISTENCIAL</span>
            </div>
        </div>
    </div>
</body>
</html>
`
}

/**
 * Genera un PDF de aprobación para un recobro
 */
export async function generarPdfAprobacion(
    recobro: Recobro,
    aprobadoPor?: string
): Promise<PdfAprobacionResult> {
    // Si no se proporciona aprobadoPor, usar el radicador como fallback
    const nombreAprobador = aprobadoPor || recobro.radicadorNombre || recobro.radicadorEmail

    // Generar HTML
    const html = generarHtmlCarta({ recobro, aprobadoPor: nombreAprobador })

    // Crear elemento temporal para renderizar
    const container = document.createElement('div')
    container.innerHTML = html
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '-9999px'
    document.body.appendChild(container)

    // Configuración de html2pdf
    const options = {
        margin: [10, 10, 15, 10] as [number, number, number, number], // top, left, bottom, right (mm)
        filename: `CARTA_AUTORIZACION_${recobro.consecutivo}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            logging: false,
        },
        jsPDF: {
            unit: 'mm' as const,
            format: 'letter' as const,
            orientation: 'portrait' as const,
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    }

    try {
        // Generar PDF como blob
        const blob = await html2pdf()
            .set(options)
            .from(container)
            .outputPdf('blob')

        // Limpiar elemento temporal
        document.body.removeChild(container)

        // Nombre del archivo
        const fechaStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
        const filename = `CARTA_AUTORIZACION_${recobro.consecutivo}_${fechaStr}.pdf`

        return { blob, filename }
    } catch (error) {
        // Limpiar elemento temporal en caso de error
        if (document.body.contains(container)) {
            document.body.removeChild(container)
        }
        throw error
    }
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
