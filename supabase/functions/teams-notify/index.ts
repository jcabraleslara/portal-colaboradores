/**
 * Edge Function: Notificación a Microsoft Teams
 * Envía mensajes a canales de Teams vía Incoming Webhook
 */

import { corsHeaders } from '../_shared/cors.ts'

interface TeamsNotifyPayload {
    tipo: 'devolucion_back'
    datos: {
        radicado: string
        paciente: string
        identificacion: string
        tipoSolicitud: string
        fechaRadicacion: string
        radicador: string
        motivoDevolucion: string
    }
}

// URL del webhook configurada en el canal de Teams
const TEAMS_WEBHOOK_DEVOLUCION_BACK = Deno.env.get('TEAMS_WEBHOOK_DEVOLUCION_BACK')

/**
 * Genera el payload de Adaptive Card para Teams
 */
function generarMensajeTeams(datos: TeamsNotifyPayload['datos']): object {
    // Limpiar HTML del motivo de devolución para mostrar texto plano
    const motivoLimpio = datos.motivoDevolucion
        .replace(/<[^>]*>/g, '') // Eliminar tags HTML
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim()

    return {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        "summary": `Radicado Devuelto - ${datos.radicado}`,
        "themeColor": "EA580C", // Naranja para devoluciones
        "title": "⚠️ RADICADO DEVUELTO",
        "sections": [
            {
                "facts": [
                    { "name": "📋 Radicado:", "value": datos.radicado },
                    { "name": "👤 Paciente:", "value": datos.paciente },
                    { "name": "🆔 Identificación:", "value": datos.identificacion },
                    { "name": "📝 Tipo Solicitud:", "value": datos.tipoSolicitud },
                    { "name": "📅 Fecha Radicación:", "value": datos.fechaRadicacion },
                    { "name": "👨‍💼 Radicador:", "value": datos.radicador }
                ],
                "text": ""
            },
            {
                "title": "❌ Motivo de Devolución:",
                "text": motivoLimpio || "Sin motivo especificado"
            }
        ]
    }
}

Deno.serve(async (req: Request) => {
    // Manejo de CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Validar que el webhook esté configurado
        if (!TEAMS_WEBHOOK_DEVOLUCION_BACK) {
            console.error('❌ TEAMS_WEBHOOK_DEVOLUCION_BACK no está configurado')
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Webhook de Teams no configurado'
                }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Parsear el body
        const payload: TeamsNotifyPayload = await req.json()

        // Validar tipo de notificación
        if (payload.tipo !== 'devolucion_back') {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Tipo de notificación no soportado'
                }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Validar datos requeridos
        if (!payload.datos?.radicado || !payload.datos?.motivoDevolucion) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Faltan datos requeridos (radicado, motivoDevolucion)'
                }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Generar mensaje para Teams
        const mensajeTeams = generarMensajeTeams(payload.datos)

        console.log(`📤 Enviando notificación a Teams para radicado: ${payload.datos.radicado}`)

        // Enviar al webhook de Teams
        const response = await fetch(TEAMS_WEBHOOK_DEVOLUCION_BACK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mensajeTeams)
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`❌ Error de Teams webhook: ${response.status} - ${errorText}`)
            return new Response(
                JSON.stringify({
                    success: false,
                    error: `Error al enviar a Teams: ${response.status}`
                }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        console.log(`✅ Notificación enviada exitosamente a Teams para radicado: ${payload.datos.radicado}`)

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Notificación enviada a Teams'
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('❌ Error en teams-notify:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido'
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
