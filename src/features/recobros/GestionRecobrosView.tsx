/**
 * Vista de Gestión de Recobros
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * Listado y gestión de recobros para usuarios con permisos (admin/superadmin/gerencia/auditor)
 */

import { useState, useEffect, useCallback } from 'react'
import {
    Search,
    Loader2,
    Trash2,
    Clock,
    FileSearch,
    CheckCircle,
    Undo2,
    Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { Card, Button, Input } from '@/components/common'
import { recobrosService } from '@/services/recobros.service'
import { RecobroDetallePanel } from './RecobroDetallePanel'
import {
    Recobro,
    EstadoRecobro,
    ESTADOS_RECOBRO_LISTA,
    ESTADO_RECOBRO_COLORES,
    FiltrosRecobros,
} from '@/types/recobros.types'

const ITEMS_POR_PAGINA = 10

// Mapeo de iconos por estado
const ESTADO_ICONOS: Record<EstadoRecobro, React.ElementType> = {
    'Pendiente': Clock,
    'En gestión': FileSearch,
    'Aprobado': CheckCircle,
    'Devuelto': Undo2,
}

// Componente Badge simple
const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
        {children}
    </span>
)

export function GestionRecobrosView() {
    const { user } = useAuth()
    const esSuperadmin = user?.rol === 'superadmin'

    // ============================================
    // ESTADO
    // ============================================
    const [recobros, setRecobros] = useState<Recobro[]>([])
    const [total, setTotal] = useState(0)
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Filtros
    const [filtros, setFiltros] = useState<FiltrosRecobros>({
        estado: 'Pendiente',
    })
    const [busquedaInput, setBusquedaInput] = useState('')

    // Paginación
    const [paginaActual, setPaginaActual] = useState(0)

    // Conteos
    const [conteos, setConteos] = useState<Record<string, number>>({})

    // Panel Detalle
    const [recobroSeleccionado, setRecobroSeleccionado] = useState<Recobro | null>(null)

    // ============================================
    // CARGA DE DATOS
    // ============================================
    const cargarDatos = useCallback(async () => {
        setCargando(true)
        setError(null)

        try {
            const offset = paginaActual * ITEMS_POR_PAGINA
            const result = await recobrosService.obtenerListaFiltrada(
                filtros,
                offset,
                ITEMS_POR_PAGINA
            )

            if (result.success && result.data) {
                setRecobros(result.data.recobros)
                setTotal(result.data.total)
            } else {
                setError(result.error || 'Error cargando datos')
            }
        } catch (err) {
            console.error(err)
            setError('Error de conexión')
        } finally {
            setCargando(false)
        }
    }, [filtros, paginaActual])

    const cargarConteos = useCallback(async () => {
        const result = await recobrosService.obtenerConteosPorEstado()
        if (result.success && result.data) {
            setConteos(result.data)
        }
    }, [])

    useEffect(() => {
        cargarDatos()
    }, [cargarDatos])

    useEffect(() => {
        cargarConteos()
    }, [cargarConteos])

    // ============================================
    // HANDLERS
    // ============================================
    const handleBuscar = (e: React.FormEvent) => {
        e.preventDefault()
        setFiltros(prev => ({
            ...prev,
            busqueda: busquedaInput || undefined,
            estado: 'Todos',
        }))
        setPaginaActual(0)
    }

    const handleLimpiarBusqueda = () => {
        setBusquedaInput('')
        setFiltros(prev => ({ ...prev, busqueda: undefined }))
        setPaginaActual(0)
    }

    const handleFiltroEstado = (estado: string) => {
        setFiltros(prev => ({
            ...prev,
            estado: estado as EstadoRecobro | 'Todos',
        }))
        setPaginaActual(0)
    }

    const handleVerDetalle = (recobro: Recobro) => {
        setRecobroSeleccionado(recobro)
    }

    const handleCerrarDetalle = () => {
        setRecobroSeleccionado(null)
    }

    const handleActualizacionExitosa = () => {
        cargarDatos()
        cargarConteos()
    }

    const handleSiguiente = () => {
        // Encontrar el siguiente recobro en la lista
        if (!recobroSeleccionado) return

        const indexActual = recobros.findIndex(r => r.id === recobroSeleccionado.id)
        if (indexActual < recobros.length - 1) {
            setRecobroSeleccionado(recobros[indexActual + 1])
        } else {
            // Si es el último, cerrar
            setRecobroSeleccionado(null)
            toast.info('No hay más recobros en la lista')
        }
    }

    const handleEliminar = async (e: React.MouseEvent, id: string, consecutivo: string) => {
        e.stopPropagation()

        if (!window.confirm(`¿Está seguro de eliminar el recobro ${consecutivo}? Esta acción es irreversible.`)) {
            return
        }

        try {
            const result = await recobrosService.eliminarRecobro(id)
            if (result.success) {
                toast.success(`Recobro ${consecutivo} eliminado exitosamente`)
                cargarDatos()
                cargarConteos()
            } else {
                toast.error(result.error || 'Error al eliminar el recobro')
            }
        } catch (error) {
            console.error(error)
            toast.error('Error procesando la solicitud')
        }
    }

    // ============================================
    // RENDER
    // ============================================
    const totalPaginas = Math.ceil(total / ITEMS_POR_PAGINA)

    return (
        <div className="space-y-6">
            {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-md">
                    {error}
                </div>
            )}

            {/* Cards de Conteo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {ESTADOS_RECOBRO_LISTA.filter(e => e !== 'Todos').map(estado => {
                    const count = conteos[estado] || 0
                    const colores = ESTADO_RECOBRO_COLORES[estado as EstadoRecobro]
                    const Icon = ESTADO_ICONOS[estado as EstadoRecobro]
                    const isSelected = filtros.estado === estado

                    return (
                        <div
                            key={estado}
                            onClick={() => handleFiltroEstado(estado)}
                            className={`
                                cursor-pointer rounded-xl p-4 border transition-all
                                ${isSelected
                                    ? 'ring-2 ring-[var(--color-primary)] border-transparent bg-white shadow-md'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                                }
                            `}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-sm font-medium ${colores.text}`}>
                                    {estado}
                                </span>
                                <div className={`p-1.5 rounded-full ${colores.bg} ${colores.text}`}>
                                    <Icon size={16} />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-gray-900">
                                {count}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Filtros y Búsqueda */}
            <Card>
                <div className="p-4 space-y-4">
                    <form onSubmit={handleBuscar} className="flex gap-4">
                        <div className="flex-1 relative">
                            <Input
                                placeholder="Buscar por radicado, identificación o nombre..."
                                value={busquedaInput}
                                onChange={(e) => setBusquedaInput(e.target.value)}
                                className="pl-10"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        </div>
                        <Button type="submit" leftIcon={<Search size={18} />}>
                            Buscar
                        </Button>
                        {filtros.busqueda && (
                            <Button variant="ghost" onClick={handleLimpiarBusqueda}>
                                Limpiar
                            </Button>
                        )}
                    </form>
                </div>
            </Card>

            {/* Tabla de Resultados */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Radicado
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Fecha
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Paciente
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    CUPS
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Radicador
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Estado
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {cargando ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <Loader2 className="animate-spin mb-2" size={32} />
                                            <p>Cargando recobros...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : recobros.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        No se encontraron recobros con los filtros seleccionados
                                    </td>
                                </tr>
                            ) : (
                                recobros.map(recobro => {
                                    const colores = ESTADO_RECOBRO_COLORES[recobro.estado]
                                    const cupsPrincipal = recobro.cupsData.find(c => c.es_principal) || recobro.cupsData[0]

                                    return (
                                        <tr
                                            key={recobro.id}
                                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                                            onClick={() => handleVerDetalle(recobro)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-[var(--color-primary)]">
                                                    {recobro.consecutivo}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {recobro.createdAt.toLocaleDateString('es-CO')}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {recobro.createdAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900 max-w-[200px] truncate">
                                                    {recobro.pacienteNombres || 'Sin nombre'}
                                                </div>
                                                <div className="text-xs text-gray-500 font-mono">
                                                    {recobro.pacienteTipoId} {recobro.pacienteId}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {cupsPrincipal && (
                                                    <div>
                                                        <code className="text-xs font-bold text-blue-600">
                                                            {cupsPrincipal.cups}
                                                        </code>
                                                        <p className="text-xs text-gray-500 truncate max-w-[150px]">
                                                            {cupsPrincipal.descripcion}
                                                        </p>
                                                        {recobro.cupsData.length > 1 && (
                                                            <span className="text-xs text-gray-400">
                                                                +{recobro.cupsData.length - 1} más
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {recobro.radicadorNombre || 'Sin nombre'}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {recobro.radicadorEmail.split('@')[0]}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Badge
                                                    className={`${colores.bg} ${colores.text} border ${colores.border}`}
                                                >
                                                    {recobro.estado}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    {recobro.pdfAprobacionUrl && (
                                                        <a
                                                            href={recobro.pdfAprobacionUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-full transition-colors"
                                                            title="Descargar PDF de aprobación"
                                                        >
                                                            <Download size={18} />
                                                        </a>
                                                    )}
                                                    {esSuperadmin && (
                                                        <button
                                                            onClick={(e) => handleEliminar(e, recobro.id, recobro.consecutivo)}
                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                                            title="Eliminar recobro"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                {!cargando && total > 0 && (
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            Mostrando {Math.min(paginaActual * ITEMS_POR_PAGINA + 1, total)} a{' '}
                            {Math.min((paginaActual + 1) * ITEMS_POR_PAGINA, total)} de {total} resultados
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={paginaActual === 0}
                                onClick={() => setPaginaActual(prev => prev - 1)}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={paginaActual >= totalPaginas - 1}
                                onClick={() => setPaginaActual(prev => prev + 1)}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Panel de Detalle */}
            {recobroSeleccionado && (
                <RecobroDetallePanel
                    recobro={recobroSeleccionado}
                    onClose={handleCerrarDetalle}
                    onUpdate={handleActualizacionExitosa}
                    onSiguiente={handleSiguiente}
                />
            )}
        </div>
    )
}

export default GestionRecobrosView
