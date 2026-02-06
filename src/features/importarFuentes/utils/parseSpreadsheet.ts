/**
 * Utilidad de parseo multi-formato para archivos de importación
 * Soporta: HTML disfrazado de XLS, XLS binario, XLSX
 * Retorna un Document HTML para procesamiento uniforme en los servicios
 */

import * as XLSX from 'xlsx'

/**
 * Parsea un archivo de spreadsheet (HTML-XLS, XLS binario, XLSX)
 * y retorna un Document con tablas HTML para procesamiento uniforme
 */
export async function parseSpreadsheetFile(file: File): Promise<Document> {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    if (detectHtml(bytes)) {
        const text = new TextDecoder().decode(bytes)
        const parser = new DOMParser()
        return parser.parseFromString(text, 'text/html')
    }

    // Excel binario (XLS/XLSX) → convertir primera hoja a HTML
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const html = XLSX.utils.sheet_to_html(firstSheet)
    const parser = new DOMParser()
    return parser.parseFromString(html, 'text/html')
}

/** Detecta si los bytes corresponden a HTML (incluye BOM UTF-8) */
function detectHtml(bytes: Uint8Array): boolean {
    let start = 0
    // Saltar BOM UTF-8 (EF BB BF)
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) start = 3

    // Buscar '<' en los primeros 100 bytes (ignorando whitespace)
    for (let i = start; i < Math.min(bytes.length, 100); i++) {
        const ch = bytes[i]
        if (ch === 0x3C) return true  // '<'
        if (ch !== 0x20 && ch !== 0x09 && ch !== 0x0A && ch !== 0x0D) return false
    }
    return false
}
