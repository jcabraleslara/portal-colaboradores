/**
 * Servicio de Embeddings con Gemini
 * Genera vectores de 768 dimensiones usando text-embedding-004
 */

// Gemini embedding-001 genera vectores de 768 dimensiones
// Ajustamos la tabla si es necesario (1536 era para OpenAI, Gemini usa 768)
export const EMBEDDING_DIMENSIONS = 768


interface EmbeddingResult {
    embedding: number[]
    tokenCount?: number
}

/**
 * Genera un embedding para un texto usando Gemini vía endpoint serverless seguro
 * La API key NO se expone al frontend
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
        const response = await fetch('/api/generate-embedding', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(`Error generando embedding: ${response.status} - ${error.error || 'Desconocido'}`)
        }

        const data = await response.json()

        if (!data.success || !data.embedding) {
            throw new Error('Respuesta del servidor sin embedding válido')
        }

        return {
            embedding: data.embedding,
            tokenCount: data.dimensions // Usamos dimensiones en lugar de tokenCount
        }
    } catch (error) {
        console.error('[Embedding Service] Error:', error)
        throw error
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
