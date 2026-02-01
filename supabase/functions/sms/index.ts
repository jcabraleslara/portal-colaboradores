/**
 * Supabase Edge Function: Envio de SMS via LabsMobile
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * POST /functions/v1/sms
 * Body: { phone: string, message: string }
 */

import { corsHeaders } from '../_shared/cors.ts'

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

Deno.serve(async (req) => {
    // Manejar preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Solo permitir POST
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method Not Allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        const { phone, message } = await req.json()
        const username = Deno.env.get('LABSMOBILE_USERNAME')
        const token = Deno.env.get('LABSMOBILE_TOKEN')

        // Validaciones basicas
        if (!phone || !message) {
            return new Response(
                JSON.stringify({ error: 'Faltan parametros requeridos (phone, message)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!username || !token) {
            console.error('Faltan credenciales de LabsMobile en variables de entorno')
            return new Response(
                JSON.stringify({ error: 'Error de configuracion del servidor' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // LabsMobile espera el telefono con codigo de pais.
        // Validamos estrictamente que sea un celular Colombia (10 digitos, inicia con 3)
        // Limpiamos caracteres no numericos
        let cleanPhone = phone.replace(/\D/g, '')

        // Validacion estricta: debe tener 10 digitos y empezar por 3
        if (!/^3\d{9}$/.test(cleanPhone)) {
            console.warn(`[API SMS] Rechazado numero invalido: ${phone}`)
            return new Response(
                JSON.stringify({ error: 'Numero de telefono invalido. Debe ser un celular de Colombia (3XX...)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Agregar codigo de pais 57
        cleanPhone = `57${cleanPhone}`

        const payload = {
            message: message,
            tpoa: "GESTARSALUD", // Remitente personalizado (max 11 chars)
            recipient: [
                { msisdn: cleanPhone }
            ]
        }

        // Autenticacion Basic Auth
        const auth = encodeBase64(`${username}:${token}`)

        const labsmobileResponse = await fetch('https://api.labsmobile.com/json/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify(payload)
        })

        const data = await labsmobileResponse.json()

        if (labsmobileResponse.ok && data.code === '0') {
            return new Response(
                JSON.stringify({ success: true, data }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        } else {
            console.error('Error LabsMobile:', data)
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Error al enviar SMS',
                    detail: data.message || 'Unknown error'
                }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

    } catch (error) {
        console.error('Error en API SMS:', error)
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Internal Server Error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
