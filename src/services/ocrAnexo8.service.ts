/**
 * Servicio de OCR para Anexo 8
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { Anexo8OcrResult } from '@/types/anexo8.types'

const API_URL = '/api/ocr-anexo8'

/**
 * Envía una imagen al endpoint de OCR y obtiene los datos extraídos
 */
export async function procesarImagenOcr(imageBase64: string, mimeType = 'image/png'): Promise<{
    success: boolean
    data?: Anexo8OcrResult
    error?: string
}> {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imageBase64,
                mimeType
            }),
        })

        const result = await response.json()

        if (!response.ok) {
            return {
                success: false,
                error: result.error || 'Error en el procesamiento OCR'
            }
        }

        return {
            success: true,
            data: result.data
        }
    } catch (error) {
        console.error('Error en OCR service:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error de conexión'
        }
    }
}

/**
 * Convierte un archivo/blob a base64
 */
export function fileToBase64(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => {
            const result = reader.result as string
            // Remover el prefijo data:image/png;base64,
            const base64 = result.split(',')[1]
            resolve(base64)
        }
        reader.onerror = (error) => reject(error)
    })
}

export default { procesarImagenOcr, fileToBase64 }
