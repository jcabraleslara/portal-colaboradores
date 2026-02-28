/**
 * Utilidades de nombrado de archivos para Soportes de Facturación
 * Compartidas entre Edge Functions y frontend
 *
 * Portadas de src/services/soportesFacturacion.service.ts
 */

// Tipos inline (evitar dependencia de tipos frontend)
export type EpsFacturacion = 'NUEVA EPS' | 'SALUD TOTAL' | 'FAMILIAR DE COLOMBIA'

export type ServicioPrestado =
    | 'Consulta Ambulatoria'
    | 'Procedimientos Menores'
    | 'Imágenes Diagnósticas'
    | 'Cirugía ambulatoria'
    | 'Terapias'
    | 'Aplicación de medicamentos'
    | 'Laboratorio clínico'

export type CategoriaArchivo =
    | 'validacion_derechos'
    | 'autorizacion'
    | 'soporte_clinico'
    | 'comprobante_recibo'
    | 'orden_medica'
    | 'descripcion_quirurgica'
    | 'registro_anestesia'
    | 'hoja_medicamentos'
    | 'notas_enfermeria'

/**
 * Mapear categoría a nombre de columna en DB
 */
export function getCategoriaColumnName(categoria: CategoriaArchivo): string {
    const mapping: Record<CategoriaArchivo, string> = {
        'validacion_derechos': 'urls_validacion_derechos',
        'autorizacion': 'urls_autorizacion',
        'soporte_clinico': 'urls_soporte_clinico',
        'comprobante_recibo': 'urls_comprobante_recibo',
        'orden_medica': 'urls_orden_medica',
        'descripcion_quirurgica': 'urls_descripcion_quirurgica',
        'registro_anestesia': 'urls_registro_anestesia',
        'hoja_medicamentos': 'urls_hoja_medicamentos',
        'notas_enfermeria': 'urls_notas_enfermeria',
    }
    return mapping[categoria]
}

/**
 * Obtener prefijo de archivo según EPS, Servicio y Categoría
 * Reglas de negocio según Matriz de Renombrado
 */
export function getPrefijoArchivo(eps: EpsFacturacion, servicio: ServicioPrestado, categoria: CategoriaArchivo): string {
    if (categoria === 'autorizacion') {
        if (eps === 'SALUD TOTAL') return 'OPF'
        return 'PDE'
    }

    if (categoria === 'comprobante_recibo') return 'CRC'

    if (categoria === 'validacion_derechos') {
        if (eps === 'NUEVA EPS') return 'PDE2'
        if (eps === 'FAMILIAR DE COLOMBIA') return 'OPF'
        return 'OPF'
    }

    if (categoria === 'orden_medica') {
        if (eps === 'FAMILIAR DE COLOMBIA') return 'PDE2'
        return 'PDX'
    }

    if (categoria === 'descripcion_quirurgica') return 'DQX'
    if (categoria === 'registro_anestesia') return 'RAN'
    if (categoria === 'hoja_medicamentos') return 'HAM'
    if (categoria === 'notas_enfermeria') return 'HEV'

    if (categoria === 'soporte_clinico') {
        const esImagenOLab = servicio === 'Imágenes Diagnósticas' || servicio === 'Laboratorio clínico'

        if (eps === 'SALUD TOTAL') {
            return esImagenOLab ? 'PDX' : 'HEV'
        }
        if (eps === 'NUEVA EPS') {
            return esImagenOLab ? 'PDX' : 'HEV'
        }
        if (eps === 'FAMILIAR DE COLOMBIA') {
            if (servicio === 'Imágenes Diagnósticas') return 'PDX'
            return 'HEV'
        }
    }

    return 'DOC'
}

/**
 * Extraer Identificación válida del nombre del archivo original
 * Ejemplo: "CC123456.pdf" -> "CC123456"
 * Ejemplo: "Soporte_TI987654321_Feb.pdf" -> "TI987654321"
 */
export function extraerIdentificacionArchivo(nombreArchivo: string): string | null {
    const patron = /(?:^|[^a-zA-Z])(CC|TI|CE|CN|SC|PE|PT|RC|ME|AS)\s*(\d{1,13})(?:[^0-9]|$)/i
    const match = nombreArchivo.match(patron)

    if (match && match[1] && match[2]) {
        const tipoId = match[1].toUpperCase()
        const numero = match[2]

        if (parseInt(numero, 10) <= 1199999999) {
            return `${tipoId}${numero}`
        }
    }
    return null
}

/**
 * Extraer identificaciones de un array de URLs firmadas
 * @returns Array de identificaciones únicas (con tipo y solo número)
 */
export function extraerIdentificacionesDeUrls(urls: string[]): string[] {
    const identificaciones = new Set<string>()
    for (const url of urls) {
        try {
            const urlObj = new URL(url)
            const pathName = decodeURIComponent(urlObj.pathname)
            const nombreArchivo = pathName.split('/').pop() || ''
            const id = extraerIdentificacionArchivo(nombreArchivo)
            if (id) {
                identificaciones.add(id)
                const soloNumero = id.replace(/^(CC|TI|CE|CN|SC|PE|PT|RC|ME|AS)/i, '')
                if (soloNumero) identificaciones.add(soloNumero)
            }
        } catch {
            // URL malformada, ignorar
        }
    }
    return Array.from(identificaciones)
}

/** NIT fijo para renombrado de archivos */
export const NIT = '900842629'

/**
 * Generar nombre y ruta de archivo renombrado para Storage
 * Maneja duplicados con sufijo consecutivo
 */
export function generarRutaArchivo(
    nombreOriginal: string,
    categoria: CategoriaArchivo,
    radicado: string,
    eps: EpsFacturacion,
    servicio: ServicioPrestado,
    contadorNombres: Map<string, number>
): { nombreFinal: string; ruta: string; identificacion: string | null } {
    const extension = nombreOriginal.split('.').pop()?.toLowerCase() || 'pdf'
    const identificacion = extraerIdentificacionArchivo(nombreOriginal)
    const prefijo = getPrefijoArchivo(eps, servicio, categoria)

    let nombreBase = ''
    if (identificacion) {
        nombreBase = `${prefijo}_${NIT}_${identificacion}`
    } else {
        nombreBase = `${prefijo}_${radicado}_${categoria}`
    }

    const count = contadorNombres.get(nombreBase) || 0
    contadorNombres.set(nombreBase, count + 1)
    const nombreFinal = count === 0
        ? `${nombreBase}.${extension}`
        : `${nombreBase}_${count + 1}.${extension}`

    return {
        nombreFinal,
        ruta: `${radicado}/${nombreFinal}`,
        identificacion,
    }
}
