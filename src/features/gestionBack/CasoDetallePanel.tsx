/**
 * Panel de Detalle de Caso
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import {
    X,
    Save,
    ArrowRight,
    FileText,
    User,
    MapPin,
    Building,
    Mail,
    Calendar,
    MessageSquare,
    AlertCircle,
    ExternalLink,
    Maximize2,
    Minimize2,
    ChevronLeft,
    ChevronRight,
    Trash2,
    AlertTriangle,
    Stethoscope,
    Activity,
    FileSignature,
    BookOpen,
    FileEdit,
    Zap,
    Route,
    Loader2,
    Sparkles,
    Copy,
    Check,
    Phone,
    Clock,
    ArrowLeftRight,
    Undo2,
    CheckCircle,
    Hourglass,
    PhoneOff,
    RefreshCw,

    ExternalLink as LinkIcon,
    Image as ImageIcon
} from 'lucide-react'
import { Button, RichTextEditor } from '@/components/common'
import { copyRichText } from '@/utils/clipboard'
import { isMobileOrTablet } from '@/utils/device.utils'
import { backService } from '@/services/back.service'
import { emailService } from '@/services/email.service'
import { teamsService } from '@/services/teams.service'
import { rutasService } from '@/features/rutas/services/rutas.service'
import { generarContrarreferenciaAutomatica } from '@/services/contrarreferenciaService'
import { useAuth } from '@/context/AuthContext'
import {
    BackRadicacionExtendido,
    ESTADO_COLORES,
    ESTADOS_RADICADO_LISTA,
    DIRECCIONAMIENTO_LISTA,
    EstadoRadicado,
    Direccionamiento,
    TIPO_SOLICITUD_COLORES,
    TIPOS_SOLICITUD_LISTA,
    RutaBack,
    RUTAS_CONFIG,
    RUTA_COLORES
} from '@/types/back.types'

interface CasoDetallePanelProps {
    caso: BackRadicacionExtendido
    onClose: () => void
    onGuardarYCerrar: () => void
    onGuardarYSiguiente: (datosActualizados?: Partial<BackRadicacionExtendido>) => void
    onGuardarYSiguientePdf?: (datosActualizados?: Partial<BackRadicacionExtendido>) => void
    onCasoEliminado: () => void
    haySiguiente: boolean
    onAnterior: () => void
    onSiguiente: () => void
    hayAnterior: boolean
    autoAbrirPdf?: boolean
}

// Configuración visual para Direccionamiento
const DIRECCIONAMIENTO_CONFIG: Record<string, { bg: string, text: string, border: string }> = {
    'Médico Experto': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    'Médico Especialista': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    'Nueva EPS': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
}
const DEFAULT_DIR_STYLE = { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }

// Mapa de iconos para tipos de solicitud
const TIPO_ICONOS: Record<string, any> = {
    'Auditoría Médica': Stethoscope,
    'Solicitud de Historia Clínica': BookOpen,
    'Ajuste de Ordenamiento': FileEdit,
    'Renovación de prequirúrgicos': Activity,
    'Ordenamientos externos': FileSignature,
    'Gestión de Mipres': Zap,
    'Activación de Ruta': Route,
}

// Mapa de iconos para estados
const ESTADO_ICONOS: Record<string, any> = {
    'Pendiente': Clock,
    'Contrarreferido': ArrowLeftRight,
    'Devuelto': Undo2,
    'Gestionado': CheckCircle,
    'Autorizado': Check,
    'Enrutado': LinkIcon,
    'En espera': Hourglass,

    'No contactable': PhoneOff,
}

const capitalize = (text: string) => {
    if (!text) return ''
    return text.toLowerCase().replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });
}

export function CasoDetallePanel({
    caso,
    onClose,
    onGuardarYCerrar,
    onGuardarYSiguiente,
    onGuardarYSiguientePdf,
    onCasoEliminado,
    haySiguiente,
    onAnterior,
    onSiguiente,
    hayAnterior,
    autoAbrirPdf,
}: CasoDetallePanelProps) {
    // ============================================
    // ESTADO
    // ============================================

    // Autenticación
    const { user } = useAuth()

    // Campos editables
    const [direccionamiento, setDireccionamiento] = useState<Direccionamiento | ''>(
        (caso.direccionamiento as Direccionamiento) || ''
    )
    const [respuestaBack, setRespuestaBack] = useState(
        (caso.respuestaBack && caso.respuestaBack !== 'NaN') ? caso.respuestaBack : ''
    )
    const [estadoRadicado, setEstadoRadicado] = useState<EstadoRadicado>(
        caso.estadoRadicado || 'Pendiente'
    )
    const [tipoSolicitud, setTipoSolicitud] = useState<string>(caso.tipoSolicitud) // Nuevo estado
    const [rutaSeleccionada, setRutaSeleccionada] = useState<RutaBack | null>(caso.ruta) // Nuevo estado para Ruta

    // ============================================
    // LOGIC HANDLERS
    // ============================================

    const handleTipoSolicitudChange = (nuevoTipo: string) => {
        setTipoSolicitud(nuevoTipo)

        // Validar estados no permitidos al cambiar tipo
        if (nuevoTipo === 'Auditoría Médica') {
            // 'Gestionado' no debe estar visible en Auditoría
            if (estadoRadicado === 'Gestionado') {
                setEstadoRadicado('Pendiente')
            }
        } else {
            // 'Autorizado' no debe estar visible en otros tipos
            if (estadoRadicado === 'Autorizado') {
                setEstadoRadicado('Pendiente')
            }
            // Direccionamiento solo para Auditoría, limpiar si cambiamos
            setDireccionamiento('')
        }
    }

    const handleDireccionamientoChange = (nuevoDir: Direccionamiento) => {
        // Toggle: Si ya está seleccionado, lo quitamos y volvemos a pendiente
        if (direccionamiento === nuevoDir) {
            setDireccionamiento('')
            setEstadoRadicado('Pendiente')
            return
        }

        setDireccionamiento(nuevoDir)

        if (nuevoDir === 'Médico Experto' || nuevoDir === 'Médico Especialista') {
            setEstadoRadicado('Autorizado')
        } else if (nuevoDir === 'Nueva EPS') {
            setEstadoRadicado('Enrutado')
        }
    }

    const handleEstadoRadicadoChange = (nuevoEstado: EstadoRadicado) => {
        setEstadoRadicado(nuevoEstado)

        // "No puede haber direccionamiento con estados distintos a esos dos (Autorizado y enrutado)"
        if (direccionamiento) {
            const esCompatibleConAutorizado = (direccionamiento === 'Médico Experto' || direccionamiento === 'Médico Especialista') && nuevoEstado === 'Autorizado'
            const esCompatibleConEnrutado = (direccionamiento === 'Nueva EPS') && nuevoEstado === 'Enrutado'

            if (!esCompatibleConAutorizado && !esCompatibleConEnrutado) {
                setDireccionamiento('')
            }
        }

        // Cuando se selecciona "Enrutado", establecer ruta predeterminada si no hay una
        if (nuevoEstado === 'Enrutado' && !rutaSeleccionada) {
            // Si es Auditoría Médica, predeterminar "Autoinmune"
            if (tipoSolicitud === 'Auditoría Médica') {
                setRutaSeleccionada('Autoinmune')
            }
        }
    }

    const handleRespuestaBackChange = (valor: string) => {
        setRespuestaBack(valor)

        // Si contiene la palabra clave 'CONTRA REFERENCIA', cambiar estado a 'Contrarreferido' de forma automática
        if (valor.toUpperCase().includes('CONTRA REFERENCIA')) {
            setEstadoRadicado('Contrarreferido')
        } else if (valor.toUpperCase().includes('IMAGEN/DOC')) {
            // Si contiene 'IMAGEN/DOC', cambiar estado a 'Gestionado'
            setEstadoRadicado('Gestionado')
        }
    }

    // Handler para generar contrarreferencia con IA
    const handleGenerarContrarreferencia = async (forceRegenerate = false) => {
        setGenerandoContrarreferencia(true)
        setErrorGuardado(null)
        setMensajeProgreso('Analizando documento...')

        try {
            // Obtener el primer soporte (PDF)
            const pdfUrl = caso.soportes?.[0]
            if (!pdfUrl) {
                setErrorGuardado('No hay soporte adjunto para generar contrarreferencia')
                setGenerandoContrarreferencia(false)
                setMensajeProgreso('')
                return
            }

            console.log('[UI] Iniciando generación de contrarreferencia...')

            // Simulador de progreso para mejor UX
            const intervalos = [
                setTimeout(() => setMensajeProgreso('Procesando historia clínica...'), 1000),
                setTimeout(() => setMensajeProgreso('Evaluando criterios médicos...'), 3000),
                setTimeout(() => setMensajeProgreso('Generando respuesta de auditoría...'), 5000),
            ]

            const resultado = await generarContrarreferenciaAutomatica(
                caso.radicado,
                pdfUrl,
                caso.especialidad || undefined,
                forceRegenerate
            )

            // Limpiar timeouts
            intervalos.forEach(clearTimeout)

            if (resultado.success && resultado.texto) {
                // Mostrar feedback según el método
                if (resultado.metodo === 'cache') {
                    console.log(`[UI] ✅ Contrarreferencia obtenida desde caché en ${resultado.tiempoMs}ms`)
                    setMensajeProgreso('✓ Cargado desde caché')
                } else {
                    console.log(`[UI] ✅ Contrarreferencia generada en ${resultado.tiempoMs}ms (${resultado.metodo})`)
                    setMensajeProgreso('✓ Contrarreferencia generada')
                }

                // Actualizar el campo respuesta_back (esto también activará auto-cambio de estado)
                handleRespuestaBackChange(resultado.texto)
            } else {
                console.error('[UI] Error en generación:', resultado.error)

                // Mensaje específico para error 429 con tiempo de espera
                if (resultado.retryAfter) {
                    setErrorGuardado(
                        `⏳ Límite de solicitudes alcanzado. Por favor espera ${resultado.retryAfter} segundos antes de reintentar.`
                    )
                } else {
                    setErrorGuardado(resultado.error || 'Error al generar contrarreferencia')
                }
            }
        } catch (error) {
            console.error('[UI] Excepción al generar contrarreferencia:', error)
            setErrorGuardado('Error inesperado al generar contrarreferencia')
        } finally {
            setGenerandoContrarreferencia(false)
            setMensajeProgreso('')
        }
    }

    // Estado de guardado / eliminación
    const [guardando, setGuardando] = useState(false)
    const [guardadoExitoso, setGuardadoExitoso] = useState(false)
    const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
    const [mostandoConfirmacionEliminar, setMostandoConfirmacionEliminar] = useState(false)
    const [eliminando, setEliminando] = useState(false)

    // Estado de generación de contrarreferencia con IA
    const [generandoContrarreferencia, setGenerandoContrarreferencia] = useState(false)
    const [mensajeProgreso, setMensajeProgreso] = useState<string>('')

    // Visor de PDF
    const [pdfActivo, setPdfActivo] = useState<string | null>(null)
    const [indicePdf, setIndicePdf] = useState(0)
    const [pdfFullscreen, setPdfFullscreen] = useState(false)

    // Estado para animación de copia
    const [copiandoRespuesta, setCopiandoRespuesta] = useState(false)

    // Referencia para gestión de foco en PDF modal
    const pdfContainerRef = useRef<HTMLDivElement>(null)

    // Ref para saber si al guardar y siguiente se debe abrir el PDF
    const abrirPdfAlSiguiente = useRef(false)

    // Auto-abrir PDF cuando se navega con "Guardar y Siguiente PDF"
    useEffect(() => {
        if (autoAbrirPdf && caso.soportes?.length) {
            const timer = setTimeout(() => {
                handleAbrirPdf(caso.soportes![0], 0)
            }, 200)
            return () => clearTimeout(timer)
        }
    }, [caso.radicado, autoAbrirPdf])

    // Focus trap para el visor PDF: cuando el iframe roba el foco (cross-origin),
    // los eventos de teclado no llegan al contenedor padre. Este intervalo refoca
    // el contenedor para que ESC siempre funcione. El scroll del PDF sigue funcionando
    // porque no requiere foco en el iframe.
    useEffect(() => {
        if (!pdfActivo || !pdfContainerRef.current) return

        // Foco inicial
        setTimeout(() => pdfContainerRef.current?.focus(), 50)

        const interval = setInterval(() => {
            const active = document.activeElement
            if (active?.tagName === 'IFRAME' && pdfContainerRef.current) {
                pdfContainerRef.current.focus()
            }
        }, 200)

        return () => clearInterval(interval)
    }, [pdfActivo])

    // ============================================
    // HANDLERS
    // ============================================

    const handleGuardar = useCallback(async (cerrar: boolean) => {
        setGuardando(true)
        setErrorGuardado(null)
        setGuardadoExitoso(false)

        // Validación para estado Devuelto
        if (estadoRadicado === 'Devuelto') {
            if (!respuestaBack || respuestaBack.trim() === '') {
                setErrorGuardado('Para devolver el caso, debe ingresar una Respuesta Auditoría / Back explicando el motivo.')
                setGuardando(false)
                return
            }

            // Enviar correo de notificación
            // Asumimos que correo_radicador viene en el objeto (agregado recientemente)
            // Si no hay correo, mostramos advertencia o procedemos? 
            // El requerimiento dice: "se debe enviar un correo... al correo del radicador".
            // Si no hay correo, no podemos cumplir.

            if (caso.emailRadicador) {
                try {
                    const datosCaso = {
                        'Radicado': caso.radicado,
                        'Paciente': getNombreCompleto(),
                        'Identificación': `${caso.paciente?.tipoId || ''} - ${caso.id}`,
                        'Tipo Solicitud': tipoSolicitud, // Usar estado actualizado
                        'Fecha Creación': formatFecha(caso.createdAt),
                        'Ordenador': caso.ordenador || 'N/A'
                    }

                    const emailEnviado = await emailService.enviarNotificacionDevolucion(
                        caso.emailRadicador,
                        caso.radicado,
                        respuestaBack,
                        datosCaso
                    )

                    if (!emailEnviado) {
                        console.warn("No se pudo enviar el correo de notificación")
                        toast.error("No se pudo enviar el correo de notificación al radicador")
                    } else {
                        console.info(`✅ Correo de notificación enviado exitosamente a: ${caso.emailRadicador} (Radicado: ${caso.radicado})`)
                        toast.success(`Correo enviado exitosamente a ${caso.emailRadicador}`)
                    }
                } catch (e) {
                    console.error("Error enviando email", e)
                    toast.error("Ocurrió un error al intentar enviar el correo")
                }
            } else {
                console.warn("El radicador no tiene correo registrado, no se envió notificación.")
            }

            // Notificación a Teams para la líder back (en paralelo, no bloquea)
            teamsService.notificarDevolucionBack({
                radicado: caso.radicado,
                paciente: getNombreCompleto(),
                identificacion: `${caso.paciente?.tipoId || 'CC'} - ${caso.id}`,
                tipoSolicitud: tipoSolicitud,
                fechaRadicacion: formatFecha(caso.createdAt),
                radicador: caso.nombreRadicador || caso.radicador || 'No registrado',
                motivoDevolucion: respuestaBack
            }).then(result => {
                if (result.success) {
                    console.info(`✅ Notificación Teams enviada para radicado: ${caso.radicado}`)
                } else {
                    console.warn(`⚠️ No se pudo enviar notificación Teams: ${result.error}`)
                }
            }).catch(err => {
                console.error('Error enviando notificación Teams:', err)
            })
        }

        // Validación para estado "No contactable"
        if (estadoRadicado === 'No contactable') {
            if (caso.emailRadicador) {
                try {
                    const datosCaso = {
                        'Paciente': getNombreCompleto(),
                        'Identificación': `${caso.paciente?.tipoId || ''} - ${caso.id}`,
                    }

                    const emailEnviado = await emailService.enviarNotificacionNoContactable(
                        caso.emailRadicador,
                        caso.radicado,
                        datosCaso
                    )

                    if (!emailEnviado) {
                        console.warn("No se pudo enviar el correo de notificación No contactable")
                        toast.error("No se pudo enviar el correo de notificación al radicador")
                    } else {
                        console.info(`✅ Correo No Contactable enviado a: ${caso.emailRadicador}`)
                        toast.success(`Notificación enviada a ${caso.emailRadicador}`)
                    }
                } catch (e) {
                    console.error("Error enviando email No Contactable", e)
                    toast.error("Ocurrió un error al intentar enviar el correo")
                }
            } else {
                console.warn("El radicador no tiene correo registrado, no se envió notificación No Contactable.")
                toast.warning("El radicador no tiene correo, no se pudo enviar notificación.")
            }
        }

        // Validación para estado "Enrutado" - Activación de Ruta
        if (estadoRadicado === 'Enrutado') {
            // Validar que haya una ruta seleccionada
            if (!rutaSeleccionada) {
                setErrorGuardado('Debes seleccionar una ruta para poder enrutar el caso.')
                setGuardando(false)
                return
            }
        }

        // Capturar datos necesarios para notificación ANTES de cambiar estado
        const debeNotificarEnrutado = estadoRadicado === 'Enrutado' && rutaSeleccionada
        const datosParaNotificacion = debeNotificarEnrutado ? {
            radicado: caso.radicado,
            rutaSeleccionada,
            eps: caso.paciente?.eps || '',
            ipsPrimaria: caso.paciente?.ipsPrimaria || '',
            pacienteNombre: getNombreCompleto(),
            pacienteIdentificacion: caso.id,
            pacienteTipoId: caso.paciente?.tipoId || 'CC',
            telefono: caso.paciente?.telefono || undefined,
            direccion: caso.paciente?.direccion || undefined,
            municipio: caso.paciente?.municipio || undefined,
            fechaRadicacion: caso.createdAt.toISOString(),
            observaciones: caso.observaciones || undefined,
            soportes: caso.soportes || []
        } : null

        const result = await backService.actualizarCaso(caso.radicado, {
            direccionamiento: direccionamiento || null,
            respuesta_back: respuestaBack || null,
            estado_radicado: estadoRadicado,
            tipo_solicitud: tipoSolicitud,
            ruta: rutaSeleccionada, // Enviar ruta actualizada (puede ser 'Imágenes' u otra)
            usuario_respuesta: user?.nombreCompleto || 'Usuario del Sistema'
        })

        setGuardando(false)

        if (result.success) {
            setGuardadoExitoso(true)

            // Enviar notificación de enrutado en BACKGROUND (no bloquea la UI)
            if (debeNotificarEnrutado && datosParaNotificacion) {
                // Fire and forget - se ejecuta en background
                (async () => {
                    console.log(`[Enrutado-BG] Iniciando notificación en background para: ${datosParaNotificacion.radicado}`)
                    try {
                        const configResult = await rutasService.buscarDestinatariosEnrutado(
                            datosParaNotificacion.rutaSeleccionada,
                            datosParaNotificacion.eps,
                            datosParaNotificacion.ipsPrimaria
                        )

                        if (configResult.success && configResult.data) {
                            const { destinatarios, copias } = configResult.data

                            if (destinatarios.length > 0) {
                                const datosCaso = {
                                    pacienteNombre: datosParaNotificacion.pacienteNombre,
                                    pacienteIdentificacion: datosParaNotificacion.pacienteIdentificacion,
                                    pacienteTipoId: datosParaNotificacion.pacienteTipoId,
                                    eps: datosParaNotificacion.eps,
                                    ipsPrimaria: datosParaNotificacion.ipsPrimaria,
                                    ruta: datosParaNotificacion.rutaSeleccionada,
                                    telefono: datosParaNotificacion.telefono,
                                    direccion: datosParaNotificacion.direccion,
                                    municipio: datosParaNotificacion.municipio,
                                    fechaRadicacion: datosParaNotificacion.fechaRadicacion,
                                    observaciones: datosParaNotificacion.observaciones
                                }

                                const emailEnviado = await emailService.enviarNotificacionEnrutado(
                                    destinatarios,
                                    copias,
                                    datosParaNotificacion.radicado,
                                    datosCaso,
                                    datosParaNotificacion.soportes
                                )

                                if (emailEnviado) {
                                    console.info(`[Enrutado-BG] ✅ Notificación enviada: ${datosParaNotificacion.radicado}`)
                                    toast.success(`Notificación de ruta enviada a ${destinatarios.length} destinatario(s)`, { duration: 4000 })
                                } else {
                                    console.warn(`[Enrutado-BG] ❌ Falló envío: ${datosParaNotificacion.radicado}`)
                                    toast.error("No se pudo enviar la notificación de ruta")
                                }
                            } else {
                                console.warn(`[Enrutado-BG] Sin destinatarios para: ${datosParaNotificacion.rutaSeleccionada}`)
                                toast.warning("No hay destinatarios configurados para esta ruta/EPS")
                            }
                        } else {
                            console.warn(`[Enrutado-BG] Sin config para: ${datosParaNotificacion.rutaSeleccionada}`)
                            toast.warning("No hay configuración de notificaciones para esta ruta")
                        }
                    } catch (e) {
                        console.error("[Enrutado-BG] Error:", e)
                        toast.error("Error al enviar notificación de ruta")
                    }
                })()
            }

            setTimeout(() => {
                const datos = {
                    direccionamiento: direccionamiento || null,
                    respuestaBack: respuestaBack || null,
                    estadoRadicado: estadoRadicado,
                    tipoSolicitud: tipoSolicitud as any,
                    ruta: rutaSeleccionada,
                    usuarioRespuesta: user?.nombreCompleto || 'Usuario del Sistema'
                }
                if (cerrar) {
                    onGuardarYCerrar()
                } else if (abrirPdfAlSiguiente.current) {
                    abrirPdfAlSiguiente.current = false
                    ;(onGuardarYSiguientePdf || onGuardarYSiguiente)(datos)
                } else {
                    onGuardarYSiguiente(datos)
                }
            }, 300)
        } else {
            setErrorGuardado(result.error || 'Error al guardar')
        }
    }, [caso, direccionamiento, respuestaBack, estadoRadicado, tipoSolicitud, rutaSeleccionada, user, onGuardarYCerrar, onGuardarYSiguiente, onGuardarYSiguientePdf])

    const handleEliminar = useCallback(async () => {
        setEliminando(true)
        const result = await backService.eliminarCaso(caso.radicado)
        setEliminando(false)

        if (result.success) {
            onCasoEliminado()
            onClose()
        } else {
            setErrorGuardado(result.error || 'Error al eliminar')
            setMostandoConfirmacionEliminar(false)
        }
    }, [caso.radicado, onCasoEliminado, onClose])

    const handleAbrirPdf = useCallback(async (url: string, index: number) => {
        setIndicePdf(index)
        // Intentar refrescar la URL por si está expirada
        // Pasamos radicado e índice para intentar recuperación de respaldos
        const urlFresca = await backService.refrescarUrlSoporte(url, caso.radicado, index)

        // En móvil/tablet los navegadores no renderizan PDFs completos dentro de iframes,
        // solo muestran una vista previa de la primera página.
        // Abrimos directamente en nueva pestaña para usar el visor nativo del dispositivo.
        if (isMobileOrTablet()) {
            window.open(urlFresca, '_blank', 'noopener,noreferrer')
            return
        }

        setPdfActivo(urlFresca)
    }, [caso.radicado])

    const handleCerrarPdf = useCallback(() => {
        setPdfActivo(null)
        setPdfFullscreen(false)
    }, [])

    const handlePdfAnterior = useCallback(async () => {
        if (caso.soportes && indicePdf > 0) {
            const nuevoIndice = indicePdf - 1
            setIndicePdf(nuevoIndice)
            const url = caso.soportes[nuevoIndice]
            const urlFresca = await backService.refrescarUrlSoporte(url, caso.radicado, nuevoIndice)
            setPdfActivo(urlFresca)
        }
    }, [caso.soportes, indicePdf, caso.radicado])

    const handlePdfSiguiente = useCallback(async () => {
        if (caso.soportes && indicePdf < caso.soportes.length - 1) {
            const nuevoIndice = indicePdf + 1
            setIndicePdf(nuevoIndice)
            const url = caso.soportes[nuevoIndice]
            const urlFresca = await backService.refrescarUrlSoporte(url, caso.radicado, nuevoIndice)
            setPdfActivo(urlFresca)
        }
    }, [caso.soportes, indicePdf, caso.radicado])

    // ============================================
    // EFFECTS
    // ============================================

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignorar eventos si estamos en un input o textarea
            const target = e.target as HTMLElement
            const esInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

            if (e.key === 'ArrowLeft' && !esInput && hayAnterior && !pdfActivo) {
                onAnterior()
                return
            }

            if (e.key === 'ArrowRight' && !esInput && haySiguiente && !pdfActivo) {
                onSiguiente()
                return
            }

            if (e.key === 'Escape') {
                // Prioridad de cierre:
                // 1. Modal de confirmación de eliminar
                if (mostandoConfirmacionEliminar) {
                    setMostandoConfirmacionEliminar(false)
                    return
                }

                // 2. Visor de PDF (si está fullscreen o solo abierto)
                if (pdfFullscreen) {
                    setPdfFullscreen(false)
                    return
                }
                if (pdfActivo) {
                    handleCerrarPdf()
                    return
                }

                // 3. Cerrar el panel principal
                onClose()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose, mostandoConfirmacionEliminar, pdfActivo, pdfFullscreen, handleCerrarPdf, onAnterior, onSiguiente, hayAnterior, haySiguiente])

    // Sincronizar estado cuando el caso cambie (Navegación Siguiente/Anterior)
    useEffect(() => {
        // Resetear todos los estados editables al valor del nuevo caso
        setDireccionamiento((caso.direccionamiento as Direccionamiento) || '')
        setRespuestaBack((caso.respuestaBack && caso.respuestaBack !== 'NaN') ? caso.respuestaBack : '')
        setEstadoRadicado(caso.estadoRadicado || 'Pendiente')
        setTipoSolicitud(caso.tipoSolicitud || 'Auditoría Médica')
        setRutaSeleccionada(caso.ruta || null)

        // Resetear estados de UI
        setGuardadoExitoso(false)
        setErrorGuardado(null)
        setPdfActivo(null)
        setIndicePdf(0)
        setCopiandoRespuesta(false)
    }, [caso]) // Dependencia del objeto caso completo para detectar cualquier cambio


    // ============================================
    // HELPERS
    // ============================================

    const getNombreCompleto = () => {
        if (!caso.paciente) return 'Sin datos del paciente'
        const nombre = [caso.paciente.nombres, caso.paciente.apellido1, caso.paciente.apellido2]
            .filter(Boolean)
            .join(' ')

        return nombre || 'Nombre No Disponible'
    }

    const formatFecha = (fecha: Date) => {
        return new Intl.DateTimeFormat('es-CO', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        }).format(fecha)
    }

    const estadoColor = ESTADO_COLORES[estadoRadicado] || ESTADO_COLORES['Pendiente']
    const tipoSolicitudConfig = TIPO_SOLICITUD_COLORES[tipoSolicitud] || TIPO_SOLICITUD_COLORES['Auditoría Médica']
    const IconoTipo = TIPO_ICONOS[tipoSolicitud] || FileText

    // Extraer FUM y calcular Edad Gestacional al día
    const getDatosMaternidad = () => {
        if (!caso.observaciones || typeof caso.observaciones !== 'string') {
            return null
        }

        const match = caso.observaciones.match(/\[DATOS MATERNIDAD\] FUM: (\d{4}-\d{2}-\d{2})/)
        const fumStr = match ? match[1] : null

        if (!fumStr) return null

        // Calcular edad gestacional actual
        const partes = fumStr.split('-')
        const dia = parseInt(partes[2])
        const mes = parseInt(partes[1]) - 1
        const anio = parseInt(partes[0])

        const fechaFum = new Date(anio, mes, dia)
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        fechaFum.setHours(0, 0, 0, 0)

        let edadGestacional = 'Fecha inválida'

        if (fechaFum <= hoy) {
            const diffTime = Math.abs(hoy.getTime() - fechaFum.getTime())
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            const semanas = Math.floor(diffDays / 7)
            const dias = diffDays % 7
            edadGestacional = `${semanas} Semanas y ${dias} Días`
        }

        return { fum: fumStr, edadGestacional }
    }

    const datosMaternidad = getDatosMaternidad()

    // ============================================
    // RENDER
    // ============================================

    return createPortal(
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Panel lateral */}
            <div className="fixed right-0 top-0 z-50 h-full w-full max-w-5xl bg-white shadow-2xl animate-slide-in-right overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                    <div className="flex items-start justify-between">
                        <div className="w-full">
                            <h2 className="text-2xl font-bold text-gray-800 break-words leading-tight">
                                {getNombreCompleto()}
                            </h2>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-sm font-mono bg-white px-2 py-1 rounded border border-gray-200">
                                    Radicado: <strong>{caso.radicado}</strong>
                                </span>
                                <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${estadoColor.bg} ${estadoColor.text}`}>
                                    {estadoRadicado}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Navegación entre casos */}
                            <div className="flex items-center bg-white/60 rounded-lg p-1 border border-indigo-100/50 shadow-sm mr-2">
                                <button
                                    onClick={onAnterior}
                                    disabled={!hayAnterior}
                                    title="Caso Anterior (Flecha Izquierda)"
                                    className="p-1.5 rounded-md hover:bg-white hover:shadow-sm text-gray-400 hover:text-[var(--color-primary)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <div className="w-px h-4 bg-gray-200/80 mx-1"></div>
                                <button
                                    onClick={onSiguiente}
                                    disabled={!haySiguiente}
                                    title="Caso Siguiente (Flecha Derecha)"
                                    className="p-1.5 rounded-md hover:bg-white hover:shadow-sm text-gray-400 hover:text-[var(--color-primary)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>

                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-white/80 transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Contenido scrolleable */}
                <div className="flex-1 overflow-y-auto p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 min-h-full">
                    {/* ====== COLUMNA IZQUIERDA: Info del caso ====== */}
                    <div className="space-y-4 min-w-0">
                    {/* SOPORTES PDF */}
                    {caso.soportes && caso.soportes.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                                <FileText size={16} />
                                Soportes Adjuntos ({caso.soportes.length})
                            </h3>
                            <div className="flex gap-2 flex-wrap">
                                {caso.soportes.map((url, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleAbrirPdf(url, index)}
                                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                                    >
                                        <FileText size={18} className="text-red-500" />
                                        <span className="text-xs text-red-700 font-medium">
                                            PDF {index + 1}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ============================================ */}
                    {/* INFORMACIÓN DEL CASO */}
                    {/* ============================================ */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {/* Fecha */}
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                                <Calendar size={18} className="text-green-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Fecha de Creación</p>
                                <p className="font-medium text-gray-800">{formatFecha(caso.createdAt)}</p>
                            </div>
                        </div>

                        {/* Tipo ID */}
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                                <User size={18} className="text-purple-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Tipo ID / Identificación</p>
                                <p className="font-medium text-gray-800">
                                    {caso.paciente?.tipoId || 'CC'} - <strong>{caso.id}</strong>
                                </p>
                            </div>
                        </div>

                        {/* Municipio */}
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center flex-shrink-0">
                                <MapPin size={18} className="text-cyan-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Municipio</p>
                                <p className="font-medium text-gray-800">
                                    {capitalize(caso.paciente?.municipio || 'No registrado')}
                                </p>
                            </div>
                        </div>

                        {/* IPS Primaria */}
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                <Building size={18} className="text-indigo-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">IPS Primaria</p>
                                <p className="font-medium text-gray-800 text-sm">
                                    {caso.paciente?.ipsPrimaria || 'No registrada'}
                                </p>
                            </div>
                        </div>

                        {/* Tipo de Solicitud (BADGE) */}
                        <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 rounded-lg ${tipoSolicitudConfig.bg} flex items-center justify-center flex-shrink-0`}>
                                <IconoTipo size={18} className={tipoSolicitudConfig.text} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Tipo de Solicitud</p>
                                <div className="relative inline-block">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold ${tipoSolicitudConfig.bg} ${tipoSolicitudConfig.text} border ${tipoSolicitudConfig.border} cursor-pointer hover:opacity-80 transition-opacity`}>
                                        {tipoSolicitud}
                                        <ChevronRight size={14} className="ml-1 opacity-50 rotate-90" />
                                    </span>
                                    <select
                                        value={tipoSolicitud}
                                        onChange={(e) => handleTipoSolicitudChange(e.target.value)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
                                        title="Cambiar tipo de solicitud"
                                    >
                                        {TIPOS_SOLICITUD_LISTA.map(tipo => (
                                            <option key={tipo} value={tipo}>{tipo}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* EPS (BADGE) - CONDICIONAL */}
                        {caso.paciente?.eps ? (
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                                    <Activity size={18} className="text-gray-500" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">EPS</p>
                                    <span className={`
                                        inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold border
                                        ${caso.paciente.eps.includes('NUEVA')
                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                            : caso.paciente.eps.includes('TOTAL')
                                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                : 'bg-gray-100 text-gray-700 border-gray-200'
                                        }
                                    `}>
                                        {caso.paciente.eps}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            // Espaciador para mantener grid
                            <div />
                        )}

                        {/* Especialidad (CONDICIONAL) o Spacer si queremos forzar posición? 
                            El grid es auto-flow row. Si Especilidad no está, Ordenador subirá al primer hueco disponible.
                            Para que queden alineados Especilidad y Ordenador en una misma "fila lógica", 
                            debemos renderizarlos consecutivamente sin col-span-2.
                        */}

                        {/* Teléfono */}
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                <Phone size={18} className="text-indigo-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Teléfono</p>
                                <p className="font-medium text-gray-800">
                                    {caso.paciente?.telefono || 'No registrado'}
                                </p>
                            </div>
                        </div>

                        {/* Ordenador (Nuevo Campo) */}
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                <Stethoscope size={18} className="text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Ordenador</p>
                                <p className="font-medium text-gray-800 text-sm">
                                    {capitalize(caso.ordenador || 'No registrado')}
                                </p>
                            </div>
                        </div>

                        {/* Especialidad */}
                        {caso.especialidad && (
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                                    <MessageSquare size={18} className="text-teal-500" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Especialidad</p>
                                    <p className="font-medium text-gray-800">
                                        {caso.especialidad}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Ruta (CONDICIONAL) */}
                        {rutaSeleccionada && (
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center flex-shrink-0">
                                    <Route size={18} className="text-cyan-500" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Ruta Seleccionada</p>
                                    <p className="font-medium text-gray-800">
                                        {rutaSeleccionada}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Datos de Maternidad (FUM/Edad Gestacional) */}
                        {datosMaternidad && (
                            <div className="col-span-2 bg-pink-50 rounded-lg p-3 border border-pink-100 animate-fade-in mt-1 mb-1">
                                <div className="flex items-center gap-2 mb-2 text-pink-700 font-bold border-b border-pink-200 pb-1">
                                    <Stethoscope size={16} />
                                    <span className="text-xs uppercase tracking-wide">Datos Clínicos (Actualizados)</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-pink-600 font-medium mb-0.5">FUM Registrada</span>
                                        <div className="flex items-center gap-2 text-gray-700 font-mono bg-white/60 px-2 py-1 rounded border border-pink-100">
                                            <Calendar size={14} className="text-pink-400" />
                                            {datosMaternidad.fum}
                                        </div>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-pink-600 font-medium mb-0.5">Edad Gestacional Hoy</span>
                                        <div className="flex items-center gap-2 text-pink-700 font-bold bg-white/60 px-2 py-1 rounded border border-pink-100">
                                            <Clock size={14} className="text-pink-500" />
                                            {datosMaternidad.edadGestacional}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Radicador (CAPITALIZED) */}
                        <div className="col-span-2 flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-pink-50 flex items-center justify-center flex-shrink-0">
                                <Mail size={18} className="text-pink-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Radicador</p>
                                <p className="font-medium text-gray-800">
                                    {capitalize(caso.nombreRadicador || caso.radicador)}
                                </p>
                                {caso.emailRadicador && (
                                    <p className="text-xs text-gray-400 font-mono mt-0.5 lowercase">
                                        {caso.emailRadicador}
                                    </p>
                                )}
                                {caso.cargoRadicador && (
                                    <p className="text-xs text-blue-600 font-medium mt-0.5">
                                        {caso.cargoRadicador}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Observaciones originales */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-600 mb-2">Observaciones del Radicador</h3>
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm text-gray-700">
                            {(!caso.observaciones || caso.observaciones === 'NaN')
                                ? 'Ninguna'
                                : caso.observaciones}
                        </div>
                    </div>
                    </div>

                    {/* ====== COLUMNA DERECHA: Gestión del caso ====== */}
                    <div className="flex flex-col gap-4 min-w-0">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-[var(--color-primary)] flex items-center gap-2">
                                <MessageSquare size={16} />
                                Gestión del Caso
                            </h3>
                        </div>

                        {/* Direccionamiento (Badges) - CONDICIONAL */}
                        {tipoSolicitud === 'Auditoría Médica' && (
                            <div className="animate-fade-in">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Direccionamiento
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {DIRECCIONAMIENTO_LISTA.map(opcion => {
                                        const config = DIRECCIONAMIENTO_CONFIG[opcion] || DEFAULT_DIR_STYLE
                                        const isSelected = direccionamiento === opcion

                                        return (
                                            <button
                                                key={opcion}
                                                onClick={() => handleDireccionamientoChange(opcion as Direccionamiento)}
                                                className={`
                                                    px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                                                    ${isSelected
                                                        ? `${config.bg} ${config.text} ${config.border} ring-2 ring-offset-1 ring-${config.border.replace('border-', '')}`
                                                        : `bg-white text-gray-600 border-gray-200 hover:bg-gray-50`
                                                    }
                                                `}
                                            >
                                                {opcion}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Respuesta Auditoría */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium text-gray-700">
                                    Respuesta Auditoría / Back
                                </label>
                                {respuestaBack && respuestaBack.trim() !== '' && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const exito = await copyRichText(respuestaBack)
                                            if (exito) {
                                                setCopiandoRespuesta(true)
                                                setTimeout(() => setCopiandoRespuesta(false), 2000)
                                            }
                                        }}
                                        className={`flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-md transition-all ${copiandoRespuesta
                                            ? 'bg-emerald-500 text-white'
                                            : 'text-emerald-600 hover:bg-emerald-50'
                                            }`}
                                    >
                                        {copiandoRespuesta ? (
                                            <>
                                                <Check size={14} />
                                                ¡Copiado!
                                            </>
                                        ) : (
                                            <>
                                                <Copy size={14} />
                                                Copiar para Outlook/Word
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Botón Generar Contrarreferencia (solo superadmin y en Auditoría Médica) */}
                            {user?.rol === 'superadmin' && tipoSolicitud === 'Auditoría Médica' && (
                                <div className="mb-3 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleGenerarContrarreferencia(false)}
                                        disabled={generandoContrarreferencia || guardando}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600
                                                   text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700
                                                   disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                                    >
                                        {generandoContrarreferencia ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                {mensajeProgreso || 'Generando contrarreferencia...'}
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                Generar Contrarreferencia con IA
                                            </>
                                        )}
                                    </button>
                                    {respuestaBack && !generandoContrarreferencia && (
                                        <button
                                            type="button"
                                            onClick={() => handleGenerarContrarreferencia(true)}
                                            disabled={guardando}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-700
                                                       bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100
                                                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            title="Regenerar ignorando caché"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            Regenerar
                                        </button>
                                    )}
                                </div>
                            )}

                            <RichTextEditor
                                value={respuestaBack}
                                onChange={handleRespuestaBackChange}
                                placeholder="Escribir la respuesta o comentarios del caso..."
                                disabled={generandoContrarreferencia || guardando}
                                className="flex-1"
                            />
                        </div>

                        {/* Estado del Radicado */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Estado del Radicado
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {ESTADOS_RADICADO_LISTA.filter(e => {
                                    if (e === 'Todos') return false
                                    // Validación VISUAL de estados según requerimiento
                                    // 'No contactable' solo visible para Rutas
                                    if (e === 'No contactable' && tipoSolicitud !== 'Activación de Ruta') return false

                                    if (tipoSolicitud === 'Auditoría Médica') {
                                        // Si es Auditoría, NO mostrar 'Gestionado'
                                        if (e === 'Gestionado') return false
                                    } else if (tipoSolicitud === 'Activación de Ruta') {
                                        // Si es Rutas, NO mostrar 'Autorizado' ni 'Contrarreferido', pero SÍ 'Enrutado'
                                        if (['Autorizado', 'Contrarreferido'].includes(e)) return false
                                    } else {
                                        // Casos generales (no Auditoría)
                                        if (e === 'Autorizado') return false
                                    }
                                    return true
                                }).map(estado => {
                                    const colores = ESTADO_COLORES[estado as EstadoRadicado]
                                    const activo = estadoRadicado === estado
                                    const IconoEstado = ESTADO_ICONOS[estado as string] || Clock

                                    // Validación especial: 'Enrutado' requiere PDF adjunto
                                    const esEnrutado = estado === 'Enrutado'
                                    const tieneSoportes = caso.soportes && caso.soportes.length > 0
                                    const enrutadoDeshabilitado = esEnrutado && !tieneSoportes

                                    const handleClickEstado = () => {
                                        if (enrutadoDeshabilitado) {
                                            toast.warning('Para enrutar el caso debes cargar primero un PDF como soporte adjunto. Este archivo se enviará como adjunto en el correo de activación de ruta.')
                                            return
                                        }
                                        handleEstadoRadicadoChange(estado as EstadoRadicado)
                                    }

                                    return (
                                        <button
                                            key={estado}
                                            type="button"
                                            onClick={handleClickEstado}
                                            disabled={enrutadoDeshabilitado}
                                            title={enrutadoDeshabilitado ? 'Requiere PDF adjunto para enviar notificación' : undefined}
                                            className={`
                                                flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all
                                                ${enrutadoDeshabilitado
                                                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                                                    : activo
                                                        ? `${colores.bg} ${colores.border} ${colores.text} shadow-sm`
                                                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                                }
                                            `}
                                        >
                                            <IconoEstado size={16} />
                                            {estado}
                                        </button>
                                    )
                                })}
                                {/* Botón Especial Imágenes - Solo para Rutas y si no está seleccionada ya */}
                                {tipoSolicitud === 'Activación de Ruta' && rutaSeleccionada !== 'Imágenes' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirm('¿Mover este caso a la ruta de Imágenes?')) {
                                                setRutaSeleccionada('Imágenes')
                                                toast.info("Ruta cambiada a Imágenes. Guarda para confirmar.")
                                            }
                                        }}
                                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400 text-sm font-medium transition-all"
                                    >
                                        <ImageIcon size={16} />
                                        Mover a Imágenes
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Selector de Ruta - Visible cuando estado es "Enrutado" */}
                        {estadoRadicado === 'Enrutado' && (
                            <div className="animate-fade-in">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Route size={16} className="inline mr-1.5 text-cyan-600" />
                                    Seleccionar Ruta para Enrutamiento <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-lg border border-gray-200">
                                    {RUTAS_CONFIG.filter(r => r.visibleInterno).sort((a, b) => a.ruta.localeCompare(b.ruta)).map(config => {
                                        const colores = RUTA_COLORES[config.ruta] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
                                        const activo = rutaSeleccionada === config.ruta

                                        return (
                                            <button
                                                key={config.ruta}
                                                type="button"
                                                onClick={() => setRutaSeleccionada(config.ruta)}
                                                className={`
                                                    flex items-center justify-center px-2 py-1.5 rounded-md border text-xs font-medium transition-all
                                                    ${activo
                                                        ? `${colores.bg} ${colores.border} ${colores.text} ring-2 ring-offset-1 ring-cyan-400 shadow-sm`
                                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                                    }
                                                `}
                                                title={config.labelInterno}
                                            >
                                                {config.ruta}
                                            </button>
                                        )
                                    })}
                                </div>
                                {!rutaSeleccionada && (
                                    <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                                        <AlertCircle size={14} />
                                        Debes seleccionar una ruta para poder enviar la notificación
                                    </p>
                                )}
                                {rutaSeleccionada && (
                                    <p className="mt-2 text-xs text-cyan-600 flex items-center gap-1">
                                        <CheckCircle size={14} />
                                        Se enviará notificación a los gestores de la ruta <strong>{rutaSeleccionada}</strong>
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Mensajes de estado */}
                        {errorGuardado && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                <AlertCircle size={18} />
                                {errorGuardado}
                            </div>
                        )}

                        {guardadoExitoso && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 animate-fade-in">
                                <CheckCircle size={18} />
                                Cambios guardados exitosamente
                            </div>
                        )}
                    </div>
                  </div>
                </div>

                {/* Footer fijo - FUERA del scroll */}
                <div className="px-6 py-3 border-t border-gray-200 bg-gray-50/90 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                        >
                            Cancelar
                        </Button>

                        <Button
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setMostandoConfirmacionEliminar(true)}
                            leftIcon={<Trash2 size={18} />}
                        >
                            Eliminar
                        </Button>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            onClick={() => handleGuardar(true)}
                            isLoading={guardando}
                            leftIcon={<Save size={18} />}
                        >
                            Guardar y Cerrar
                        </Button>
                        {haySiguiente && (
                            <Button
                                variant="secondary"
                                className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300"
                                onClick={() => {
                                    abrirPdfAlSiguiente.current = true
                                    handleGuardar(false)
                                }}
                                isLoading={guardando}
                                leftIcon={<FileText size={18} className="text-red-500" />}
                                rightIcon={<ArrowRight size={18} />}
                            >
                                Siguiente PDF
                            </Button>
                        )}
                        {haySiguiente && (
                            <Button
                                onClick={() => handleGuardar(false)}
                                isLoading={guardando}
                                rightIcon={<ArrowRight size={18} />}
                            >
                                Guardar y Siguiente
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* ============================================ */}
            {/* MODAL CONFIRMACIÓN ELIMINAR */}
            {/* ============================================ */}
            {
                mostandoConfirmacionEliminar && (
                    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-scale-in">
                            <div className="flex items-center gap-3 text-red-600 mb-4">
                                <div className="p-3 bg-red-50 rounded-full">
                                    <AlertTriangle size={24} />
                                </div>
                                <h3 className="text-lg font-bold">¿Eliminar caso?</h3>
                            </div>

                            <p className="text-gray-600 mb-6">
                                Estás a punto de eliminar el caso <strong>{caso.radicado}</strong>.
                                Esta acción no se puede deshacer y borrará permanentemente todos los datos asociados.
                            </p>

                            <div className="flex justify-end gap-3">
                                <Button
                                    variant="ghost"
                                    onClick={() => setMostandoConfirmacionEliminar(false)}
                                    disabled={eliminando}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    variant="primary"
                                    className="!bg-red-600 hover:!bg-red-700 text-white"
                                    onClick={handleEliminar}
                                    isLoading={eliminando}
                                >
                                    Sí, eliminar
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ============================================ */}
            {/* VISOR DE PDF FULLSCREEN */}
            {/* ============================================ */}


            {/* Renderizar visor PDF en Portal para estar encima de todo (Sidebar, Header) */}
            {pdfActivo && createPortal(
                <div
                    ref={pdfContainerRef}
                    tabIndex={-1}
                    className="fixed inset-0 z-[100] bg-black/90 flex flex-col animate-fade-in focus:outline-none"
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            e.stopPropagation() // Evitar que burbujee si ya lo manejamos aquí
                            handleCerrarPdf()
                        }
                    }}
                >
                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80">
                        <div className="flex items-center gap-4">
                            <span className="text-white font-medium">
                                Soporte {indicePdf + 1} de {caso.soportes?.length || 1}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={handlePdfAnterior}
                                    disabled={indicePdf === 0}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft size={20} className="text-white" />
                                </button>
                                <button
                                    onClick={handlePdfSiguiente}
                                    disabled={!caso.soportes || indicePdf >= caso.soportes.length - 1}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight size={20} className="text-white" />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href={pdfActivo}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                title="Abrir en nueva pestaña"
                            >
                                <ExternalLink size={20} className="text-white" />
                            </a>
                            <button
                                onClick={() => setPdfFullscreen(!pdfFullscreen)}
                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                title={pdfFullscreen ? 'Reducir' : 'Pantalla completa'}
                            >
                                {pdfFullscreen ? (
                                    <Minimize2 size={20} className="text-white" />
                                ) : (
                                    <Maximize2 size={20} className="text-white" />
                                )}
                            </button>
                            <button
                                onClick={handleCerrarPdf}
                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                            >
                                <X size={20} className="text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Iframe del PDF */}
                    <div className="flex-1 p-4">
                        <iframe
                            src={`${pdfActivo}#view=FitH`}
                            className="w-full h-full rounded-lg bg-white"
                            title={`Soporte PDF ${indicePdf + 1}`}
                        />
                    </div>
                </div>,
                document.body
            )}

            <style>{`
                @keyframes slide-in-right {
                    from {
                        transform: translateX(100%);
                    }
                    to {
                        transform: translateX(0);
                    }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.3s ease-out;
                }
                .animate-scale-in {
                    animation: scale-in 0.2s ease-out;
                }
                @keyframes scale-in {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </>,
        document.body
    )
}

export default CasoDetallePanel
