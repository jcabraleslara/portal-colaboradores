/**
 * Servicio de Correo (Gmail API)
 * Utiliza credenciales OAuth2 proporcionadas para enviar correos desde el frontend.
 * Nota: Idealmente esto debería estar en un backend para proteger el client_secret.
 */

interface GoogleTokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
}

const GMAIL_CONFIG = {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
    refreshToken: import.meta.env.VITE_GOOGLE_REFRESH_TOKEN,
    tokenUri: "https://oauth2.googleapis.com/token",
    userEmail: import.meta.env.VITE_GOOGLE_USER_EMAIL || "info@gestarsaludips.com.co"
};

export const emailService = {
    /**
     * Obtener nuevo access token usando el refresh token
     */
    async getAccessToken(): Promise<string> {
        const response = await fetch(GMAIL_CONFIG.tokenUri, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: GMAIL_CONFIG.clientId,
                client_secret: GMAIL_CONFIG.clientSecret,
                refresh_token: GMAIL_CONFIG.refreshToken,
                grant_type: 'refresh_token',
            }),
        });

        if (!response.ok) {
            throw new Error('Error renovando token de Gmail');
        }

        const data: GoogleTokenResponse = await response.json();
        return data.access_token;
    },

    /**
     * Enviar correo de devolución
     */
    async enviarNotificacionDevolucion(
        destinatario: string,
        radicado: string,
        motivo: string,
        datosCaso: Record<string, string>
    ): Promise<boolean> {
        try {
            const token = await this.getAccessToken();

            // Construir el cuerpo del correo
            const subject = `Devolución de Radicado - ${radicado}`;

            const detallesHtml = Object.entries(datosCaso)
                .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
                .join('');

            const messageBody = `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #d32f2f;">Devolución de Radicado</h2>
                    <p>Cordial saludo,</p>
                    <p>Le informamos que su radicado <strong>${radicado}</strong> ha sido devuelto por el siguiente motivo:</p>
                    <div style="background-color: #fef2f2; border-left: 4px solid #d32f2f; padding: 15px; margin: 15px 0;">
                        <strong>${motivo}</strong>
                    </div>
                    <h3>Datos del Radicado:</h3>
                    <ul>
                        ${detallesHtml}
                    </ul>
                    <p>Por favor, subsane las observaciones y radique nuevamente si es necesario.</p>
                    <hr />
                    <p style="font-size: 12px; color: #666;">
                        Este es un mensaje automático generado por el Portal de Colaboradores de Gestar Salud IPS.
                        No responda a este correo.
                    </p>
                </div>
            `;

            // Codificar mensaje a Base64URL compatible con Gmail API
            const email = [
                `To: ${destinatario}`,
                `From: Gestar Salud IPS <${GMAIL_CONFIG.userEmail}>`,
                `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
                'Content-Type: text/html; charset=utf-8',
                'MIME-Version: 1.0',
                '',
                messageBody
            ].join('\r\n');

            const encodedEmail = btoa(unescape(encodeURIComponent(email)))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            // Enviar correo
            const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    raw: encodedEmail
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error Gmail API:', errorData);
                throw new Error('Falló el envío del correo');
            }

            return true;
        } catch (error) {
            console.error('Error enviando correo:', error);
            return false;
        }
    }
};
