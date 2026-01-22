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
    Edit,
    Trash2,
    Download,
} from 'lucide-react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
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
    const { user } = useAuth()
    const esAdmin = user?.rol === 'admin' || user?.rol === 'superadmin'

    const [guardando, setGuardando] = useState(false)
    const [nuevoEstado, setNuevoEstado] = useState<EstadoSoporteFacturacion>(caso.estado)
    const [observaciones, setObservaciones] = useState(caso.observacionesFacturacion || '')
    const [pdfModal, setPdfModal] = useState<{ url: string; title: string } | null>(null)
    const [archivoEditando, setArchivoEditando] = useState<{
        categoria: CategoriaArchivo
        rutaActual: string
        nombreActual: string
        url: string
    } | null>(null)
    const [nuevoNombreArchivo, setNuevoNombreArchivo] = useState('')
    const [renombrando, setRenombrando] = useState(false)
    const [sincronizando, setSincronizando] = useState(false)
    const [descargando, setDescargando] = useState(false)


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
        // Validar que si el estado es "Rechazado", las observaciones no estén vacías
        if (nuevoEstado === 'Rechazado' && !observaciones.trim()) {
            toast.warning('Debe ingresar observaciones de facturación para rechazar el radicado')
            return
        }

        setGuardando(true)
        try {
            const result = await soportesFacturacionService.actualizarEstado(
                caso.radicado,
                nuevoEstado,
                observaciones
            )

            if (result.success) {
                toast.success('Radicado actualizado exitosamente')
                onUpdate()
                onClose()
            } else {
                toast.error(result.error || 'Error al guardar')
            }

        } catch (error) {
            console.error(error)
            toast.error('Error al guardar')
        } finally {
            setGuardando(false)
        }
    }

    const handleRenombrarArchivo = async () => {
        if (!archivoEditando || !nuevoNombreArchivo.trim()) {
            toast.warning('Debe ingresar un nombre válido para el archivo')
            return
        }

        setRenombrando(true)
        try {
            const result = await soportesFacturacionService.renombrarArchivo(
                caso.radicado,
                archivoEditando.categoria,
                archivoEditando.rutaActual,
                nuevoNombreArchivo.trim()
            )

            if (result.success) {
                toast.success('Archivo renombrado exitosamente')
                setArchivoEditando(null)
                setNuevoNombreArchivo('')
                onUpdate() // Refrescar para mostrar el nuevo nombre
            } else {
                toast.error(result.error || 'Error al renombrar archivo')
            }
        } catch (error) {
            console.error(error)
            toast.error('Error al renombrar archivo')
        } finally {
            setRenombrando(false)
        }
    }

    const handleEliminar = async () => {
        if (!window.confirm(`¿Está SEGURO de eliminar el radicado ${caso.radicado}? Esta acción es irreversible y borrará el registro de la base de datos.`)) {
            return
        }

        setGuardando(true)
        try {
            const result = await soportesFacturacionService.eliminarRadicado(caso.radicado)
            if (result.success) {
                toast.success('Radicado eliminado exitosamente')
                onUpdate()
                onClose()
            } else {
                toast.error(result.error || 'Error al eliminar')
            }
        } catch (error) {
            console.error(error)
            toast.error('Error al eliminar radicado')
        } finally {
            setGuardando(false)
        }
    }

    const handleSincronizarOneDrive = async () => {
        setSincronizando(true)
        try {
            const promise = soportesFacturacionService.sincronizarOneDrive(caso.radicado)

            toast.promise(promise, {
                loading: 'Sincronizando archivos con OneDrive...',
                success: (res) => {
                    onUpdate()
                    if ((res as any).warning) return `Advertencia: ${(res as any).message}`
                    return 'Sincronización exitosa con OneDrive'
                },
                error: 'Error al sincronizar con OneDrive'
            })

            await promise
        } catch (error) {
            console.error(error)
        } finally {
            setSincronizando(false)
        }
    }

    const handleDescargarLocal = async () => {
        setDescargando(true)
        const toastId = toast.loading('Preparando descarga de archivos...')

        try {
            const zip = new JSZip()

            // 1. Generar nombre de la carpeta (igual que en OneDrive)
            // Formato: RADICADO_FECHA_EPS_REGIMEN_SERVICIO
            const fechaStr = new Date(caso.createdAt).toISOString().split('T')[0].replace(/-/g, '')
            const epsStr = caso.eps.replace(/\s+/g, '_')
            const regimenStr = caso.regimen.substring(0, 3).toUpperCase()
            const servicioStr = caso.servicioPrestado.replace(/\s+/g, '_').substring(0, 20)
            const nombreCarpeta = `${caso.radicado}_${fechaStr}_${epsStr}_${regimenStr}_${servicioStr}`

            // 2. Recorrer archivos y agregar al ZIP
            let archivosProcesados = 0

            // Mapeo de propiedades del objeto caso a categorías
            const mapeoCategorias: Record<string, CategoriaArchivo> = {
                'urlsValidacionDerechos': 'validacion_derechos',
                'urlsAutorizacion': 'autorizacion',
                'urlsSoporteClinico': 'soporte_clinico',
                'urlsComprobanteRecibo': 'comprobante_recibo',
                'urlsOrdenMedica': 'orden_medica',
                'urlsDescripcionQuirurgica': 'descripcion_quirurgica',
                'urlsRegistroAnestesia': 'registro_anestesia',
                'urlsHojaMedicamentos': 'hoja_medicamentos',
                'urlsNotasEnfermeria': 'notas_enfermeria',
            }

            // Obtener prefijos para esta EPS
            const configEps = CATEGORIAS_ARCHIVOS.reduce((acc, cat) => {
                acc[cat.id] = cat.prefijos[caso.eps] || ''
                return acc
            }, {} as Record<string, string>)


            for (const [propiedad, categoriaId] of Object.entries(mapeoCategorias)) {
                // @ts-ignore - Acceso dinámico a propiedades del caso
                const urls: string[] = caso[propiedad] || []

                if (urls.length > 0) {
                    const prefijo = configEps[categoriaId] || ''

                    for (let i = 0; i < urls.length; i++) {
                        const url = urls[i]
                        try {
                            const response = await fetch(url)
                            if (!response.ok) throw new Error(`Error descargando ${url}`)

                            const blob = await response.blob()

                            // Determinar extensión segura
                            let extension = 'pdf'
                            if (blob.type.includes('image/jpeg')) extension = 'jpg'
                            else if (blob.type.includes('image/png')) extension = 'png'

                            // Nombre archivo: PREFIJO_RADICADO_CATEGORIA_INDICE.ext
                            const nombreArchivo = `${prefijo}${caso.radicado}_${categoriaId}_${i + 1}.${extension}`

                            // Agregar al ZIP (dentro de carpeta raíz con el nombre generado)
                            zip.folder(nombreCarpeta)?.file(nombreArchivo, blob)
                            archivosProcesados++

                        } catch (err) {
                            console.error(`Error procesando archivo ${url}`, err)
                        }
                    }
                }
            }

            if (archivosProcesados === 0) {
                toast.error('No hay archivos para descargar', { id: toastId })
                return
            }

            // 3. Generar y guardar
            const content = await zip.generateAsync({ type: 'blob' })
            saveAs(content, `${nombreCarpeta}.zip`)

            toast.success('Descarga iniciada exitosamente', { id: toastId })

        } catch (error) {
            console.error('Error generando descarga:', error)
            toast.error('Error al generar el archivo ZIP', { id: toastId })
        } finally {
            setDescargando(false)
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

                                {esAdmin && (
                                    <>
                                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${caso.onedriveSyncStatus === 'synced' && caso.onedriveFolderUrl
                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                            : caso.onedriveSyncStatus === 'error' || caso.onedriveSyncStatus === 'failed'
                                                ? 'bg-red-50 text-red-700 border-red-200'
                                                : 'bg-gray-50 text-gray-600 border-gray-200'
                                            }`} title={caso.onedriveSyncStatus}>
                                            <Cloud size={14} />
                                            <span className="hidden sm:inline">
                                                {caso.onedriveSyncStatus === 'synced' && caso.onedriveFolderUrl ? 'Sincronizado' :
                                                    caso.onedriveSyncStatus === 'error' || caso.onedriveSyncStatus === 'failed' ? 'Error' :
                                                        'No Sync'}
                                            </span>
                                        </div>

                                        {(!caso.onedriveFolderUrl || caso.onedriveSyncStatus !== 'synced' || esAdmin) && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs px-2"
                                                onClick={handleSincronizarOneDrive}
                                                isLoading={sincronizando}
                                                disabled={sincronizando}
                                                title="Forzar sincronización con OneDrive"
                                            >
                                                Sync
                                            </Button>
                                        )}
                                    </>
                                )}
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

                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Radicado Por</label>
                                <div className="flex items-start gap-2">
                                    <User size={16} className="text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            {caso.radicadorNombre || 'Sin nombre'}
                                        </p>
                                        <p className="text-xs text-gray-500">{caso.radicadorEmail}</p>
                                    </div>
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
                                {archivos.map((file, idx) => {
                                    // Extraer la ruta del archivo desde la URL
                                    const urlObj = new URL(file.url)
                                    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/sign\/soportes-facturacion\/(.+)/)
                                    const rutaArchivo = pathMatch ? decodeURIComponent(pathMatch[1]) : ''

                                    return (
                                        <div key={idx} className="flex items-start p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all group">
                                            <button
                                                onClick={() => setPdfModal({ url: file.url, title: file.nombre })}
                                                className="flex items-start flex-1 min-w-0"
                                            >
                                                <div className="p-2 bg-blue-100 text-blue-600 rounded-md mr-3 group-hover:bg-blue-200 transition-colors">
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

                                            {/* Botón de edición */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setArchivoEditando({
                                                        categoria: file.categoria,
                                                        rutaActual: rutaArchivo,
                                                        nombreActual: file.nombre,
                                                        url: file.url
                                                    })
                                                    setNuevoNombreArchivo(file.nombre.replace('.pdf', ''))
                                                }}
                                                className="p-2 ml-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Renombrar archivo"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        </div>
                                    )
                                })}
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
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div>
                        {esAdmin && (
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
                        <Button
                            variant="secondary"
                            onClick={handleDescargarLocal}
                            disabled={guardando || descargando}
                            isLoading={descargando}
                            leftIcon={<Download size={18} />}
                            className="mr-2"
                        >
                            Descargar
                        </Button>

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
            </div>

            {/* Modal de PDF */}
            {pdfModal && (
                <PdfViewerModal
                    url={pdfModal.url}
                    title={pdfModal.title}
                    onClose={() => setPdfModal(null)}
                />
            )}

            {/* Modal de Renombrar Archivo */}
            {archivoEditando && (
                <>
                    <div
                        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
                        onClick={() => setArchivoEditando(null)}
                    />
                    <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 animate-scale-in">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Renombrar Archivo</h3>
                        <p className="text-sm text-gray-600 mb-2">
                            Archivo actual:
                        </p>
                        <p className="text-sm font-medium text-gray-900 mb-4 bg-gray-50 p-2 rounded border">
                            {archivoEditando.nombreActual}
                        </p>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nuevo nombre (sin extensión .pdf)
                        </label>
                        <input
                            type="text"
                            className="w-full p-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Ejemplo: nuevo_nombre_archivo"
                            value={nuevoNombreArchivo}
                            onChange={(e) => setNuevoNombreArchivo(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleRenombrarArchivo()}
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => setArchivoEditando(null)}
                                disabled={renombrando}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleRenombrarArchivo}
                                isLoading={renombrando}
                                leftIcon={<Save size={16} />}
                            >
                                Renombrar
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}
