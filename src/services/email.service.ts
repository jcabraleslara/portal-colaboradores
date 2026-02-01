/**
 * Servicio de Correo
 * Portal de Colaboradores - Gestar Salud IPS
 *
 * Utiliza Supabase Edge Functions para enviar correos de forma segura.
 * Las credenciales OAuth2 estan protegidas en el backend.
 */

import { criticalErrorService } from './criticalError.service'
import { EDGE_FUNCTIONS, getEdgeFunctionHeaders } from '@/config/api.config'

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
            // Mapear a formato esperado por el endpoint de devolucion
            const datos = {
                eps: datosCaso['EPS'] || '',
                regimen: datosCaso['Régimen'] || '',
                servicioPrestado: datosCaso['Servicio'] || '',
                fechaAtencion: datosCaso['Fecha de Atención'] || '',
                pacienteNombre: datosCaso['Paciente'] || '',
                pacienteIdentificacion: datosCaso['Identificación'] || '',
                pacienteTipoId: datosCaso['Tipo ID'] || '',
                archivos: [],
                fechaRadicacion: new Date().toISOString(),
                observacionesDevolucion: motivo,
                tipoSolicitud: datosCaso['Tipo Solicitud'] || ''
            }

            const response = await fetch(EDGE_FUNCTIONS.sendEmail, {
                method: 'POST',
                headers: getEdgeFunctionHeaders(),
                body: JSON.stringify({
                    type: 'devolucion',
                    destinatario,
                    radicado,
                    datos
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
            const datos = {
                ...datosRadicacion,
                observacionesFacturacion
            }

            const response = await fetch(EDGE_FUNCTIONS.sendEmail, {
                method: 'POST',
                headers: getEdgeFunctionHeaders(),
                body: JSON.stringify({
                    type: 'rechazo',
                    destinatario,
                    radicado,
                    datos
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
            const response = await fetch(EDGE_FUNCTIONS.sendEmail, {
                method: 'POST',
                headers: getEdgeFunctionHeaders(),
                body: JSON.stringify({
                    type: 'radicacion',
                    destinatario,
                    radicado,
                    datos: datosRadicacion
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
    },

    /**
     * Enviar notificación de "No Contactable"
     * Se usa cuando el gestor no logra comunicarse con el paciente.
     */
    async enviarNotificacionNoContactable(
        destinatario: string,
        radicado: string,
        datosCaso: Record<string, string>
    ): Promise<boolean> {
        try {
            const datos = {
                pacienteNombre: datosCaso['Paciente'] || '',
                pacienteIdentificacion: datosCaso['Identificación'] || '',
                radicado: radicado,
                fechaGestion: new Date().toLocaleString('es-CO'),
            }

            const response = await fetch(EDGE_FUNCTIONS.sendEmail, {
                method: 'POST',
                headers: getEdgeFunctionHeaders(),
                body: JSON.stringify({
                    type: 'no_contactable',
                    destinatario,
                    radicado,
                    datos
                })
            })

            if (!response.ok) {
                console.error('Error en respuesta del servidor:', await response.text())
                return false
            }

            const result = await response.json()
            return result.success
        } catch (error) {
            console.error('Error enviando correo de no contactable:', error)

            // Notificar error crítico
            await criticalErrorService.reportEmailFailure(
                destinatario,
                'BACK - No Contactable',
                'Notificación de No Contactable',
                error instanceof Error ? error : undefined
            )

            return false
        }
    },

    /**
     * Enviar notificación de devolución de recobro
     */
    async enviarNotificacionDevolucionRecobro(
        destinatario: string,
        consecutivo: string,
        respuestaAuditor: string,
        datosRecobro: {
            pacienteNombre: string
            pacienteId: string
            cupsData: { cups: string; descripcion: string; cantidad: number; es_principal: boolean }[]
        }
    ): Promise<boolean> {
        try {
            const datos = {
                pacienteNombre: datosRecobro.pacienteNombre,
                pacienteIdentificacion: datosRecobro.pacienteId,
                cupsData: datosRecobro.cupsData,
                respuestaAuditor,
                fechaDevolucion: new Date().toLocaleString('es-CO'),
            }

            const response = await fetch(EDGE_FUNCTIONS.sendEmail, {
                method: 'POST',
                headers: getEdgeFunctionHeaders(),
                body: JSON.stringify({
                    type: 'devolucion_recobro',
                    destinatario,
                    radicado: consecutivo,
                    datos
                })
            })

            if (!response.ok) {
                console.error('Error en respuesta del servidor:', await response.text())
                return false
            }

            const result = await response.json()
            return result.success
        } catch (error) {
            console.error('Error enviando correo de devolución de recobro:', error)

            // Notificar error crítico
            await criticalErrorService.reportEmailFailure(
                destinatario,
                'Gestión de Recobros',
                'Notificación de Devolución',
                error instanceof Error ? error : undefined
            )

            return false
        }
    },

    /**
     * Enviar notificación de aprobación de recobro
     */
    async enviarNotificacionAprobacionRecobro(
        destinatario: string,
        consecutivo: string,
        datosRecobro: {
            pacienteNombre: string
            pacienteId: string
            cupsData: { cups: string; descripcion: string; cantidad: number; es_principal: boolean }[]
            pdfUrl?: string
        }
    ): Promise<boolean> {
        try {
            const datos = {
                pacienteNombre: datosRecobro.pacienteNombre,
                pacienteIdentificacion: datosRecobro.pacienteId,
                cupsData: datosRecobro.cupsData,
                pdfUrl: datosRecobro.pdfUrl,
                fechaAprobacion: new Date().toLocaleString('es-CO'),
            }

            const response = await fetch(EDGE_FUNCTIONS.sendEmail, {
                method: 'POST',
                headers: getEdgeFunctionHeaders(),
                body: JSON.stringify({
                    type: 'aprobacion_recobro',
                    destinatario,
                    radicado: consecutivo,
                    datos
                })
            })

            if (!response.ok) {
                console.error('Error en respuesta del servidor:', await response.text())
                return false
            }

            const result = await response.json()
            return result.success
        } catch (error) {
            console.error('Error enviando correo de aprobación de recobro:', error)

            // Notificar error crítico
            await criticalErrorService.reportEmailFailure(
                destinatario,
                'Gestión de Recobros',
                'Notificación de Aprobación',
                error instanceof Error ? error : undefined
            )

            return false
        }
    }
}
