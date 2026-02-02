/**
 * Configuracion de URLs de APIs
 * Portal de Colaboradores - Gestar Salud IPS
 *
 * Define las URLs base para las diferentes APIs del sistema.
 * Las funciones migradas a Supabase Edge Functions usan la URL de Supabase.
 * Las funciones que permanecen en Vercel usan rutas relativas.
 */

// URL base de Supabase (desde variables de entorno de Vite)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

/**
 * URLs de Supabase Edge Functions
 * Estas funciones fueron migradas de Vercel para mejor rendimiento.
 */
export const EDGE_FUNCTIONS = {
    sms: `${SUPABASE_URL}/functions/v1/sms`,
    createUser: `${SUPABASE_URL}/functions/v1/create-user`,
    deleteOnedrive: `${SUPABASE_URL}/functions/v1/delete-onedrive`,
    uploadOnedrive: `${SUPABASE_URL}/functions/v1/upload-onedrive`,
    geminiOcr: `${SUPABASE_URL}/functions/v1/gemini-ocr`,
    generarContrarreferencia: `${SUPABASE_URL}/functions/v1/generar-contrarreferencia`,
    generateEmbedding: `${SUPABASE_URL}/functions/v1/generate-embedding`,
    notifyCriticalError: `${SUPABASE_URL}/functions/v1/notify-critical-error`,
    sendEmail: `${SUPABASE_URL}/functions/v1/send-email`,
} as const

/**
 * URLs de Vercel Serverless Functions
 * Estas funciones permanecen en Vercel por incompatibilidad con Deno.
 */
export const VERCEL_FUNCTIONS = {
    // OCR con Google Document AI (SDK incompatible con Deno)
    ocr: '/api/ocr',
    // Extraccion de PDF con pdf-lib (incompatible con Deno)
    pdfExtractAnexo8: '/api/pdf-extract-anexo8',
} as const

/**
 * Headers comunes para llamadas a Edge Functions
 */
export function getEdgeFunctionHeaders(authToken?: string): HeadersInit {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
    }

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
    } else {
        // Si no se proporciona token de usuario, usar la Anon Key como Authorization
        // Esto evita el error 401 "Missing authorization header" en funciones publicas/anonimas
        headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`
    }

    return headers
}

/**
 * Helper para hacer fetch a Edge Functions
 */
export async function fetchEdgeFunction<T = unknown>(
    url: string,
    options: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
        body?: unknown
        authToken?: string
    } = {}
): Promise<{ data: T | null; error: string | null }> {
    try {
        const response = await fetch(url, {
            method: options.method || 'POST',
            headers: getEdgeFunctionHeaders(options.authToken),
            body: options.body ? JSON.stringify(options.body) : undefined,
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }))
            return { data: null, error: errorData.error || `Error HTTP ${response.status}` }
        }

        const data = await response.json()
        return { data, error: null }
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error.message : 'Error de conexion'
        }
    }
}
