/**
 * Servicio de Correo
 * Portal de Colaboradores - Gestar Salud IPS
 * 
 * Utiliza Vercel Serverless Functions para enviar correos de forma segura.
 * Las credenciales OAuth2 están protegidas en el backend.
 */

import { criticalErrorService } from './criticalError.service'

export const emailService = {
    /**
     * Enviar notificación de devolución (legacy - reutiliza endpoint de rechazo)
     */
    async enviarNotificacionDevolucion(
        destinatario: string,
        radicado: string,
        motivo: string,
        datosCaso: Record<string, string>
    ): Promise<boolean> {
        try {
            // Mapear a formato esperado por el endpoint de rechazo
            const datosRadicacion = {
                eps: datosCaso['EPS'] || '',
                regimen: datosCaso['Régimen'] || '',
                servicioPrestado: datosCaso['Servicio'] || '',
                fechaAtencion: datosCaso['Fecha de Atención'] || '',
                pacienteNombre: datosCaso['Paciente'] || '',
                pacienteIdentificacion: datosCaso['Identificación'] || '',
                pacienteTipoId: datosCaso['Tipo ID'] || '',
                archivos: [],
                fechaRadicacion: new Date().toISOString()
            }

            const response = await fetch('/api/send-rechazo-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinatario,
                    radicado,
                    observacionesFacturacion: motivo,
                    datosRadicacion
                })
            })

            if (!response.ok) {
                console.error('Error en respuesta del servidor:', await response.text())
                return false
            }

            const result = await response.json()
            return result.success
        } catch (error) {
            console.error('Error enviando correo de devolución:', error)

            // Notificar error crítico al equipo técnico
            await criticalErrorService.reportEmailFailure(
                destinatario,
                'BACK - Devolución de Casos',
                'Notificación de Devolución',
                error instanceof Error ? error : undefined
            )

            return false
        }
    },

    /**
     * Enviar notificación de rechazo de radicado de soportes de facturación
     */
    async enviarNotificacionRechazo(
        destinatario: string,
        radicado: string,
        observacionesFacturacion: string,
        datosRadicacion: {
            eps: string
            regimen: string
            servicioPrestado: string
            fechaAtencion: string
            pacienteNombre: string
            pacienteIdentificacion: string
            pacienteTipoId: string
            archivos: { categoria: string; urls: string[] }[]
            fechaRadicacion: string
        }
    ): Promise<boolean> {
        try {
            const response = await fetch('/api/send-rechazo-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinatario,
                    radicado,
                    observacionesFacturacion,
                    datosRadicacion
                })
            })

            if (!response.ok) {
                console.error('Error en respuesta del servidor:', await response.text())
                return false
            }

            const result = await response.json()
            return result.success
        } catch (error) {
            console.error('Error enviando correo de rechazo:', error)

            // Notificar error crítico al equipo técnico
            await criticalErrorService.reportEmailFailure(
                destinatario,
                'Soportes de Facturación',
                'Notificación de Rechazo',
                error instanceof Error ? error : undefined
            )

            return false
        }
    },

    /**
     * Enviar notificación de radicación exitosa
     */
    async enviarNotificacionRadicacionExitosa(
        destinatario: string,
        radicado: string,
        datosRadicacion: {
            eps: string
            regimen: string
            servicioPrestado: string
            fechaAtencion: string
            pacienteNombre: string
            pacienteIdentificacion: string
            archivos: { categoria: string; urls: string[] }[]
            onedriveFolderUrl?: string
        }
    ): Promise<boolean> {
        try {
            const response = await fetch('/api/send-radicacion-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinatario,
                    radicado,
                    datosRadicacion
                })
            })

            if (!response.ok) {
                console.error('Error en respuesta del servidor:', await response.text())
                return false
            }

            const result = await response.json()
            return result.success
        } catch (error) {
            console.error('Error enviando correo de confirmación:', error)

            // Notificar error crítico al equipo técnico
            await criticalErrorService.reportEmailFailure(
                destinatario,
                'Soportes de Facturación',
                'Confirmación de Radicación',
                error instanceof Error ? error : undefined
            )

            return false
        }
    }
}
