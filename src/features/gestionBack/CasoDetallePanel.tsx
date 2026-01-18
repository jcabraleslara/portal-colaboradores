/**
 * Panel de Detalle de Caso
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useCallback, useEffect } from 'react'
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
    CheckCircle,
    ExternalLink,
    Maximize2,
    Minimize2,
    ChevronLeft,
    ChevronRight,
    Trash2,
    AlertTriangle,
    Stethoscope,
    Activity,
    BookOpen,
    FileEdit,
    Zap,
    Route,
    Loader2,
    Sparkles,
} from 'lucide-react'
import { Button } from '@/components/common'
import { backService } from '@/services/back.service'
import { emailService } from '@/services/email.service'
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
} from '@/types/back.types'

interface CasoDetallePanelProps {
    caso: BackRadicacionExtendido
    onClose: () => void
    onGuardarYCerrar: () => void
    onGuardarYSiguiente: () => void
    onCasoEliminado: () => void
    haySiguiente: boolean
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
    'Auditoría de Pertinencia': Stethoscope,
    'Solicitud de Historia Clínica': BookOpen,
    'Ajuste de Ordenamiento': FileEdit,
    'Renovación de prequirúrgicos': Activity,
    'Gestión de Mipres': Zap,
    'Activación de Ruta': Route,
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
    onCasoEliminado,
    haySiguiente,
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

    // ============================================
    // LOGIC HANDLERS
    // ============================================

    const handleTipoSolicitudChange = (nuevoTipo: string) => {
        setTipoSolicitud(nuevoTipo)

        // Validar estados no permitidos al cambiar tipo
        if (nuevoTipo === 'Auditoría de Pertinencia') {
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
    }

    const handleRespuestaBackChange = (valor: string) => {
        setRespuestaBack(valor)

        // Si contiene la palabra clave 'CONTRA REFERENCIA', cambiar estado a 'Contrarreferido' de forma automática
        if (valor.toUpperCase().includes('CONTRA REFERENCIA')) {
            setEstadoRadicado('Contrarreferido')
        }
    }

    // Handler para generar contrarreferencia con IA
    const handleGenerarContrarreferencia = async () => {
        setGenerandoContrarreferencia(true)
        setErrorGuardado(null)

        try {
            // Obtener el primer soporte (PDF)
            const pdfUrl = caso.soportes?.[0]
            if (!pdfUrl) {
                setErrorGuardado('No hay soporte adjunto para generar contrarreferencia')
                setGenerandoContrarreferencia(false)
                return
            }

            console.log('[UI] Iniciando generación de contrarreferencia...')

            const resultado = await generarContrarreferenciaAutomatica(
                caso.radicado,
                pdfUrl,
                caso.especialidad || undefined
            )

            if (resultado.success && resultado.texto) {
                console.log(`[UI] ✅ Contrarreferencia generada en ${resultado.tiempoMs}ms (${resultado.metodo})`)
                // Actualizar el campo respuesta_back (esto también activará auto-cambio de estado)
                handleRespuestaBackChange(resultado.texto)
            } else {
                console.error('[UI] Error en generación:', resultado.error)
                setErrorGuardado(resultado.error || 'Error al generar contrarreferencia')
            }
        } catch (error) {
            console.error('[UI] Excepción al generar contrarreferencia:', error)
            setErrorGuardado('Error inesperado al generar contrarreferencia')
        } finally {
            setGenerandoContrarreferencia(false)
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

    // Visor de PDF
    const [pdfActivo, setPdfActivo] = useState<string | null>(null)
    const [indicePdf, setIndicePdf] = useState(0)
    const [pdfFullscreen, setPdfFullscreen] = useState(false)

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
                        // Fallo silencioso o advertencia? Mejor advertencia.
                        console.warn("No se pudo enviar el correo de notificación")
                        // No bloqueamos el guardado, pero idealmente avisaríamos.
                    }
                } catch (e) {
                    console.error("Error enviando email", e)
                }
            } else {
                console.warn("El radicador no tiene correo registrado, no se envió notificación.")
            }
        }

        const result = await backService.actualizarCaso(caso.radicado, {
            direccionamiento: direccionamiento || null,
            respuesta_back: respuestaBack || null,
            estado_radicado: estadoRadicado,
            tipo_solicitud: tipoSolicitud, // Enviar cambio
        })

        setGuardando(false)

        if (result.success) {
            setGuardadoExitoso(true)
            setTimeout(() => {
                if (cerrar) {
                    onGuardarYCerrar()
                } else {
                    onGuardarYSiguiente()
                }
            }, 300)
        } else {
            setErrorGuardado(result.error || 'Error al guardar')
        }
    }, [caso, direccionamiento, respuestaBack, estadoRadicado, onGuardarYCerrar, onGuardarYSiguiente])

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
    }, [onClose, mostandoConfirmacionEliminar, pdfActivo, pdfFullscreen, handleCerrarPdf])

    // ============================================
    // HELPERS
    // ============================================

    const getNombreCompleto = () => {
        if (!caso.paciente) return 'Sin datos del paciente'
        return [caso.paciente.nombres, caso.paciente.apellido1, caso.paciente.apellido2]
            .filter(Boolean)
            .join(' ')
    }

    const formatFecha = (fecha: Date) => {
        return new Intl.DateTimeFormat('es-CO', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        }).format(fecha)
    }

    const estadoColor = ESTADO_COLORES[estadoRadicado] || ESTADO_COLORES['Pendiente']
    const tipoSolicitudConfig = TIPO_SOLICITUD_COLORES[tipoSolicitud] || TIPO_SOLICITUD_COLORES['Auditoría de Pertinencia']
    const IconoTipo = TIPO_ICONOS[tipoSolicitud] || FileText

    // ============================================
    // RENDER
    // ============================================

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Panel lateral */}
            <div className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-white shadow-2xl animate-slide-in-right overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[var(--color-primary-50)] to-white">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-3xl font-bold text-[var(--color-primary-700)]">
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
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/80 transition-colors"
                        >
                            <X size={24} className="text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Contenido scrolleable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* ============================================ */}
                    {/* SOPORTES PDF */}
                    {/* ============================================ */}
                    {caso.soportes && caso.soportes.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                                <FileText size={16} />
                                Soportes Adjuntos ({caso.soportes.length})
                            </h3>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {caso.soportes.map((url, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleAbrirPdf(url, index)}
                                        className="flex-shrink-0 w-24 h-32 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl flex flex-col items-center justify-center hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                                    >
                                        <FileText size={32} className="text-red-500 mb-2" />
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
                    <div className="grid grid-cols-2 gap-4">
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

                        {/* Ordenador */}
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <Building size={18} className="text-gray-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Ordenador</p>
                                <p className="font-medium text-gray-800">
                                    {caso.ordenador || 'No especificado'}
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

                        {/* Radicador (CAPITALIZED) */}
                        <div className="col-span-2 flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-pink-50 flex items-center justify-center flex-shrink-0">
                                <Mail size={18} className="text-pink-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Radicador</p>
                                <p className="font-medium text-gray-800">
                                    {capitalize(caso.radicador)}
                                </p>
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

                    {/* ============================================ */}
                    {/* CAMPOS EDITABLES */}
                    {/* ============================================ */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-[var(--color-primary)] flex items-center gap-2">
                                <MessageSquare size={16} />
                                Gestión del Caso
                            </h3>
                        </div>

                        {/* Direccionamiento (Badges) - CONDICIONAL */}
                        {tipoSolicitud === 'Auditoría de Pertinencia' && (
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
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Respuesta Auditoría / Back
                            </label>

                            {/* Botón Generar Contrarreferencia (solo superadmin) */}
                            {user?.rol === 'superadmin' && (
                                <div className="mb-3">
                                    <button
                                        type="button"
                                        onClick={handleGenerarContrarreferencia}
                                        disabled={generandoContrarreferencia || guardando}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 
                                                   text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 
                                                   disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                                    >
                                        {generandoContrarreferencia ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Generando contrarreferencia...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                🤖 Generar Contrarreferencia con IA
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            <textarea
                                value={respuestaBack}
                                onChange={(e) => handleRespuestaBackChange(e.target.value)}
                                rows={6}
                                placeholder="Escribir la respuesta o comentarios del caso..."
                                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] focus:border-[var(--color-primary)] resize-y min-h-[120px]"
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
                                    if (tipoSolicitud === 'Auditoría de Pertinencia') {
                                        // Si es Auditoría, NO mostrar 'Gestionado'
                                        if (e === 'Gestionado') return false
                                    } else {
                                        // Si NO es Auditoría, NO mostrar 'Autorizado'
                                        if (e === 'Autorizado') return false
                                    }
                                    return true
                                }).map(estado => {
                                    const colores = ESTADO_COLORES[estado as EstadoRadicado]
                                    const activo = estadoRadicado === estado

                                    return (
                                        <button
                                            key={estado}
                                            type="button"
                                            onClick={() => handleEstadoRadicadoChange(estado as EstadoRadicado)}
                                            className={`
                                                px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all
                                                ${activo
                                                    ? `${colores.bg} ${colores.border} ${colores.text} shadow-sm`
                                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                                }
                                            `}
                                        >
                                            {estado}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

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

                {/* Footer con botones de acción */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
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
            {
                pdfActivo && (
                    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col animate-fade-in">
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
                    </div>
                )
            }

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
        </>
    )
}

export default CasoDetallePanel
