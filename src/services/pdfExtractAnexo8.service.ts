/**
 * Servicio de Extracción de PDF para Anexo 8
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Extrae datos de PDFs nativos de fórmulas médicas
 */

import { Anexo8OcrResult } from '@/types/anexo8.types'

const API_URL = '/api/pdf-extract-anexo8'

/**
 * Convierte un archivo PDF a base64
 */
export function pdfToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => {
            const result = reader.result as string
            // Remover el prefijo data:application/pdf;base64,
            const base64 = result.split(',')[1]
            resolve(base64)
        }
        reader.onerror = (error) => reject(error)
    })
}

/**
 * Extrae datos de un PDF de fórmula médica
 */
export async function extraerDatosPdf(file: File): Promise<{
    success: boolean
    data?: Anexo8OcrResult
    error?: string
}> {
    try {
        // Validar que sea PDF
        if (!file.type.includes('pdf')) {
            return {
                success: false,
                error: 'El archivo debe ser un PDF'
            }
        }

        // Validar tamaño (máximo 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return {
                success: false,
                error: 'El archivo PDF es demasiado grande (máximo 5MB)'
            }
        }

        // Convertir a base64
        const pdfBase64 = await pdfToBase64(file)

        // Enviar al endpoint
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pdfBase64 }),
        })

        const result = await response.json()

        if (!response.ok) {
            return {
                success: false,
                error: result.error || 'Error al procesar el PDF'
            }
        }

        return {
            success: true,
            data: result.data
        }
    } catch (error) {
        console.error('Error en PDF service:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error de conexión'
        }
    }
}

export default { extraerDatosPdf, pdfToBase64 }
