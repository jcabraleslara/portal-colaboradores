/**
 * Panel de Detalle de Recobro
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * Panel lateral para ver y gestionar un recobro específico
 */

import { useState } from 'react'
import {
    X,
    Calendar,
    FileText,
    Save,
    ExternalLink,
    CheckCircle,
    Trash2,
    Download,
    Mail,
    Star,
    Clock,
    FileSearch,
    Undo2,
    ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { Button, PdfViewerModal } from '@/components/common'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import { recobrosService } from '@/services/recobros.service'
import { generarPdfAprobacion, descargarPdfAprobacion } from './pdfAprobacionGenerator'
import {
    Recobro,
    EstadoRecobro,
    ESTADOS_RECOBRO_LISTA,
    ESTADO_RECOBRO_COLORES,
} from '@/types/recobros.types'

interface RecobroDetallePanelProps {
    recobro: Recobro
    onClose: () => void
    onUpdate: () => void
    onSiguiente?: () => void // Para "Guardar y Siguiente"
}

// Mapeo de iconos por estado
const ESTADO_ICONOS: Record<EstadoRecobro, React.ElementType> = {
    'Pendiente': Clock,
    'En gestión': FileSearch,
    'Aprobado': CheckCircle,
    'Devuelto': Undo2,
}

export function RecobroDetallePanel({ recobro, onClose, onUpdate, onSiguiente }: RecobroDetallePanelProps) {
    const { user } = useAuth()
    const esSuperadmin = user?.rol === 'superadmin'
    const puedeEditar = ['superadmin', 'admin', 'gerencia', 'auditor'].includes(user?.rol || '')

    const [guardando, setGuardando] = useState(false)
    const [nuevoEstado, setNuevoEstado] = useState<EstadoRecobro>(recobro.estado)
    const [respuestaAuditor, setRespuestaAuditor] = useState(recobro.respuestaAuditor || '')
    const [pdfModal, setPdfModal] = useState<{ url: string; title: string } | null>(null)
    const [generandoPdf, setGenerandoPdf] = useState(false)

    // ============================================
    // HANDLERS
    // ============================================
    const handleGuardar = async (cerrar: boolean = true) => {
        // Validar respuesta requerida para devolución
        if (nuevoEstado === 'Devuelto' && !respuestaAuditor.trim()) {
            toast.warning('Debe ingresar una respuesta/justificación para devolver el recobro')
            return
        }

        setGuardando(true)

        try {
            let pdfAprobacionUrl = recobro.pdfAprobacionUrl

            // Si el estado cambia a "Aprobado", generar PDF automáticamente
            if (nuevoEstado === 'Aprobado' && recobro.estado !== 'Aprobado') {
                setGenerandoPdf(true)
                try {
                    const { blob } = await generarPdfAprobacion(
                        {
                            ...recobro,
                            estado: 'Aprobado',
                            respuestaAuditor,
                        },
                        user?.nombreCompleto || user?.email || 'Sistema'
                    )
                    const url = await recobrosService.subirPdfAprobacion(recobro.consecutivo, blob)
                    if (url) {
                        pdfAprobacionUrl = url
                    }
                } catch (pdfError) {
                    console.error('Error generando PDF de aprobación:', pdfError)
                    toast.warning('Se actualizó el estado pero no se pudo generar el PDF de aprobación')
                }
                setGenerandoPdf(false)
            }

            const result = await recobrosService.actualizarRecobro(recobro.id, {
                estado: nuevoEstado,
                respuestaAuditor,
                pdfAprobacionUrl: pdfAprobacionUrl || undefined,
            })

            if (result.success) {
                toast.success('Recobro actualizado exitosamente')
                onUpdate()

                if (cerrar) {
                    onClose()
                } else if (onSiguiente) {
                    onSiguiente()
                }
            } else {
                toast.error(result.error || 'Error al guardar')
            }
        } catch (error) {
            console.error(error)
            toast.error('Error al guardar')
        } finally {
            setGuardando(false)
            setGenerandoPdf(false)
        }
    }

    const handleEliminar = async () => {
        if (!window.confirm(`¿Está SEGURO de eliminar el recobro ${recobro.consecutivo}? Esta acción es irreversible.`)) {
            return
        }

        setGuardando(true)
        try {
            const result = await recobrosService.eliminarRecobro(recobro.id)
            if (result.success) {
                toast.success('Recobro eliminado exitosamente')
                onUpdate()
                onClose()
            } else {
                toast.error(result.error || 'Error al eliminar')
            }
        } catch (error) {
            console.error(error)
            toast.error('Error al eliminar recobro')
        } finally {
            setGuardando(false)
        }
    }

    const handleDescargarPdfAprobacion = async () => {
        if (recobro.pdfAprobacionUrl) {
            window.open(recobro.pdfAprobacionUrl, '_blank')
        } else if (recobro.estado === 'Aprobado') {
            // Generar PDF si está aprobado pero no tiene URL
            setGenerandoPdf(true)
            try {
                const { blob, filename } = await generarPdfAprobacion(
                    recobro,
                    user?.nombreCompleto || user?.email || 'Sistema'
                )
                descargarPdfAprobacion(blob, filename)
            } catch (error) {
                console.error('Error generando PDF:', error)
                toast.error('Error al generar el PDF de aprobación')
            }
            setGenerandoPdf(false)
        }
    }

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
                            <h2 className="text-2xl font-bold text-[var(--color-primary-700)]">
                                {recobro.pacienteNombres || 'Sin nombre'}
                            </h2>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <span className="text-sm font-mono bg-white px-2 py-1 rounded border border-gray-200">
                                    <strong>{recobro.consecutivo}</strong>
                                </span>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${ESTADO_RECOBRO_COLORES[recobro.estado].bg} ${ESTADO_RECOBRO_COLORES[recobro.estado].text}`}>
                                    {(() => {
                                        const Icon = ESTADO_ICONOS[recobro.estado]
                                        return <Icon size={14} />
                                    })()}
                                    {recobro.estado}
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

                {/* Contenido Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Sección: Datos del Paciente */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                            Datos del Paciente
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Identificación</label>
                                <p className="text-sm font-mono font-medium text-gray-900">
                                    {recobro.pacienteTipoId} {recobro.pacienteId}
                                </p>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Fecha de Radicación</label>
                                <div className="flex items-center gap-2">
                                    <Calendar size={14} className="text-gray-400" />
                                    <p className="text-sm text-gray-900">
                                        {recobro.createdAt.toLocaleDateString('es-CO')}
                                        <span className="text-xs text-gray-400 ml-1">
                                            {recobro.createdAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs text-gray-500 block mb-1">Radicado por</label>
                                <div className="flex items-center gap-2">
                                    <Mail size={14} className="text-gray-400" />
                                    <p className="text-sm text-gray-900">
                                        {recobro.radicadorNombre || 'Sin nombre'}
                                        <span className="text-xs text-gray-500 ml-2">({recobro.radicadorEmail})</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Sección: Procedimientos CUPS */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2 flex items-center justify-between">
                            <span>Procedimientos CUPS</span>
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                {recobro.cupsData.length} procedimiento(s)
                            </span>
                        </h3>
                        <div className="space-y-2">
                            {recobro.cupsData.map((cups, idx) => (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-lg border ${cups.es_principal ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-gray-50'}`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                {cups.es_principal && (
                                                    <Star size={14} className="text-yellow-500 fill-current" />
                                                )}
                                                <code className="text-sm font-bold text-blue-600">
                                                    {cups.cups}
                                                </code>
                                            </div>
                                            <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                                                {cups.descripcion}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-medium text-gray-900">
                                                x{cups.cantidad}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Sección: Justificación */}
                    {recobro.justificacion && (
                        <section>
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                                Justificación Clínica
                            </h3>
                            <div className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg border">
                                <div dangerouslySetInnerHTML={{ __html: recobro.justificacion.replace(/\n/g, '<br/>') }} />
                            </div>
                        </section>
                    )}

                    {/* Sección: Soportes Adjuntos */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2 flex items-center justify-between">
                            <span>Soportes Adjuntos</span>
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                {recobro.soportesUrls.length} archivo(s)
                            </span>
                        </h3>

                        {recobro.soportesUrls.length === 0 ? (
                            <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <FileText className="mx-auto text-gray-300 mb-2" size={32} />
                                <p className="text-sm text-gray-500">No hay archivos adjuntos</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {recobro.soportesUrls.map((url, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setPdfModal({ url, title: `Soporte ${idx + 1}` })}
                                        className="flex items-center p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all group text-left"
                                    >
                                        <div className="p-2 bg-red-100 text-red-600 rounded-md mr-3 group-hover:bg-red-200 transition-colors">
                                            <FileText size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900">
                                                Soporte {idx + 1}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                PDF
                                            </p>
                                        </div>
                                        <ExternalLink size={14} className="ml-2 text-gray-300 group-hover:text-blue-400" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Sección: Gestión (Editable) */}
                    {puedeEditar && (
                        <section className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                            <h3 className="text-sm font-bold text-[var(--color-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                                <CheckCircle size={16} /> Gestión del Recobro
                            </h3>

                            <div className="space-y-4">
                                {/* Selector de Estado */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {ESTADOS_RECOBRO_LISTA.filter(e => e !== 'Todos').map(estado => {
                                            const colores = ESTADO_RECOBRO_COLORES[estado as EstadoRecobro]
                                            const Icon = ESTADO_ICONOS[estado as EstadoRecobro]
                                            const isSelected = nuevoEstado === estado

                                            return (
                                                <button
                                                    key={estado}
                                                    type="button"
                                                    onClick={() => setNuevoEstado(estado as EstadoRecobro)}
                                                    className={`
                                                        px-3 py-2.5 text-sm font-medium rounded-lg border text-left transition-all
                                                        flex items-center gap-2
                                                        ${isSelected
                                                            ? `${colores.bg} ${colores.text} ${colores.border} ring-1 ring-current`
                                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                                                        }
                                                    `}
                                                >
                                                    <Icon size={16} />
                                                    {estado}
                                                    {isSelected && <CheckCircle size={14} className="ml-auto" />}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Respuesta del Auditor */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Respuesta / Observaciones
                                        {nuevoEstado === 'Devuelto' && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    <RichTextEditor
                                        value={respuestaAuditor}
                                        onChange={setRespuestaAuditor}
                                        placeholder="Ingrese observaciones, justificación de devolución o notas de aprobación..."
                                    />
                                </div>
                            </div>
                        </section>
                    )}

                    {/* PDF de Aprobación (si existe) */}
                    {recobro.estado === 'Aprobado' && (
                        <section>
                            <Button
                                variant="secondary"
                                onClick={handleDescargarPdfAprobacion}
                                isLoading={generandoPdf}
                                leftIcon={<Download size={18} />}
                                className="w-full"
                            >
                                {recobro.pdfAprobacionUrl ? 'Descargar PDF de Aprobación' : 'Generar PDF de Aprobación'}
                            </Button>
                        </section>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div>
                        {esSuperadmin && (
                            <Button
                                variant="secondary"
                                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                                onClick={handleEliminar}
                                disabled={guardando}
                                leftIcon={<Trash2 size={18} />}
                            >
                                Eliminar
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={onClose} disabled={guardando}>
                            Cancelar
                        </Button>
                        {puedeEditar && (
                            <>
                                {onSiguiente && (
                                    <Button
                                        variant="secondary"
                                        onClick={() => handleGuardar(false)}
                                        isLoading={guardando}
                                        leftIcon={<ChevronRight size={18} />}
                                    >
                                        Guardar y Siguiente
                                    </Button>
                                )}
                                <Button
                                    variant="primary"
                                    onClick={() => handleGuardar(true)}
                                    isLoading={guardando}
                                    leftIcon={<Save size={18} />}
                                >
                                    Guardar y Cerrar
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de PDF */}
            {pdfModal && (
                <PdfViewerModal
                    url={pdfModal.url}
                    title={pdfModal.title}
                    onClose={() => setPdfModal(null)}
                />
            )}
        </>
    )
}

export default RecobroDetallePanel
