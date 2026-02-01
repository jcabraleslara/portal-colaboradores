/**
 * Servicio de notificaciones a Microsoft Teams
 * Envía mensajes a canales de Teams vía Edge Function
 */

import { supabase } from '@/config/supabase.config'

interface DatosDevolucionTeams {
    radicado: string
    paciente: string
    identificacion: string
    tipoSolicitud: string
    fechaRadicacion: string
    radicador: string
    motivoDevolucion: string
}

interface TeamsNotifyResponse {
    success: boolean
    message?: string
    error?: string
}

/**
 * Servicio para enviar notificaciones a Microsoft Teams
 */
export const teamsService = {
    /**
     * Envía notificación de devolución de caso al canal de Teams
     * @param datos - Datos del caso devuelto
     * @returns Resultado de la operación
     */
    async notificarDevolucionBack(datos: DatosDevolucionTeams): Promise<TeamsNotifyResponse> {
        try {
            console.log(`📤 [Teams] Enviando notificación de devolución para radicado: ${datos.radicado}`)

            const { data, error } = await supabase.functions.invoke('teams-notify', {
                body: {
                    tipo: 'devolucion_back',
                    datos
                }
            })

            if (error) {
                console.error('❌ [Teams] Error al invocar función:', error)
                return {
                    success: false,
                    error: error.message || 'Error al enviar notificación a Teams'
                }
            }

            if (!data?.success) {
                console.error('❌ [Teams] La función retornó error:', data?.error)
                return {
                    success: false,
                    error: data?.error || 'Error desconocido al enviar a Teams'
                }
            }

            console.log(`✅ [Teams] Notificación enviada exitosamente para radicado: ${datos.radicado}`)
            return {
                success: true,
                message: 'Notificación enviada a Teams'
            }

        } catch (error) {
            console.error('❌ [Teams] Excepción al enviar notificación:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error inesperado'
            }
        }
    }
}
