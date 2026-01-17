/**
 * Servicio de Embeddings con Gemini
 * Genera vectores de 768 dimensiones usando text-embedding-004
 */

// Gemini embedding-001 genera vectores de 768 dimensiones
// Ajustamos la tabla si es necesario (1536 era para OpenAI, Gemini usa 768)
export const EMBEDDING_DIMENSIONS = 768

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

interface EmbeddingResult {
    embedding: number[]
    tokenCount?: number
}

/**
 * Genera un embedding para un texto usando Gemini
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!GEMINI_API_KEY) {
        throw new Error('VITE_GEMINI_API_KEY no configurada')
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: {
                parts: [{ text }]
            }
        })
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Error generando embedding: ${response.status} - ${error}`)
    }

    const data = await response.json()

    return {
        embedding: data.embedding.values,
        tokenCount: data.embedding.tokenCount
    }
}

/**
 * Genera embeddings para múltiples textos (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    // Gemini no tiene endpoint de batch nativo, procesamos secuencialmente con delay
    const results: EmbeddingResult[] = []

    for (const text of texts) {
        const result = await generateEmbedding(text)
        results.push(result)
        // Pequeño delay para respetar rate limits (1500 RPM = 25 RPS)
        await new Promise(resolve => setTimeout(resolve, 50))
    }

    return results
}

/**
 * Divide un texto largo en chunks para procesamiento
 * Cada chunk tendrá aproximadamente maxTokens tokens
 */
export function splitTextIntoChunks(text: string, maxChars: number = 2000): string[] {
    const chunks: string[] = []
    const paragraphs = text.split(/\n\n+/)

    let currentChunk = ''

    for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length > maxChars && currentChunk.length > 0) {
            chunks.push(currentChunk.trim())
            currentChunk = ''
        }
        currentChunk += paragraph + '\n\n'
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim())
    }

    return chunks
}
