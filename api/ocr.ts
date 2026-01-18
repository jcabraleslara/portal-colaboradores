/**
 * Vercel Serverless Function: OCR con Google Cloud Document AI
 * Endpoint: POST /api/ocr
 * 
 * Recibe un PDF en base64 y devuelve el texto extraído mediante OCR.
 * Las credenciales de Google Cloud se mantienen seguras en el servidor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { DocumentProcessorServiceClient } from '@google-cloud/documentai'

// Configuración desde variables de entorno
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'document-ai-ocr-484713'
const LOCATION = process.env.GCP_LOCATION || 'us'
const PROCESSOR_ID = process.env.GCP_PROCESSOR_ID || 'f59453255feb1e3f'

// Credenciales de Google Cloud desde variable de entorno
const credentials = process.env.GCP_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
    : null

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Solo POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    // Validar credenciales
    if (!credentials) {
        console.error('GCP_SERVICE_ACCOUNT_KEY no configurada')
        return res.status(500).json({ error: 'OCR service not configured' })
    }

    try {
        const { pdfBase64 } = req.body

        if (!pdfBase64) {
            return res.status(400).json({ error: 'pdfBase64 is required' })
        }

        // Crear cliente de Document AI
        const client = new DocumentProcessorServiceClient({ credentials })

        // Nombre del procesador
        const processorName = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`

        // Preparar la solicitud
        const request = {
            name: processorName,
            rawDocument: {
                content: pdfBase64,
                mimeType: 'application/pdf',
            },
        }

        // Procesar documento
        const [result] = await client.processDocument(request)
        const { document } = result

        if (!document || !document.text) {
            return res.status(200).json({
                success: true,
                text: '',
                message: 'No text extracted from document'
            })
        }

        // Devolver texto extraído
        return res.status(200).json({
            success: true,
            text: document.text,
            pages: document.pages?.length || 0
        })

    } catch (error) {
        console.error('Document AI OCR error:', error)
        return res.status(500).json({
            error: 'OCR processing failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        })
    }
}
