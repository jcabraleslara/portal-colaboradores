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
 * Interfaz para adjuntos de correo
 */
export interface EmailAttachment {
    filename: string
    content: string  // Base64 encoded content
    mimeType: string // e.g., 'application/pdf', 'image/png'
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
 * Opciones extendidas para envío de correo
 */
export interface SendEmailOptions {
    to: string | string[]     // Destinatario(s) principal(es)
    cc?: string | string[]    // Copia(s) opcional(es)
    subject: string
    htmlBody: string
    attachments?: EmailAttachment[]  // Adjuntos opcionales
}

/**
 * Generar boundary único para mensajes multipart
 */
function generateBoundary(): string {
    return `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Construir mensaje MIME con adjuntos
 */
function buildMimeMessageWithAttachments(
    to: string,
    cc: string | undefined,
    subject: string,
    htmlBody: string,
    attachments: EmailAttachment[],
    userEmail: string
): string {
    const boundary = generateBoundary()

    const headers = [
        `To: ${to}`,
        cc ? `Cc: ${cc}` : null,
        `From: Gestar Salud IPS <${userEmail}>`,
        `Subject: ${encodeHeader(subject)}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ].filter(Boolean).join('\r\n')

    // Parte HTML
    const htmlPart = [
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        encodeBase64(htmlBody)
    ].join('\r\n')

    // Partes de adjuntos
    const attachmentParts = attachments.map(att => [
        `--${boundary}`,
        `Content-Type: ${att.mimeType}; name="${att.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${att.filename}"`,
        '',
        att.content  // Ya viene en base64
    ].join('\r\n')).join('\r\n')

    // Ensamblar mensaje completo
    return [
        headers,
        '',
        htmlPart,
        attachmentParts,
        `--${boundary}--`
    ].join('\r\n')
}

/**
 * Enviar correo usando Gmail API
 * Soporta múltiples destinatarios, CC y adjuntos MIME
 */
export async function sendGmailEmail(
    toOrOptions: string | SendEmailOptions,
    subject?: string,
    htmlBody?: string
): Promise<void> {
    const token = await getGmailAccessToken()
    const userEmail = Deno.env.get('GOOGLE_USER_EMAIL') || 'info@gestarsaludips.com.co'

    let email: string

    // Soporte para llamada legacy (3 parámetros) o nueva (objeto de opciones)
    if (typeof toOrOptions === 'string') {
        // Llamada legacy: sendGmailEmail(to, subject, htmlBody)
        const to = toOrOptions
        email = [
            `To: ${to}`,
            `From: Gestar Salud IPS <${userEmail}>`,
            `Subject: ${encodeHeader(subject!)}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            '',
            htmlBody!
        ].join('\r\n')
    } else {
        // Nueva llamada con opciones extendidas
        const opts = toOrOptions
        const toStr = Array.isArray(opts.to) ? opts.to.join(', ') : opts.to
        const ccStr = opts.cc
            ? (Array.isArray(opts.cc) ? opts.cc.join(', ') : opts.cc)
            : undefined

        if (opts.attachments && opts.attachments.length > 0) {
            // Mensaje con adjuntos (multipart/mixed)
            email = buildMimeMessageWithAttachments(
                toStr,
                ccStr,
                opts.subject,
                opts.htmlBody,
                opts.attachments,
                userEmail
            )
        } else {
            // Mensaje simple sin adjuntos
            email = [
                `To: ${toStr}`,
                ccStr ? `Cc: ${ccStr}` : null,
                `From: Gestar Salud IPS <${userEmail}>`,
                `Subject: ${encodeHeader(opts.subject)}`,
                'Content-Type: text/html; charset=utf-8',
                'MIME-Version: 1.0',
                '',
                opts.htmlBody
            ].filter(Boolean).join('\r\n')
        }
    }

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
