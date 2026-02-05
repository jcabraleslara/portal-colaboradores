/**
 * Tab de Histórico para Salud Oral
 * Muestra tabla de registros con filtros, paginación y exportación
 */

import { useState, useEffect } from 'react'
import {
    Search,
    Filter,
    Download,
    FileSpreadsheet,
    FileText,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    MapPin,
    Check,
    Clock,
    ChevronLeft,
    ChevronRight,
    Smile,
    Droplets,
    Shield,
    Sparkles,
    ClipboardCheck,
    Percent,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useSaludOralList, useSaludOralMetrics, useSaludOralColaboradores } from '../hooks/useSaludOral'
import { MetricCard, MetricGrid } from './MetricCards'
import { OdDetallePanel } from './OdDetallePanel'
import { exportarInformeCups, exportarInformeExcel } from '../utils/cupsExport'
import type { OdRegistro, OdFilters, Sede } from '@/types/saludOral.types'

const SEDES_OPTIONS: Sede[] = ['Montería', 'Cereté', 'Ciénaga de Oro']
const ITEMS_PER_PAGE = 10

const ACTIVITY_OPTIONS = [
    { value: '', label: 'Todas las actividades' },
    { value: 'fluor', label: 'Flúor Barniz' },
    { value: 'sellantes', label: 'Sellantes' },
    { value: 'detartraje', label: 'Detartraje' },
    { value: 'control_placa', label: 'Control Placa' },
    { value: 'profilaxis', label: 'Profilaxis' },
    { value: 'educacion', label: 'Educación' },
    { value: 'resina', label: 'Resinas' },
    { value: 'ionomero', label: 'Ionómeros' },
    { value: 'obturacion_temporal', label: 'Obt. Temporal' },
    { value: 'terapia_conducto', label: 'Terapia Conducto' },
    { value: 'pulpectomia', label: 'Pulpectomía' },
    { value: 'pulpotomia', label: 'Pulpotomía' },
    { value: 'exodoncia', label: 'Exodoncia' },
    { value: 'control_postquirurgico', label: 'Ctrl Postquirúrgico' },
    { value: 'rx', label: 'Radiografías' },
]

interface HistoricoTabProps {
    onEdit?: (registro: OdRegistro) => void
}

