import { useState, useEffect, useCallback } from 'react'
import {
    Search,
    Loader2,
    Calendar,
    Download
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, Button, Input } from '@/components/common'
import { anexo8Service } from '@/services/anexo8.service'
import { Anexo8Record, Anexo8Filtros } from '@/types/anexo8.types'
import { generarAnexo8Pdf, descargarPdf } from '../pdfGenerator'
import { Anexo8DetallePanel } from './Anexo8DetallePanel'

const ITEMS_POR_PAGINA = 10

export function Anexo8HistoryTab() {
    // ============================================
    // ESTADO
    // ============================================
    const [registros, setRegistros] = useState<Anexo8Record[]>([])
    const [total, setTotal] = useState(0)
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [descargandoId, setDescargandoId] = useState<string | null>(null)
    const [registroSeleccionado, setRegistroSeleccionado] = useState<Anexo8Record | null>(null)

    // Filtros
    const [filtros, setFiltros] = useState<Anexo8Filtros>({})
    const [busquedaInput, setBusquedaInput] = useState('')

    // Paginación
    const [paginaActual, setPaginaActual] = useState(0)

    // ============================================
    // CARGA DE DATOS
    // ============================================
    const cargarDatos = useCallback(async () => {
        setCargando(true)
        setError(null)

        try {
            const offset = paginaActual * ITEMS_POR_PAGINA

            // Si hay búsqueda por documento, añadir al filtro
            const filtrosActuales = { ...filtros }
            if (busquedaInput) {
                filtrosActuales.pacienteDocumento = busquedaInput
            }

            const result = await anexo8Service.obtenerHistorialPaginado(
                filtrosActuales,
                offset,
                ITEMS_POR_PAGINA
            )

            if (result.success && result.data) {
                setRegistros(result.data.soportes)
                setTotal(result.data.total)
            } else {
                setError(result.error || 'Error cargando historial')
                setRegistros([])
                setTotal(0)
            }
        } catch (err) {
            console.error(err)
            setError('Error de conexión')
        } finally {
            setCargando(false)
        }
    }, [filtros, paginaActual, busquedaInput]) // busquedaInput se incluye aquí para búsquedas instantáneas o al presionar enter

    // Cargar al montar y cuando cambien dependencias
    useEffect(() => {
        const timer = setTimeout(() => {
            cargarDatos()
        }, 300) // Debounce para búsqueda

        return () => clearTimeout(timer)
    }, [cargarDatos])

    // ============================================
    // HANDLERS
    // ============================================
    const handleBuscar = (e: React.FormEvent) => {
        e.preventDefault()
        setPaginaActual(0)
        cargarDatos()
    }

    const handleLimpiarBusqueda = () => {
        setBusquedaInput('')
        setFiltros({})
        setPaginaActual(0)
    }

    const handleDescargarPdf = async (registro: Anexo8Record) => {
        if (descargandoId) return

        try {
            setDescargandoId(registro.id)

            // Si ya tiene URL de PDF, intentar descargarla
            if (registro.pdf_url) {
                // Asegurar que la URL sea accesible (firmada)
                const urlFirmada = await anexo8Service.refrescarUrlPdf(registro.pdf_url)

                // Opción 1: Abrir en nueva pestaña
                window.open(urlFirmada, '_blank')
                toast.success('Abriendo PDF...')
            } else {
                // Opción 2: Regenerar PDF si no existe URL (fallback)
                toast.info('Generando PDF...')

                // Asegurar firma accesible
                const registroParaPdf = { ...registro }
                if (registroParaPdf.medico_firma_url) {
                    registroParaPdf.medico_firma_url = await anexo8Service.refrescarUrlPdf(registroParaPdf.medico_firma_url)
                }

                const { blob, filename } = await generarAnexo8Pdf(registroParaPdf)
                descargarPdf(blob, filename)
                toast.success('PDF descargado correctamente')
            }
        } catch (error) {
            console.error(error)
            toast.error('Error al descargar el PDF')
        } finally {
            setDescargandoId(null)
        }
    }

    // ============================================
    // RENDER
    // ============================================
    const totalPaginas = Math.ceil(total / ITEMS_POR_PAGINA)

    return (
        <div className="space-y-6">
            {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
                    {error}
                </div>
            )}

            {/* Filtros */}
            <Card>
                <div className="p-4 space-y-4">
                    <form onSubmit={handleBuscar} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Input
                                placeholder="Buscar por documento del paciente..."
                                value={busquedaInput}
                                onChange={(e) => setBusquedaInput(e.target.value)}
                                className="pl-10"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        </div>

                        <div className="w-full md:w-48">
                            <Input
                                type="date"
                                className="w-full text-sm"
                                placeholder="Fecha Desde"
                                value={filtros.fechaDesde || ''}
                                onChange={(e) => {
                                    setFiltros(prev => ({ ...prev, fechaDesde: e.target.value || undefined }))
                                    setPaginaActual(0)
                                }}
                            />
                        </div>

                        <div className="w-full md:w-48">
                            <Input
                                type="date"
                                className="w-full text-sm"
                                placeholder="Fecha Hasta"
                                value={filtros.fechaHasta || ''}
                                onChange={(e) => {
                                    setFiltros(prev => ({ ...prev, fechaHasta: e.target.value || undefined }))
                                    setPaginaActual(0)
                                }}
                            />
                        </div>

                        <Button type="submit" leftIcon={<Search size={18} />}>
                            Buscar
                        </Button>

                        {(busquedaInput || filtros.fechaDesde || filtros.fechaHasta) && (
                            <Button variant="ghost" onClick={handleLimpiarBusqueda} type="button">
                                Limpiar
                            </Button>
                        )}
                    </form>
                </div>
            </Card>

            {/* Tabla */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Fecha
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Recetario
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Paciente
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Medicamento
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Cantidad
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Médico
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                                            <p>Cargando historial...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : registros.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        No se encontraron registros de Anexo 8
                                    </td>
                                </tr>
                            ) : (
                                registros.map(registro => (
                                    <tr
                                        key={registro.id}
                                        className="hover:bg-blue-50 transition-colors cursor-pointer"
                                        onClick={() => setRegistroSeleccionado(registro)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 flex items-center gap-2">
                                                <Calendar size={14} className="text-gray-400" />
                                                {new Date(registro.fecha_prescripcion).toLocaleDateString('es-CO')}
                                            </div>
                                            <div className="text-xs text-gray-500 ml-6">
                                                Gen: {new Date(registro.created_at).toLocaleDateString('es-CO')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-gray-700">
                                                {registro.numero_recetario || 'Pendiente'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {registro.paciente_nombres} {registro.paciente_apellido1}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {registro.paciente_tipo_id} {registro.paciente_documento}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {registro.medicamento_nombre}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {registro.medicamento_forma_farmaceutica}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {registro.cantidad_numero} Unid.
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-700">
                                                {registro.medico_nombres}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDescargarPdf(registro)
                                                }}
                                                disabled={descargandoId === registro.id}
                                                className="text-blue-600 hover:text-blue-900"
                                            >
                                                {descargandoId === registro.id ? (
                                                    <Loader2 className="animate-spin" size={16} />
                                                ) : (
                                                    <Download size={16} />
                                                )}
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                {!cargando && total > 0 && (
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            Mostrando {Math.min(paginaActual * ITEMS_POR_PAGINA + 1, total)} a {Math.min((paginaActual + 1) * ITEMS_POR_PAGINA, total)} de {total} resultados
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
            {registroSeleccionado && (
                <Anexo8DetallePanel
                    registro={registroSeleccionado}
                    onClose={() => setRegistroSeleccionado(null)}
                />
            )}
        </div>
    )
}
