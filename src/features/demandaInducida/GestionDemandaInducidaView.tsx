/**
 * Vista Principal de Gestión de Demanda Inducida
 * Incluye filtros, métricas, tabla de resultados y formulario de radicación
 */

import { useState, useEffect } from 'react'
import { demandaInducidaService } from '@/services/demandaInducidaService'
import { DemandaInducidaFormulario } from './DemandaInducidaFormulario'
import { DemandaDetallePanel } from './DemandaDetallePanel'
import type { DemandaInducida, DemandaFilters, DemandaMetrics } from '@/types/demandaInducida'
import {
    Phone,
    PhoneOff,
    Calendar,
    Filter,
    FileText,
    Search,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Trash2,
    Download,
    FileSpreadsheet,
    FileType,
} from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

import { useAuth } from '@/context/AuthContext'

import { ChevronLeft, ChevronRight } from 'lucide-react'

// ... (imports existentes)

export default function GestionDemandaInducidaView() {
    const [vistaActual, setVistaActual] = useState<'lista' | 'formulario'>('lista')
    const [casos, setCasos] = useState<DemandaInducida[]>([])
    const [metrics, setMetrics] = useState<DemandaMetrics | null>(null)
    const [loading, setLoading] = useState(true)
    const [casoSeleccionado, setCasoSeleccionado] = useState<DemandaInducida | null>(null)
    const { user } = useAuth()

    // Paginación y Ordenamiento
    const [currentPage, setCurrentPage] = useState(1)
    const [totalItems, setTotalItems] = useState(0)
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
    const ITEMS_PER_PAGE = 10

    const [colaboradores, setColaboradores] = useState<string[]>([])
    const [programas, setProgramas] = useState<string[]>([])

    // Filtros
    const [filters, setFilters] = useState<DemandaFilters>({
        fechaInicio: '',
        fechaFin: '',
        colaborador: '',
        programa: '',
        clasificacion: undefined,
        busqueda: '',
    })

    // Estado para exportación
    const [exporting, setExporting] = useState(false)
    const [showExportMenu, setShowExportMenu] = useState(false)

    /**
     * Descargar archivo generado
     */
    const downloadFile = (content: string, fileName: string, contentType: string) => {
        const a = document.createElement("a");
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
    }

    /**
     * Manejar exportación
     */
    const handleExport = async (format: 'csv' | 'xlsx' | 'txt') => {
        setExporting(true)
        setShowExportMenu(false)
        try {
            // Obtener todos los datos con los filtros actuales
            const { data } = await demandaInducidaService.getAll({
                ...filters,
                page: 1,
                pageSize: 100000 // L limit alto para exportar "todo"
            })

            if (data.length === 0) {
                toast.warning('No hay datos para exportar')
                return
            }

            // Formatear datos para exportación
            const exportData = data.map(item => ({
                'ID': item.id,
                'Fecha Gestión': new Date(item.fechaGestion).toLocaleDateString('es-CO'),
                'Hora': item.horaLlamada || '',
                'Tipo ID': item.pacienteTipoId,
                'Identificación': item.pacienteId,
                'Celular': item.celular,
                'Clasificación': item.clasificacion,
                'Resultado Llamada': item.resultadoLlamada || 'N/A',
                'Quien Recibe': item.quienRecibeLlamada || '',
                'Relación': item.relacionUsuario || '',
                'Colaborador': item.colaborador,
                'Programa Direccionado': item.programaDireccionado || 'N/A',
                'Departamento': item.departamento || '',
                'Municipio': item.municipio || '',
                'Actividades': item.actividadesRealizadas || '',
                'Texto Llamada': item.textoLlamada || '',
                'Teléfono Actualizado': item.telefonoActualizado || '',
                'Soportes Recuperados': item.soportesRecuperados || '',
                'Fecha Asignación Cita': item.fechaAsignacionCita || '',
                'Condición Usuario': item.condicionUsuario || '',
            }))

            const fileName = `demanda_inducida_${new Date().toISOString().split('T')[0]}_${new Date().getTime()}`

            if (format === 'xlsx') {
                const ws = XLSX.utils.json_to_sheet(exportData)
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, "Casos")
                XLSX.writeFile(wb, `${fileName}.xlsx`)
            } else if (format === 'csv') {
                const ws = XLSX.utils.json_to_sheet(exportData)
                const csv = XLSX.utils.sheet_to_csv(ws)
                downloadFile(csv, `${fileName}.csv`, 'text/csv;charset=utf-8;')
            } else if (format === 'txt') {
                const keys = Object.keys(exportData[0]).join('\t')
                const rows = exportData.map(row => Object.values(row).join('\t')).join('\n')
                const txt = `${keys}\n${rows}`
                downloadFile(txt, `${fileName}.txt`, 'text/plain;charset=utf-8;')
            }

        } catch (error) {
            console.error('Error exportando:', error)
            toast.error('Ocurrió un error al exportar los datos')
        } finally {
            setExporting(false)
        }
    }

    /**
     * Cargar datos iniciales
     */
    useEffect(() => {
        loadData()
        loadOptions()
    }, [])

    /**
     * Recargar cuando cambian filtros, página u ordenamiento
     */
    useEffect(() => {
        if (!loading) {
            loadData()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, currentPage, sortConfig])

    const loadData = async () => {
        setLoading(true)
        try {
            const queryFilters: DemandaFilters = {
                ...filters,
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                sortBy: sortConfig?.key,
                sortOrder: sortConfig?.direction
            }

            const [response, metricsData] = await Promise.all([
                demandaInducidaService.getAll(queryFilters),
                demandaInducidaService.getMetrics(filters), // Métricas usan filtros base
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

    // Renderizar icono de ordenamiento
    const renderSortIcon = (columnKey: string) => {
        if (sortConfig?.key !== columnKey) return <ArrowUpDown size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} className="text-primary-500" />
            : <ArrowDown size={14} className="text-primary-500" />
    }

    // Manejador de ordenamiento
    const handleSort = (key: string) => {
        setSortConfig((current) => {
            if (current?.key === key) {
                if (current.direction === 'asc') return { key, direction: 'desc' }
                return null // Tercer clic quita ordenamiento
            }
            return { key, direction: 'asc' }
        })
    }

    // Clic en tarjetas filtra la tabla
    const handleCardClick = (type: 'top' | 'efectivas' | 'no-efectivas' | 'mes') => {
        if (!metrics) return

        const nuevosFiltros = { ...filters }

        const hoy = new Date()
        const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
        const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]

        switch (type) {
            case 'top':
                if (metrics.topColaborador) {
                    const esActivo = filters.colaborador === metrics.topColaborador.nombre
                    nuevosFiltros.colaborador = esActivo ? '' : metrics.topColaborador.nombre
                }
                break
            case 'efectivas':
                nuevosFiltros.clasificacion = filters.clasificacion === 'Efectivo' ? undefined : 'Efectivo'
                break
            case 'no-efectivas':
                nuevosFiltros.clasificacion = filters.clasificacion === 'No Efectivo' ? undefined : 'No Efectivo'
                break
            case 'mes':
                const esMesActivo = filters.fechaInicio === primerDia && filters.fechaFin === ultimoDia
                if (esMesActivo) {
                    nuevosFiltros.fechaInicio = ''
                    nuevosFiltros.fechaFin = ''
                } else {
                    nuevosFiltros.fechaInicio = primerDia
                    nuevosFiltros.fechaFin = ultimoDia
                }
                break
        }

        setFilters(nuevosFiltros)
        setCurrentPage(1)
    }

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.')) return

        try {
            await demandaInducidaService.delete(id)
            setCasos((prev) => prev.filter((c) => c.id !== id))
            setTotalItems((prev) => prev - 1)
        } catch (error) {
            console.error('Error eliminando caso:', error)
            toast.error('Error al eliminar el registro')
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
            busqueda: '',
        })
        setCurrentPage(1)
        setSortConfig(null)
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
                    <h1 className="text-2xl font-bold text-slate-900 mb-6">Registrar Nuevo Caso</h1>
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
                    Registrar Nuevo Caso
                </button>
            </div>

            {/* Tarjetas de Métricas Clickeables */}
            {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Top Colaborador */}
                    {(() => {
                        const isTopColabActive = !!filters.colaborador && filters.colaborador === metrics.topColaborador?.nombre
                        return (
                            <div
                                onClick={() => handleCardClick('top')}
                                className={`rounded-2xl border p-6 transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02] ${isTopColabActive
                                    ? 'bg-primary-50 border-primary-300 shadow-md ring-1 ring-primary-200'
                                    : 'bg-white border-slate-200'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-sm">
                                        <FileText className="text-white" size={20} />
                                    </div>
                                    {isTopColabActive && <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />}
                                </div>
                                <h3 className="text-sm font-semibold text-slate-600 mb-1">Top Colaborador</h3>
                                {metrics.topColaborador ? (
                                    <>
                                        <p className="text-lg font-bold text-slate-900 truncate" title={metrics.topColaborador.nombre}>
                                            {metrics.topColaborador.nombre}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {metrics.topColaborador.totalCasos} casos • {metrics.topColaborador.efectividad.toFixed(1)}% efectividad
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-lg font-bold text-slate-400">Sin datos</p>
                                )}
                            </div>
                        )
                    })()}

                    <MetricCard
                        onClick={() => handleCardClick('efectivas')}
                        titulo="Llamadas Efectivas"
                        valor={metrics.casosEfectivos}
                        subtitulo={`${metrics.porcentajeEfectividad.toFixed(1)}%`}
                        subtituloColor="green"
                        icono={<Phone className="text-white" size={20} />}
                        color="green"
                        isActive={filters.clasificacion === 'Efectivo'}
                    />
                    <MetricCard
                        onClick={() => handleCardClick('no-efectivas')}
                        titulo="Llamadas No Efectivas"
                        valor={metrics.casosNoEfectivos}
                        subtitulo={`${metrics.porcentajeNoEfectividad.toFixed(1)}%`}
                        subtituloColor="red"
                        icono={<PhoneOff className="text-white" size={20} />}
                        color="amber"
                        isActive={filters.clasificacion === 'No Efectivo'}
                    />
                    <MetricCard
                        onClick={() => handleCardClick('mes')}
                        titulo="Casos Este Mes"
                        valor={metrics.casosMesActual}
                        icono={<Calendar className="text-white" size={20} />}
                        color="blue"
                        isActive={(() => {
                            const hoy = new Date()
                            const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
                            const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]
                            return filters.fechaInicio === primerDia && filters.fechaFin === ultimoDia
                        })()}
                    />
                </div>
            )}

            {/* Filtros y Buscador */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200 p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <Filter size={20} className="text-slate-600" />
                        <h3 className="font-bold text-slate-900">Filtros de Búsqueda</h3>
                    </div>

                    {/* Buscador Potente */}
                    <div className="relative w-full md:w-96">
                        <input
                            type="text"
                            placeholder="Buscar por identificación del paciente..."
                            value={filters.busqueda}
                            onChange={(e) => handleFilterChange('busqueda', e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 shadow-sm"
                        />
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    </div>
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

                    {['superadmin', 'admin', 'auditoria', 'gerencia'].includes(user?.rol || '') && (
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
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-10 overflow-hidden">
                                    <button
                                        onClick={() => handleExport('xlsx')}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <FileSpreadsheet size={16} className="text-green-600" />
                                        Excel (.xlsx)
                                    </button>
                                    <button
                                        onClick={() => handleExport('csv')}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <FileText size={16} className="text-blue-600" />
                                        CSV (.csv)
                                    </button>
                                    <button
                                        onClick={() => handleExport('txt')}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <FileType size={16} className="text-slate-600" />
                                        Texto (.txt)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
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
                                        <th
                                            className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                                            onClick={() => handleSort('fechaGestion')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Fecha
                                                {renderSortIcon('fechaGestion')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                                            onClick={() => handleSort('pacienteId')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Identificación
                                                {renderSortIcon('pacienteId')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                                            onClick={() => handleSort('clasificacion')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Clasificación
                                                {renderSortIcon('clasificacion')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                                            onClick={() => handleSort('programaDireccionado')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Programa
                                                {renderSortIcon('programaDireccionado')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                                            onClick={() => handleSort('colaborador')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Colaborador
                                                {renderSortIcon('colaborador')}
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Resultado
                                        </th>

                                        {(['superadmin', 'admin'].includes(user?.rol || '') || casos.some(c => c.colaborador === user?.nombreCompleto)) && (
                                            <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">
                                                Acciones
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {casos.map((caso) => (
                                        <tr
                                            key={caso.id}
                                            className="hover:bg-primary-50/30 transition-colors cursor-pointer group/row"
                                            onClick={() => setCasoSeleccionado(caso)}
                                        >
                                            <td className="px-4 py-4 text-sm text-slate-900 font-medium">
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

                                            {(['superadmin', 'admin'].includes(user?.rol || '') || caso.colaborador === user?.nombreCompleto) && (
                                                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    {(['superadmin', 'admin'].includes(user?.rol || '') || caso.colaborador === user?.nombreCompleto) && (
                                                        <button
                                                            onClick={() => handleDelete(caso.id!)}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors group-hover/row:scale-110"
                                                            title="Eliminar registro"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </td>
                                            )}
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
                )
                }
            </div >

            {/* Panel de Detalle */}
            {casoSeleccionado && (
                <DemandaDetallePanel
                    caso={casoSeleccionado}
                    onClose={() => setCasoSeleccionado(null)}
                    onUpdate={loadData}
                />
            )}
        </div >
    )
}

/**
 * Componente de Tarjeta de Métrica
 */
function MetricCard({
    titulo,
    valor,
    subtitulo,
    subtituloColor,
    icono,
    color,
    onClick,
    isActive = false,
}: {
    titulo: string
    valor: number
    subtitulo?: string
    subtituloColor?: 'green' | 'red'
    icono: React.ReactNode
    color: 'primary' | 'green' | 'amber' | 'blue'
    onClick?: () => void
    isActive?: boolean
}) {
    const colorClasses = {
        primary: {
            gradient: 'from-primary-500 to-primary-600',
            active: 'bg-primary-50 border-primary-300 ring-primary-100',
            dot: 'bg-primary-500'
        },
        green: {
            gradient: 'from-green-500 to-green-600',
            active: 'bg-green-50 border-green-300 ring-green-100',
            dot: 'bg-green-500'
        },
        amber: {
            gradient: 'from-amber-500 to-amber-600',
            active: 'bg-amber-50 border-amber-300 ring-amber-100',
            dot: 'bg-amber-500'
        },
        blue: {
            gradient: 'from-blue-500 to-blue-600',
            active: 'bg-blue-50 border-blue-300 ring-blue-100',
            dot: 'bg-blue-500'
        },
    }

    const subtituloClasses = {
        green: 'text-green-600',
        red: 'text-red-600',
    }

    const currentStyles = colorClasses[color]

    return (
        <div
            onClick={onClick}
            className={`rounded-2xl border p-6 transition-all shadow-sm ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : 'hover:shadow-md'
                } ${isActive
                    ? `${currentStyles.active} shadow-md ring-1`
                    : 'bg-white border-slate-200'
                }`}
        >
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 bg-gradient-to-br ${currentStyles.gradient} rounded-xl shadow-sm`}>
                    {icono}
                </div>
                {isActive && (
                    <div className={`w-2.5 h-2.5 rounded-full ${currentStyles.dot} animate-pulse shadow-sm`} />
                )}
            </div>
            <h3 className="text-sm font-semibold text-slate-600 mb-1">{titulo}</h3>
            <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-slate-900">{valor.toLocaleString()}</p>
                {subtitulo && (
                    <p className={`text-sm font-semibold ${subtituloClasses[subtituloColor || 'green']}`}>
                        {subtitulo}
                    </p>
                )}
            </div>
        </div>
    )
}