export function HistoricoTab({ onEdit }: HistoricoTabProps) {
    const { user } = useAuth()

    // Filtros
    const [filters, setFilters] = useState<OdFilters>({
        fechaInicio: '',
        fechaFin: '',
        colaboradorEmail: '',
        sede: undefined,
        pacienteId: '',
        tratamientoFinalizado: undefined,
        page: 1,
        pageSize: ITEMS_PER_PAGE,
    })

    // Ordenamiento
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)

    // Estado UI
    const [registroSeleccionado, setRegistroSeleccionado] = useState<OdRegistro | null>(null)
    const [showExportMenu, setShowExportMenu] = useState(false)
    const [exporting, setExporting] = useState(false)

    // Queries
    const { data: listData, isLoading, refetch } = useSaludOralList({
        ...filters,
        sortBy: sortConfig?.key,
        sortOrder: sortConfig?.direction,
    })
    const { data: metrics } = useSaludOralMetrics(filters)
    const { data: colaboradores } = useSaludOralColaboradores()

    const registros = listData?.data || []
    const totalItems = listData?.count || 0
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)

    // Manejar cambio de filtros
    const handleFilterChange = (name: keyof OdFilters, value: any) => {
        setFilters((prev) => ({
            ...prev,
            [name]: value || undefined,
            page: 1, // Reset página al filtrar
        }))
    }

    // Limpiar filtros
    const limpiarFiltros = () => {
        setFilters({
            fechaInicio: '',
            fechaFin: '',
            colaboradorEmail: '',
            sede: undefined,
            pacienteId: '',
            tratamientoFinalizado: undefined,
            page: 1,
            pageSize: ITEMS_PER_PAGE,
        })
        setSortConfig(null)
        setSearchId('')
    }

    // Búsqueda por ID con estado local
    const [searchId, setSearchId] = useState(filters.pacienteId || '')

    // Sincronizar input si los filtros cambian externamente (ej: botón limpiar)
    useEffect(() => {
        setSearchId(filters.pacienteId || '')
    }, [filters.pacienteId])

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleFilterChange('pacienteId', searchId)
        }
    }

    // Ordenamiento
    const handleSort = (key: string) => {
        setSortConfig((current) => {
            if (current?.key === key) {
                if (current.direction === 'asc') return { key, direction: 'desc' }
                return null
            }
            return { key, direction: 'asc' }
        })
    }

    const renderSortIcon = (columnKey: string) => {
        if (sortConfig?.key !== columnKey) {
            return <ArrowUpDown size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        }
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} className="text-primary-500" />
            : <ArrowDown size={14} className="text-primary-500" />
    }

    // Exportación
    const handleExport = async (format: 'cups' | 'xlsx') => {
        setExporting(true)
        setShowExportMenu(false)

        try {
            if (format === 'cups') {
                await exportarInformeCups(filters)
                toast.success('Informe CUPS exportado correctamente')
            } else {
                await exportarInformeExcel(filters)
                toast.success('Informe Excel exportado correctamente')
            }
        } catch (error) {
            console.error('Error exportando:', error)
            toast.error('Error al exportar')
        } finally {
            setExporting(false)
        }
    }

    // Filtros rápidos desde métricas
    const handleMetricClick = (type: 'total' | 'mes' | 'finalizados' | 'sede', value?: string) => {
        const hoy = new Date()
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
        const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]

        switch (type) {
            case 'mes':
                const esMesActivo = filters.fechaInicio === primerDiaMes && filters.fechaFin === ultimoDiaMes
                setFilters((prev) => ({
                    ...prev,
                    fechaInicio: esMesActivo ? '' : primerDiaMes,
                    fechaFin: esMesActivo ? '' : ultimoDiaMes,
                    page: 1,
                }))
                break
            case 'finalizados':
                setFilters((prev) => ({
                    ...prev,
                    tratamientoFinalizado: prev.tratamientoFinalizado === true ? undefined : true,
                    page: 1,
                }))
                break
            case 'sede':
                if (value) {
                    setFilters((prev) => ({
                        ...prev,
                        sede: prev.sede === value ? undefined : value as Sede,
                        page: 1,
                    }))
                }
                break
        }
    }

    // Permisos de exportación
    const canExport = ['superadmin', 'auditor', 'gerencia'].includes(user?.rol || '')

    return (
        <div className="space-y-6">
            {/* Métricas PyM del Mes */}
            {metrics && (
                <MetricGrid columns={5}>
                    <MetricCard
                        titulo="Flúor Barniz"
                        valor={metrics.pymMesActual.fluor}
                        subtitulo="Este mes"
                        icono={<Droplets className="text-white" size={20} />}
                        color="blue"
                        onClick={() => handleMetricClick('mes')}
                        isActive={(() => {
                            const hoy = new Date()
                            const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
                            const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]
                            return filters.fechaInicio === primerDia && filters.fechaFin === ultimoDia
                        })()}
                    />
                    <MetricCard
                        titulo="Sellantes"
                        valor={metrics.pymMesActual.sellantes}
                        subtitulo="Este mes"
                        icono={<Shield className="text-white" size={20} />}
                        color="purple"
                        onClick={() => handleMetricClick('mes')}
                    />
                    <MetricCard
                        titulo="Detartraje"
                        valor={metrics.pymMesActual.detartraje}
                        subtitulo="Este mes"
                        icono={<Sparkles className="text-white" size={20} />}
                        color="amber"
                        onClick={() => handleMetricClick('mes')}
                    />
                    <MetricCard
                        titulo="Control Placa"
                        valor={metrics.pymMesActual.controlPlaca}
                        subtitulo="Este mes"
                        icono={<ClipboardCheck className="text-white" size={20} />}
                        color="primary"
                        onClick={() => handleMetricClick('mes')}
                    />
                    <MetricCard
                        titulo="% Finalizados"
                        valor={`${metrics.porcentajeFinalizados}%`}
                        subtitulo="Este mes"
                        subtituloColor={metrics.porcentajeFinalizados >= 70 ? 'green' : metrics.porcentajeFinalizados >= 40 ? 'amber' : 'red'}
                        icono={<Percent className="text-white" size={20} />}
                        color="green"
                        onClick={() => handleMetricClick('finalizados')}
                        isActive={filters.tratamientoFinalizado === true}
                    />
                </MetricGrid>
            )}

            {/* Filtros */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200 p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div className="flex items-center gap-2 text-slate-800">
                        <Filter size={20} className="text-primary-500" />
                        <h3 className="font-bold text-lg">Filtros de Búsqueda</h3>
                    </div>

                    <div className="w-full md:w-96 relative">
                        <input
                            type="text"
                            placeholder="Buscar por identificación... (Enter)"
                            value={searchId}
                            onChange={(e) => setSearchId(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            className="w-full pl-10 pr-12 py-2.5 rounded-full border-2 border-primary-500/20 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-all bg-white"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <button
                            onClick={() => handleFilterChange('pacienteId', searchId)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 rounded-full text-primary-600 transition-colors"
                            title="Buscar"
                        >
                            <Search size={18} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fecha Inicio</label>
                        <input
                            type="date"
                            value={filters.fechaInicio || ''}
                            onChange={(e) => handleFilterChange('fechaInicio', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fecha Fin</label>
                        <input
                            type="date"
                            value={filters.fechaFin || ''}
                            onChange={(e) => handleFilterChange('fechaFin', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Sede</label>
                        <select
                            value={filters.sede || ''}
                            onChange={(e) => handleFilterChange('sede', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">Todas</option>
                            {SEDES_OPTIONS.map((sede) => (
                                <option key={sede} value={sede}>{sede}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Colaborador</label>
                        <select
                            value={filters.colaboradorEmail || ''}
                            onChange={(e) => handleFilterChange('colaboradorEmail', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">Todos</option>
                            {colaboradores && Object.entries(colaboradores)
                                .sort((a, b) => a[1].localeCompare(b[1]))
                                .map(([email, nombre]) => (
                                    <option key={email} value={email}>
                                        {nombre}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Actividad</label>
                        <select
                            value={filters.actividad || ''}
                            onChange={(e) => handleFilterChange('actividad', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                        >
                            {ACTIVITY_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
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

            {/* Tabla */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-slate-900">Registros de Salud Oral</h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Mostrando {registros.length} de {totalItems} resultados
                        </p>
                    </div>

                    {canExport && (
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                disabled={exporting}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-all focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                            >
                                <Download size={16} />
                                {exporting ? 'Exportando...' : 'Exportar'}
                            </button>

                            {showExportMenu && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-10 overflow-hidden">
                                    <button
                                        onClick={() => handleExport('xlsx')}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <FileSpreadsheet size={16} className="text-green-600" />
                                        Excel completo (.xlsx)
                                    </button>
                                    <button
                                        onClick={() => handleExport('cups')}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <FileText size={16} className="text-blue-600" />
                                        Informe CUPS (.csv)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-slate-500">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                        <p className="mt-4 font-medium">Cargando registros...</p>
                    </div>
                ) : registros.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <Smile size={48} className="mx-auto text-slate-300 mb-3" />
                        <p className="font-medium">No se encontraron registros</p>
                        <p className="text-sm mt-1">Intenta ajustar los filtros de búsqueda</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th
                                            className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer group hover:bg-slate-100"
                                            onClick={() => handleSort('fechaRegistro')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Fecha
                                                {renderSortIcon('fechaRegistro')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer group hover:bg-slate-100"
                                            onClick={() => handleSort('pacienteId')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Paciente
                                                {renderSortIcon('pacienteId')}
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Sede
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            COP
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Estado
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Colaborador
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {registros.map((registro: OdRegistro) => (
                                        <tr
                                            key={registro.id}
                                            className="hover:bg-primary-50/30 transition-colors cursor-pointer"
                                            onClick={() => setRegistroSeleccionado(registro)}
                                        >
                                            <td className="px-4 py-4 text-sm text-slate-900 font-medium">
                                                {new Date(registro.fechaRegistro).toLocaleDateString('es-CO')}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                                {registro.pacienteId}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-700">
                                                <span className="inline-flex items-center gap-1">
                                                    <MapPin size={14} className="text-slate-400" />
                                                    {registro.sede}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                                                    {registro.copCariesCavitacional + registro.copObturados + registro.copPerdidos}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${registro.tratamientoFinalizado
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {registro.tratamientoFinalizado ? (
                                                        <><Check size={12} /> Finalizado</>
                                                    ) : (
                                                        <><Clock size={12} /> En Proceso</>
                                                    )}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                {colaboradores?.[registro.colaboradorEmail] || registro.colaboradorEmail.split('@')[0]}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginación */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                            <div className="text-sm text-slate-500">
                                Página {filters.page} de {totalPages || 1}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
                                    disabled={(filters.page || 1) <= 1}
                                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button
                                    onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(totalPages, (prev.page || 1) + 1) }))}
                                    disabled={(filters.page || 1) >= totalPages}
                                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Panel de Detalle */}
            {registroSeleccionado && (
                <OdDetallePanel
                    registro={registroSeleccionado}
                    onClose={() => setRegistroSeleccionado(null)}
                    onUpdate={() => refetch()}
                    onEdit={(registro) => {
                        setRegistroSeleccionado(null)
                        onEdit?.(registro)
                    }}
                />
            )}
        </div>
    )
}

export default HistoricoTab
