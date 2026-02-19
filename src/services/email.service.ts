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
                headers: await getEdgeFunctionHeaders(),
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
                headers: await getEdgeFunctionHeaders(),
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
            fechaRadicacion?: string
            radicadorEmail?: string
        }
    ): Promise<boolean> {
        try {
            const response = await fetch(EDGE_FUNCTIONS.sendEmail, {
                method: 'POST',
                headers: await getEdgeFunctionHeaders(),
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
                headers: await getEdgeFunctionHeaders(),
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
                headers: await getEdgeFunctionHeaders(),
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
     * Descarga el PDF de autorización y lo adjunta al correo
     */
    async enviarNotificacionAprobacionRecobro(
        destinatario: string,
        consecutivo: string,
        datosRecobro: {
            pacienteNombre: string
            pacienteId: string
            pacienteTipoId?: string
            cupsData: { cups: string; descripcion: string; cantidad: number; es_principal: boolean }[]
            pdfUrl?: string
        }
    ): Promise<boolean> {
        try {
            // Preparar adjuntos si hay PDF
            const adjuntos: { filename: string; content: string; mimeType: string }[] = []

            if (datosRecobro.pdfUrl) {
                try {
                    console.log('[EmailService] Descargando carta de autorización...')
                    const response = await fetch(datosRecobro.pdfUrl)

                    if (response.ok) {
                        const blob = await response.blob()
                        const arrayBuffer = await blob.arrayBuffer()
                        const base64 = btoa(
                            new Uint8Array(arrayBuffer)
                                .reduce((data, byte) => data + String.fromCharCode(byte), '')
                        )

                        adjuntos.push({
                            filename: `Carta_Autorizacion_${consecutivo}.pdf`,
                            content: base64,
                            mimeType: 'application/pdf'
                        })
                        console.log('[EmailService] Carta de autorización preparada para adjuntar')
                    } else {
                        console.warn('[EmailService] No se pudo descargar la carta de autorización')
                    }
                } catch (err) {
                    console.error('[EmailService] Error descargando carta de autorización:', err)
                    // Continuar sin adjunto
                }
            }

            const datos = {
                pacienteNombre: datosRecobro.pacienteNombre,
                pacienteIdentificacion: datosRecobro.pacienteId,
                pacienteTipoId: datosRecobro.pacienteTipoId || 'CC',
                cupsData: datosRecobro.cupsData,
                pdfUrl: datosRecobro.pdfUrl,
                fechaAprobacion: new Date().toLocaleString('es-CO'),
            }

            console.log(`[EmailService] Enviando notificación de recobro aprobado con ${adjuntos.length} adjunto(s)`)

            const response = await fetch(EDGE_FUNCTIONS.sendEmail, {
                method: 'POST',
                headers: await getEdgeFunctionHeaders(),
                body: JSON.stringify({
                    type: 'aprobacion_recobro',
                    destinatario,
                    radicado: consecutivo,
                    datos,
                    adjuntos: adjuntos.length > 0 ? adjuntos : undefined
                })
            })

            if (!response.ok) {
                console.error('[EmailService] Error en respuesta del servidor:', await response.text())
                return false
            }

            const result = await response.json()

            if (result.success) {
                console.log(`[EmailService] ✅ Notificación de recobro aprobado enviada: ${consecutivo}`)
            }

            return result.success
        } catch (error) {
            console.error('[EmailService] Error enviando correo de aprobación de recobro:', error)

            // Notificar error crítico
            await criticalErrorService.reportEmailFailure(
                destinatario,
                'Gestión de Recobros',
                'Notificación de Aprobación',
                error instanceof Error ? error : undefined
            )

            return false
        }
    },

    /**
     * Enviar notificación de activación de ruta (Enrutado)
     * @param destinatarios Array de correos principales
     * @param copias Array de correos en copia (CC)
     * @param radicado Número del radicado
     * @param datosCaso Datos del caso y paciente
     * @param archivosUrls URLs de los archivos para descargar y adjuntar
     */
    /**
     * Enviar notificación al radicador cuando fallan subidas de archivos
     * Le indica qué archivos no se pudieron subir para que reintente
     */
    async enviarNotificacionFalloSubida(
        destinatario: string,
        radicado: string,
        datosFallo: {
            archivosFallidos: { categoria: string; nombres: string[] }[]
            archivosExitosos: number
            totalArchivos: number
            timestamp: string
        }
    ): Promise<boolean> {
        try {
            const response = await fetch(EDGE_FUNCTIONS.sendEmail, {
                method: 'POST',
                headers: await getEdgeFunctionHeaders(),
                body: JSON.stringify({
                    type: 'fallo_subida',
                    destinatario,
                    radicado,
                    datos: datosFallo
                })
            })

            if (!response.ok) {
                console.error('[EmailService] Error enviando notificación de fallo de subida:', await response.text())
                return false
            }

            const result = await response.json()
            return result.success
        } catch (error) {
            console.error('[EmailService] Error enviando correo de fallo de subida:', error)

            await criticalErrorService.reportEmailFailure(
                destinatario,
                'Soportes de Facturación',
                'Notificación de Fallo de Subida',
                error instanceof Error ? error : undefined
            )

            return false
        }
    },

    async enviarNotificacionEnrutado(
        destinatarios: string[],
        copias: string[],
        radicado: string,
        datosCaso: {
            pacienteNombre: string
            pacienteIdentificacion: string
            pacienteTipoId: string
            eps: string
            ipsPrimaria: string
            ruta: string
            telefono?: string
            direccion?: string
            municipio?: string
            fechaRadicacion: string
            observaciones?: string
        },
        archivosUrls: string[] = []
    ): Promise<boolean> {
        try {
            // Descargar archivos y convertir a base64 para adjuntos MIME
            const adjuntos: { filename: string; content: string; mimeType: string }[] = []

            for (let i = 0; i < archivosUrls.length; i++) {
                const url = archivosUrls[i]
                try {
                    console.log(`[EmailService] Descargando archivo ${i + 1}/${archivosUrls.length}...`)
                    const response = await fetch(url)

                    if (!response.ok) {
                        console.warn(`[EmailService] No se pudo descargar archivo: ${url}`)
                        continue
                    }

                    const blob = await response.blob()
                    const arrayBuffer = await blob.arrayBuffer()
                    const base64 = btoa(
                        new Uint8Array(arrayBuffer)
                            .reduce((data, byte) => data + String.fromCharCode(byte), '')
                    )

                    // Determinar extensión y mimeType
                    const urlPath = new URL(url).pathname
                    const extension = urlPath.split('.').pop()?.toLowerCase() || 'pdf'
                    const mimeType = extension === 'pdf' ? 'application/pdf'
                        : extension === 'png' ? 'image/png'
                        : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
                        : 'application/octet-stream'

                    adjuntos.push({
                        filename: `Soporte_${radicado}_${i + 1}.${extension}`,
                        content: base64,
                        mimeType
                    })

                    console.log(`[EmailService] Archivo ${i + 1} preparado: ${adjuntos[adjuntos.length - 1].filename}`)
                } catch (err) {
                    console.error(`[EmailService] Error descargando archivo ${i + 1}:`, err)
                    // Continuar con los demás archivos
                }
            }

            const datos = {
                ...datosCaso,
                // Incluir URLs como respaldo si falló la descarga de algún archivo
                archivosUrls: adjuntos.length < archivosUrls.length ? archivosUrls : undefined
            }

            console.log(`[EmailService] Enviando notificación enrutado a ${destinatarios.length} destinatario(s) con ${adjuntos.length} adjunto(s)`)

            const response = await fetch(EDGE_FUNCTIONS.sendEmail, {
                method: 'POST',
                headers: await getEdgeFunctionHeaders(),
                body: JSON.stringify({
                    type: 'enrutado',
                    destinatario: destinatarios,
                    cc: copias.length > 0 ? copias : undefined,
                    radicado,
                    datos,
                    adjuntos: adjuntos.length > 0 ? adjuntos : undefined
                })
            })

            if (!response.ok) {
                const errorText = await response.text()
                console.error('[EmailService] Error en respuesta del servidor:', errorText)
                return false
            }

            const result = await response.json()

            if (result.success) {
                console.log(`[EmailService] ✅ Notificación de enrutado enviada exitosamente para radicado: ${radicado}`)
            }

            return result.success
        } catch (error) {
            console.error('[EmailService] Error enviando correo de enrutado:', error)

            // Notificar error crítico al equipo técnico
            await criticalErrorService.reportEmailFailure(
                destinatarios.join(', '),
                'BACK - Activación de Ruta',
                `Notificación de Enrutado - Ruta: ${datosCaso.ruta}`,
                error instanceof Error ? error : undefined
            )

            return false
        }
    }
}
