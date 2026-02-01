/**
 * Utilidades para Gmail API
 * Supabase Edge Functions - Portal de Colaboradores
 *
 * Funciones compartidas para envío de correos usando Gmail API con OAuth2
 * Adaptado para Deno runtime
 */

interface GoogleTokenResponse {
    access_token: string
    expires_in: number
    scope: string
    token_type: string
}

/**
 * Obtener access token de Gmail usando refresh token
 */
export async function getGmailAccessToken(): Promise<string> {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Faltan credenciales de Google OAuth2 en variables de entorno')
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    })

    if (!response.ok) {
        const error = await response.text()

        if (response.status === 401 || response.status === 403 || response.status === 400) {
            console.error('[Gmail Utils] ERROR CRITICO: Credenciales de Gmail OAuth2 invalidas o expiradas')
        }

        throw new Error(`Error renovando token de Gmail: ${error}`)
    }

    const data: GoogleTokenResponse = await response.json()
    return data.access_token
}

/**
 * Codificar texto a Base64 (compatible con Deno)
 */
function encodeBase64(text: string): string {
    const encoder = new TextEncoder()
    const data = encoder.encode(text)
    let binary = ''
    for (let i = 0; i < data.length; i++) {
        binary += String.fromCharCode(data[i])
    }
    return btoa(binary)
}

/**
 * Codificar texto para encabezados de correo (RFC 2047)
 * Necesario para asuntos con tildes y caracteres especiales
 */
function encodeHeader(text: string): string {
    const encoded = encodeBase64(text)
    return `=?utf-8?B?${encoded}?=`
}

/**
 * Codificar mensaje de correo para Gmail API (Base64URL)
 */
function encodeEmailMessage(raw: string): string {
    return encodeBase64(raw)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

/**
 * Enviar correo usando Gmail API
 */
export async function sendGmailEmail(
    to: string,
    subject: string,
    htmlBody: string
): Promise<void> {
    const token = await getGmailAccessToken()
    const userEmail = Deno.env.get('GOOGLE_USER_EMAIL') || 'info@gestarsaludips.com'

    // Construir mensaje RFC 2822
    const email = [
        `To: ${to}`,
        `From: Gestar Salud IPS <${userEmail}>`,
        `Subject: ${encodeHeader(subject)}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        htmlBody
    ].join('\r\n')

    const encodedEmail = encodeEmailMessage(email)

    // Enviar usando Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            raw: encodedEmail
        }),
    })

    if (!response.ok) {
        const errorData = await response.json()
        console.error('[Gmail Utils] Error Gmail API:', errorData)
        throw new Error(`Fallo el envio del correo: ${JSON.stringify(errorData)}`)
    }
}
