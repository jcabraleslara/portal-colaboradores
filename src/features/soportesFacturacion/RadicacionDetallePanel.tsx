import { useState, useMemo } from 'react'
import {
    X,
    User,
    Calendar,
    Building,
    FileText,
    Activity,
    Save,
    ExternalLink,
    CheckCircle,
    Cloud,
} from 'lucide-react'
import { Button, PdfViewerModal } from '@/components/common'
import { soportesFacturacionService } from '@/services/soportesFacturacion.service'
import {
    SoporteFacturacion,
    ESTADOS_SOPORTE_LISTA,
    ESTADO_COLORES,
    CategoriaArchivo,
    CATEGORIAS_ARCHIVOS,
    EstadoSoporteFacturacion,
} from '@/types/soportesFacturacion.types'

interface RadicacionDetallePanelProps {
    caso: SoporteFacturacion
    onClose: () => void
    onUpdate: () => void // Para recargar la lista al guardar cambios
}

export function RadicacionDetallePanel({ caso, onClose, onUpdate }: RadicacionDetallePanelProps) {
    const [guardando, setGuardando] = useState(false)
    const [nuevoEstado, setNuevoEstado] = useState<EstadoSoporteFacturacion>(caso.estado)
    const [observaciones, setObservaciones] = useState(caso.observacionesFacturacion || '')
    const [pdfModal, setPdfModal] = useState<{ url: string; title: string } | null>(null)

    // ============================================
    // AGREGAR ARCHIVOS
    // ============================================
    // Helper para extraer todos los archivos en una lista plana con su categoría
    const archivos = useMemo(() => {
        const lista: { url: string; categoria: CategoriaArchivo; nombre: string }[] = []

        const procesar = (urls: string[], cat: CategoriaArchivo) => {
            urls.forEach(url => {
                // Intentar sacar un nombre legible de la URL o usar la categoría
                let nombre = cat.replace(/_/g, ' ').toUpperCase()
                // Si la URL es de Supabase, a veces tiene el nombre del archivo al final
                try {
                    const decoded = decodeURIComponent(url)
                    const parts = decoded.split('/')
                    const lastPart = parts[parts.length - 1]
                    if (lastPart) nombre = lastPart.split('?')[0] // Quitar query params si hay
                } catch (e) {
                    // ignore
                }

                lista.push({ url, categoria: cat, nombre })
            })
        }

        procesar(caso.urlsValidacionDerechos, 'validacion_derechos')
        procesar(caso.urlsAutorizacion, 'autorizacion')
        procesar(caso.urlsSoporteClinico, 'soporte_clinico')
        procesar(caso.urlsComprobanteRecibo, 'comprobante_recibo')
        procesar(caso.urlsReciboCaja, 'recibo_caja')
        procesar(caso.urlsOrdenMedica, 'orden_medica')
        procesar(caso.urlsDescripcionQuirurgica, 'descripcion_quirurgica')
        procesar(caso.urlsRegistroAnestesia, 'registro_anestesia')
        procesar(caso.urlsHojaMedicamentos, 'hoja_medicamentos')
        procesar(caso.urlsNotasEnfermeria, 'notas_enfermeria')

        return lista
    }, [caso])

    // ============================================
    // HANDLERS
    // ============================================
    const handleGuardar = async () => {
        setGuardando(true)
        try {
            const result = await soportesFacturacionService.actualizarEstado(
                caso.radicado,
                nuevoEstado,
                observaciones
            )

            if (result.success) {
                onUpdate()
                onClose()
            } else {
                alert(result.error || 'Error al guardar')
            }

        } catch (error) {
            console.error(error)
            alert('Error al guardar')
        } finally {
            setGuardando(false)
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
                                Detalle de Radicación
                            </h2>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-sm font-mono bg-white px-2 py-1 rounded border border-gray-200">
                                    Radicado: <strong>{caso.radicado}</strong>
                                </span>
                                <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${ESTADO_COLORES[caso.estado]?.bg} ${ESTADO_COLORES[caso.estado]?.text}`}>
                                    {caso.estado}
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
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Sección: Información General del Paciente y Servicio */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                            Información General
                        </h3>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-6">

                            <div className="col-span-2 sm:col-span-1">
                                <label className="text-xs text-gray-500 block mb-1">Paciente</label>
                                <div className="flex items-start gap-2">
                                    <User size={16} className="text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{caso.nombresCompletos || 'Sin nombre'}</p>
                                        <p className="text-xs text-gray-500">{caso.tipoId} {caso.identificacion}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="col-span-2 sm:col-span-1">
                                <label className="text-xs text-gray-500 block mb-1">EPS / Régimen</label>
                                <div className="flex items-start gap-2">
                                    <Building size={16} className="text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{caso.eps}</p>
                                        <p className="text-xs text-gray-500">{caso.regimen}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Fecha Radicación</label>
                                <div className="flex items-center gap-2">
                                    <Calendar size={16} className="text-gray-400" />
                                    <p className="text-sm text-gray-900">
                                        {caso.fechaRadicacion?.toLocaleDateString('es-CO')}
                                        <span className="text-xs text-gray-400 ml-1">
                                            {caso.fechaRadicacion?.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Servicio Prestado</label>
                                <div className="flex items-center gap-2">
                                    <Activity size={16} className="text-gray-400" />
                                    <p className="text-sm text-gray-900">{caso.servicioPrestado}</p>
                                </div>
                            </div>

                            <div className="col-span-2">
                                <label className="text-xs text-gray-500 block mb-1">Sincronización OneDrive</label>
                                <div className="flex items-center gap-2">
                                    <Cloud size={16} className={caso.onedriveSyncStatus === 'synced' ? 'text-green-500' : 'text-gray-400'} />
                                    <p className="text-sm">
                                        {caso.onedriveSyncStatus === 'synced' && <span className="text-green-700 font-medium">Sincronizado</span>}
                                        {caso.onedriveSyncStatus === 'pending' && <span className="text-amber-600">Pendiente</span>}
                                        {caso.onedriveSyncStatus === 'error' && <span className="text-red-600">Error de sincronización</span>}
                                    </p>
                                    {caso.onedriveFolderUrl && (
                                        <a
                                            href={caso.onedriveFolderUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:text-blue-800 underline ml-2 flex items-center"
                                        >
                                            Ver Carpeta <ExternalLink size={10} className="ml-1" />
                                        </a>
                                    )}
                                </div>
                            </div>

                        </div>
                    </section>

                    {/* Sección: Archivos Adjuntos */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2 flex items-center justify-between">
                            <span>Soportes Adjuntos</span>
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{archivos.length} archivos</span>
                        </h3>

                        {archivos.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <FileText className="mx-auto text-gray-300 mb-2" size={32} />
                                <p className="text-sm text-gray-500">No hay archivos adjuntos visibles</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {archivos.map((file, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setPdfModal({ url: file.url, title: file.nombre })}
                                        className="flex items-start p-3 w-full text-left rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm hover:bg-blue-50 transition-all group"
                                    >
                                        <div className="p-2 bg-blue-100 text-blue-600 rounded-md mr-3 group-hover:bg-blue-200 transaction-colors">
                                            <FileText size={18} />
                                        </div>
                                        <div className="overflow-hidden flex-1">
                                            <p className="text-sm font-medium text-gray-900 truncate" title={file.nombre}>
                                                {file.nombre}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {CATEGORIAS_ARCHIVOS.find(c => c.id === file.categoria)?.label || file.categoria}
                                            </p>
                                        </div>
                                        <ExternalLink size={14} className="ml-2 text-gray-300 group-hover:text-blue-400" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Sección: Gestión (Editable) */}
                    <section className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                        <h3 className="text-sm font-bold text-[var(--color-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                            <CheckCircle size={16} /> Gestión del Radicado
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {ESTADOS_SOPORTE_LISTA.filter(e => e !== 'Todos').map(estado => (
                                        <button
                                            key={estado}
                                            onClick={() => setNuevoEstado(estado as EstadoSoporteFacturacion)}
                                            className={`
                                                px-3 py-2 text-sm font-medium rounded-lg border text-left transition-all flex items-center justify-between
                                                ${nuevoEstado === estado
                                                    ? `${ESTADO_COLORES[estado as keyof typeof ESTADO_COLORES].bg} ${ESTADO_COLORES[estado as keyof typeof ESTADO_COLORES].text} border-${ESTADO_COLORES[estado as keyof typeof ESTADO_COLORES].border.split('-')[1]}-300 ring-1 ring-${ESTADO_COLORES[estado as keyof typeof ESTADO_COLORES].text.split('-')[1]}-500`
                                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                                                }
                                            `}
                                        >
                                            {estado}
                                            {nuevoEstado === estado && <CheckCircle size={14} />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones de Facturación</label>
                                <textarea
                                    className="w-full min-h-[100px] p-3 text-sm border-gray-300 rounded-lg shadow-sm focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                    placeholder="Ingrese observaciones sobre la facturación, rechazo o aprobación..."
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value)}
                                />
                            </div>
                        </div>
                    </section>

                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={guardando}>
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleGuardar}
                        isLoading={guardando}
                        leftIcon={<Save size={18} />}
                    >
                        Guardar Cambios
                    </Button>
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
