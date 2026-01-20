/**
 * Vista Principal de Gestión de Demanda Inducida
 * Incluye filtros, métricas, tabla de resultados y formulario de radicación
 */

import { useState, useEffect } from 'react'
import { demandaInducidaService } from '@/services/demandaInducidaService'
import { DemandaInducidaFormulario } from './DemandaInducidaFormulario'
import type { DemandaInducida, DemandaFilters, DemandaMetrics } from '@/types/demandaInducida'
import {
    Phone,
    PhoneOff,
    Calendar,
    Filter,
    FileText,
    Search,
} from 'lucide-react'

import { ChevronLeft, ChevronRight } from 'lucide-react'

// ... (imports existentes)

export default function GestionDemandaInducidaView() {
    const [vistaActual, setVistaActual] = useState<'lista' | 'formulario'>('lista')
    const [casos, setCasos] = useState<DemandaInducida[]>([])
    const [metrics, setMetrics] = useState<DemandaMetrics | null>(null)
    const [loading, setLoading] = useState(true)

    // Paginación
    const [currentPage, setCurrentPage] = useState(1)
    const [totalItems, setTotalItems] = useState(0)
    const ITEMS_PER_PAGE = 20

    const [colaboradores, setColaboradores] = useState<string[]>([])
    const [programas, setProgramas] = useState<string[]>([])

    // Filtros
    const [filters, setFilters] = useState<DemandaFilters>({
        fechaInicio: '',
        fechaFin: '',
        colaborador: '',
        programa: '',
        clasificacion: undefined,
    })

    /**
     * Cargar datos iniciales
     */
    useEffect(() => {
        loadData()
        loadOptions()
    }, [])

    /**
     * Recargar cuando cambian filtros o página
     */
    useEffect(() => {
        if (!loading) {
            loadData()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, currentPage])

    const loadData = async () => {
        setLoading(true)
        try {
            const [response, metricsData] = await Promise.all([
                demandaInducidaService.getAll({ ...filters, page: currentPage, pageSize: ITEMS_PER_PAGE }),
                demandaInducidaService.getMetrics(filters),
            ])
            setCasos(response.data)
            setTotalItems(response.count)
            setMetrics(metricsData)
        } catch (error) {
            console.error('Error cargando datos:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadOptions = async () => {
        const [colabs, progs] = await Promise.all([
            demandaInducidaService.getColaboradores(),
            demandaInducidaService.getProgramas(),
        ])
        setColaboradores(colabs)
        setProgramas(progs)
    }

    const handleFilterChange = (name: string, value: string) => {
        setFilters((prev) => ({ ...prev, [name]: value || undefined }))
        setCurrentPage(1) // Resetear a página 1 al filtrar
    }

    const limpiarFiltros = () => {
        setFilters({
            fechaInicio: '',
            fechaFin: '',
            colaborador: '',
            programa: '',
            clasificacion: undefined,
        })
        setCurrentPage(1)
    }

    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)

    if (vistaActual === 'formulario') {
        // ... (código existente del formulario)
        return (
            <div className="p-6 max-w-6xl mx-auto">
                <div className="mb-6">
                    <button
                        onClick={() => {
                            setVistaActual('lista')
                            loadData()
                        }}
                        className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-2"
                    >
                        ← Volver a la lista
                    </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-8">
                    <h1 className="text-2xl font-bold text-slate-900 mb-6">Radicar Nuevo Caso</h1>
                    <DemandaInducidaFormulario />
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* ... (Header, Metrics, Filters existentes) ... */}

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Demanda Inducida</h1>
                    <p className="text-slate-500 mt-1">Gestión y radicación de casos</p>
                </div>
                <button
                    onClick={() => setVistaActual('formulario')}
                    className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-primary-500/30 flex items-center gap-2"
                >
                    <FileText size={18} />
                    Radicar Nuevo Caso
                </button>
            </div>

            {/* Tarjetas de Métricas */}
            {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <MetricCard
                        titulo="Total Casos"
                        valor={metrics.totalCasos}
                        icono={<FileText className="text-primary-500" />}
                        color="primary"
                    />
                    <MetricCard
                        titulo="Llamadas Efectivas"
                        valor={metrics.casosEfectivos}
                        subtitulo={`${metrics.porcentajeEfectividad.toFixed(1)}%`}
                        icono={<Phone className="text-green-500" />}
                        color="green"
                    />
                    <MetricCard
                        titulo="Llamadas No Efectivas"
                        valor={metrics.casosNoEfectivos}
                        icono={<PhoneOff className="text-amber-500" />}
                        color="amber"
                    />
                    <MetricCard
                        titulo="Casos Este Mes"
                        valor={metrics.casosMesActual}
                        icono={<Calendar className="text-blue-500" />}
                        color="blue"
                    />
                </div>
            )}

            {/* Filtros */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Filter size={20} className="text-slate-600" />
                    <h3 className="font-bold text-slate-900">Filtros de Búsqueda</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Fecha Inicio
                        </label>
                        <input
                            type="date"
                            value={filters.fechaInicio}
                            onChange={(e) => handleFilterChange('fechaInicio', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Fecha Fin
                        </label>
                        <input
                            type="date"
                            value={filters.fechaFin}
                            onChange={(e) => handleFilterChange('fechaFin', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Colaborador
                        </label>
                        <select
                            value={filters.colaborador}
                            onChange={(e) => handleFilterChange('colaborador', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">Todos</option>
                            {colaboradores.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Programa</label>
                        <select
                            value={filters.programa}
                            onChange={(e) => handleFilterChange('programa', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">Todos</option>
                            {programas.map((p) => (
                                <option key={p} value={p}>
                                    {p}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Clasificación
                        </label>
                        <select
                            value={filters.clasificacion || ''}
                            onChange={(e) =>
                                handleFilterChange(
                                    'clasificacion',
                                    e.target.value as 'Efectivo' | 'No Efectivo' | ''
                                )
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">Todas</option>
                            <option value="Efectivo">Efectivo</option>
                            <option value="No Efectivo">No Efectivo</option>
                        </select>
                    </div>
                </div>

                <div className="mt-4 flex gap-3">
                    <button
                        onClick={limpiarFiltros}
                        className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        Limpiar Filtros
                    </button>
                </div>
            </div>

            {/* Tabla de Resultados */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-slate-900">Casos Registrados</h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Mostrando {casos.length} de {totalItems} resultados
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-500">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                        <p className="mt-4 font-medium">Cargando casos...</p>
                    </div>
                ) : casos.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <Search size={48} className="mx-auto text-slate-300 mb-3" />
                        <p className="font-medium">No se encontraron casos</p>
                        <p className="text-sm mt-1">Intenta ajustar los filtros de búsqueda</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Fecha
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Identificación
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Clasificación
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Programa
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Colaborador
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Resultado
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {casos.map((caso) => (
                                        <tr key={caso.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 text-sm text-slate-900">
                                                {new Date(caso.fechaGestion).toLocaleDateString('es-CO')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-semibold text-slate-900">
                                                    {caso.pacienteTipoId} - {caso.pacienteId}
                                                </div>
                                                {caso.celular && (
                                                    <div className="text-xs text-slate-500">{caso.celular}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${caso.clasificacion === 'Efectivo'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                        }`}
                                                >
                                                    {caso.clasificacion}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-700">
                                                {caso.programaDireccionado || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{caso.colaborador}</td>
                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                {caso.resultadoLlamada || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginación */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                            <div className="text-sm text-slate-500">
                                Página {currentPage} de {totalPages}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

/**
 * Componente de Tarjeta de Métrica
 */
function MetricCard({
    titulo,
    valor,
    subtitulo,
    icono,
    color,
}: {
    titulo: string
    valor: number
    subtitulo?: string
    icono: React.ReactNode
    color: 'primary' | 'green' | 'amber' | 'blue'
}) {
    const colorClasses = {
        primary: 'from-primary-500 to-primary-600',
        green: 'from-green-500 to-green-600',
        amber: 'from-amber-500 to-amber-600',
        blue: 'from-blue-500 to-blue-600',
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 bg-gradient-to-br ${colorClasses[color]} rounded-xl`}>{icono}</div>
            </div>
            <h3 className="text-sm font-semibold text-slate-600 mb-1">{titulo}</h3>
            <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-slate-900">{valor.toLocaleString()}</p>
                {subtitulo && <p className="text-sm font-semibold text-green-600">{subtitulo}</p>}
            </div>
        </div>
    )
}
