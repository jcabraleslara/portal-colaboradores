import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Serverless function para envío de SMS vía LabsMobile
 * POST /api/sms
 * Body: { phone: string, message: string }
 */
export default async function handler(request: VercelRequest, response: VercelResponse) {
    // Solo permitir POST
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { phone, message } = request.body;
        const username = process.env.LABSMOBILE_USERNAME;
        const token = process.env.LABSMOBILE_TOKEN;

        // Validaciones básicas
        if (!phone || !message) {
            return response.status(400).json({ error: 'Faltan parámetros requeridos (phone, message)' });
        }

        if (!username || !token) {
            console.error('Faltan credenciales de LabsMobile en variables de entorno');
            return response.status(500).json({ error: 'Error de configuración del servidor' });
        }

        // LabsMobile espera el teléfono con código de país.
        // Asumimos Colombia (57) si no viene incluido, pero idealmente debería venir formateado.
        // Limpiamos el teléfono de caracteres no numéricos
        let cleanPhone = phone.replace(/\D/g, '');

        // Si tiene 10 dígitos (ej: 3001234567), asumimos Colombia y agregamos 57
        if (cleanPhone.length === 10) {
            cleanPhone = `57${cleanPhone}`;
        }

        const payload = {
            message: message,
            tpoa: "GESTARSALUD", // Sender ID (max 11 chars alfanuméricos)
            recipient: [
                { msisdn: cleanPhone }
            ]
        };

        // Autenticación Basic Auth
        const auth = Buffer.from(`${username}:${token}`).toString('base64');

        const labsmobileResponse = await fetch('https://api.labsmobile.com/json/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify(payload)
        });

        const data = await labsmobileResponse.json();

        if (labsmobileResponse.ok && data.code === '0') {
            // Código '0' en LabsMobile suele ser éxito (ver docs, response code puede variar, pero 200 http es base)
            return response.status(200).json({ success: true, data });
        } else {
            console.error('Error LabsMobile:', data);
            return response.status(502).json({
                success: false,
                error: 'Error al enviar SMS',
                detail: data.message || 'Unknown error'
            });
        }

    } catch (error: any) {
        console.error('Error en API SMS:', error);
        return response.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
