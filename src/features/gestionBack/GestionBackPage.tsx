/**
 * Página de Gestión Back y Auditoría
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Vista principal para gestionar casos de back office con:
 * - Cards de conteo clickeables como filtros rápidos
 * - Tabla optimizada con búsqueda y filtros avanzados
 * - Panel de detalle para gestión de casos
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Search,
    Filter,
    Calendar,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    X,
    Stethoscope,
    BookOpen,
    FileEdit,
    Activity,
    Zap,
    Route,
    AlertCircle,
    HeartPulse,
    Layers,
    Bone,
    Droplets,
    Ear,
    Accessibility,
} from 'lucide-react'
import { Card, Button, Input, LoadingOverlay } from '@/components/common'
import { backService } from '@/services/back.service'
import {
    BackRadicacionExtendido,
    FiltrosCasosBack,
    ConteosCasosBack,
    TIPO_SOLICITUD_COLORES,
    ESPECIALIDAD_COLORES,
    ESTADO_COLORES,
    ESTADOS_RADICADO_LISTA,
    TIPOS_SOLICITUD_LISTA,
    ESPECIALIDADES_LISTA,
    EstadoRadicado,
    TipoSolicitudBack,
    RUTA_COLORES,
} from '@/types/back.types'
import { CasoDetallePanel } from './CasoDetallePanel'

// Iconos por tipo de solicitud
const TIPO_ICONOS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    'Auditoría Médica': Stethoscope,
    'Solicitud de Historia Clínica': BookOpen,
    'Ajuste de Ordenamiento': FileEdit,
    'Renovación de prequirúrgicos': Activity,
    'Gestión de Mipres': Zap,
    'Activación de Ruta': Route,
}

// Iconos por especialidad
const ESPECIALIDAD_ICONOS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    'Medicina Interna': HeartPulse,
    'Dermatología': Layers,
    'Ortopedia': Bone,
    'Urología': Droplets,
    'Otorrinolaringología': Ear,
    'Reumatología': Accessibility,
}

const ITEMS_POR_PAGINA = 30

export function GestionBackPage() {
    // ============================================
    // ESTADO
    // ============================================

    // Datos
    const [casos, setCasos] = useState<BackRadicacionExtendido[]>([])
    const [conteos, setConteos] = useState<ConteosCasosBack | null>(null)
    const [total, setTotal] = useState(0)

    // Paginación
    const [paginaActual, setPaginaActual] = useState(0)

    // Filtros
    const [filtros, setFiltros] = useState<FiltrosCasosBack>({
        estadoRadicado: 'Pendiente',
        sortField: 'created_at',
        sortOrder: 'desc',
    })
    const [busquedaInput, setBusquedaInput] = useState('')
    const [mostrarFiltros, setMostrarFiltros] = useState(false)

    // Estado de carga
    const [cargando, setCargando] = useState(true)
    const [cargandoConteos, setCargandoConteos] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Panel de detalle
    const [casoSeleccionado, setCasoSeleccionado] = useState<BackRadicacionExtendido | null>(null)
    const [indiceSeleccionado, setIndiceSeleccionado] = useState<number>(-1)

    // ============================================
    // FUNCIONES DE CARGA
    // ============================================

    const cargarConteos = useCallback(async () => {
        setCargandoConteos(true)
        const result = await backService.obtenerConteosPendientes()
        if (result.success && result.data) {
            setConteos(result.data)
        }
        setCargandoConteos(false)
    }, [])

    const cargarCasos = useCallback(async (nuevasPagina = 0) => {
        setCargando(true)
        setError(null)

        const result = await backService.obtenerCasosFiltrados(
            filtros,
            nuevasPagina * ITEMS_POR_PAGINA,
            ITEMS_POR_PAGINA
        )

        if (result.success && result.data) {
            setCasos(result.data.casos)
            setTotal(result.data.total)
            setPaginaActual(nuevasPagina)
        } else {
            setError(result.error || 'Error cargando casos')
            setCasos([])
        }
        setCargando(false)
    }, [filtros])

    // Cargar datos iniciales
    useEffect(() => {
        cargarConteos()
    }, [cargarConteos])

    // Recargar casos cuando cambian filtros
    useEffect(() => {
        cargarCasos(0)
    }, [cargarCasos])

    // ============================================
    // HANDLERS DE FILTROS
    // ============================================

    const handleBuscar = useCallback(() => {
        setFiltros(prev => ({
            ...prev,
            busqueda: busquedaInput.trim() || undefined,
            estadoRadicado: 'Todos' // Al buscar, mostrar todos los estados
        }))
    }, [busquedaInput])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBuscar()
        }
    }, [handleBuscar])

    const handleLimpiarBusqueda = useCallback(() => {
        setBusquedaInput('')
        setFiltros(prev => ({ ...prev, busqueda: undefined }))
    }, [])

    const handleFiltroTipo = useCallback((tipo: TipoSolicitudBack | null) => {
        setFiltros(prev => ({
            ...prev,
            tipoSolicitud: prev.tipoSolicitud === tipo ? null : tipo,
        }))
    }, [])

    const handleFiltroEspecialidad = useCallback((especialidad: string | null) => {
        setFiltros(prev => ({
            ...prev,
            especialidad: prev.especialidad === especialidad ? null : especialidad,
        }))
    }, [])

    const handleFiltroRuta = useCallback((ruta: string | null) => {
        setFiltros(prev => ({
            ...prev,
            ruta: prev.ruta === ruta ? null : ruta,
        }))
    }, [])

    const handleFiltroEstado = useCallback((estado: EstadoRadicado | 'Todos') => {
        setFiltros(prev => ({ ...prev, estadoRadicado: estado }))
    }, [])

    const handleLimpiarFiltros = useCallback(() => {
        setBusquedaInput('')
        setFiltros({
            estadoRadicado: 'Pendiente',
            sortField: 'created_at',
            sortOrder: 'desc'
        })
    }, [])

    const handleSort = useCallback((field: 'radicado' | 'id' | 'tipo_solicitud' | 'especialidad' | 'estado_radicado' | 'created_at') => {
        setFiltros(prev => {
            if (prev.sortField === field) {
                // Si es el mismo campo, invertir orden
                return {
                    ...prev,
                    sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
                }
            } else {
                // Si es nuevo campo, definir default según naturaleza
                // Fechas: Descendente (más reciente primero)
                // Textos/IDs: Ascendente (A-Z, 0-9)
                const defaultOrder = field === 'created_at' ? 'desc' : 'asc'
                return {
                    ...prev,
                    sortField: field,
                    sortOrder: defaultOrder
                }
            }
        })
    }, [])

    // ============================================
    // HANDLERS DE PAGINACIÓN
    // ============================================

    const totalPaginas = useMemo(() => Math.ceil(total / ITEMS_POR_PAGINA), [total])

    const handlePaginaAnterior = useCallback(() => {
        if (paginaActual > 0) {
            cargarCasos(paginaActual - 1)
        }
    }, [paginaActual, cargarCasos])

    const handlePaginaSiguiente = useCallback(() => {
        if (paginaActual < totalPaginas - 1) {
            cargarCasos(paginaActual + 1)
        }
    }, [paginaActual, totalPaginas, cargarCasos])

    // ============================================
    // HANDLERS DE SELECCIÓN DE CASO
    // ============================================

    const handleSeleccionarCaso = useCallback((caso: BackRadicacionExtendido, indice: number) => {
        setCasoSeleccionado(caso)
        setIndiceSeleccionado(indice)
    }, [])

    const handleCerrarDetalle = useCallback(() => {
        setCasoSeleccionado(null)
        setIndiceSeleccionado(-1)
    }, [])

    const handleGuardarYCerrar = useCallback(async () => {
        handleCerrarDetalle()
        await cargarCasos(paginaActual)
        await cargarConteos()
    }, [handleCerrarDetalle, cargarCasos, paginaActual, cargarConteos])

    const handleGuardarYSiguiente = useCallback(async () => {
        await cargarCasos(paginaActual)
        await cargarConteos()

        // Ir al siguiente caso
        const nuevoIndice = indiceSeleccionado + 1
        if (nuevoIndice < casos.length) {
            setCasoSeleccionado(casos[nuevoIndice])
            setIndiceSeleccionado(nuevoIndice)
        } else {
            // Si no hay más casos en esta página, cerrar
            handleCerrarDetalle()
        }
    }, [cargarCasos, cargarConteos, paginaActual, indiceSeleccionado, casos, handleCerrarDetalle])

    // ============================================
    // HELPERS
    // ============================================

    const getNombreCompleto = (caso: BackRadicacionExtendido) => {
        if (!caso.paciente) return 'Sin datos'
        return [caso.paciente.nombres, caso.paciente.apellido1, caso.paciente.apellido2]
            .filter(Boolean)
            .join(' ')
    }

    const formatFecha = (fecha: Date) => {
        return new Intl.DateTimeFormat('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(fecha)
    }

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="space-y-6 pb-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                    Gestión Back y Auditoría
                </h1>
                <p className="text-gray-500 mt-1">
                    Gestiona y da respuesta a los casos radicados
                </p>
            </div>

            {/* ============================================ */}
            {/* CARDS DE CONTEO - TIPO DE SOLICITUD */}
            {/* ============================================ */}
            <div>
                <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                    <Filter size={16} />
                    Pendientes por Tipo de Solicitud
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {cargandoConteos ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                        ))
                    ) : (
                        TIPOS_SOLICITUD_LISTA.map(tipo => {
                            const conteo = conteos?.porTipoSolicitud.find(c => c.tipo === tipo)?.cantidad || 0
                            const colores = TIPO_SOLICITUD_COLORES[tipo]
                            const IconoTipo = TIPO_ICONOS[tipo] || AlertCircle
                            const activo = filtros.tipoSolicitud === tipo

                            return (
                                <button
                                    key={tipo}
                                    onClick={() => handleFiltroTipo(tipo)}
                                    className={`
                                        relative p-4 rounded-xl border-2 transition-all duration-300
                                        hover:shadow-lg hover:-translate-y-0.5 flex flex-col items-center text-center
                                        ${activo
                                            ? `${colores.bg} ${colores.border} shadow-md ring-2 ring-offset-2 ring-${colores.border.replace('border-', '')}`
                                            : 'bg-white border-gray-100 hover:border-gray-200'
                                        }
                                    `}
                                >
                                    <div className="flex items-center justify-center gap-3 mb-2">
                                        <div className={`w-10 h-10 rounded-lg ${colores.bg} flex items-center justify-center flex-shrink-0`}>
                                            <IconoTipo size={20} className={colores.text} />
                                        </div>
                                        <p className={`text-3xl font-bold ${activo ? colores.text : 'text-gray-800'}`}>
                                            {conteo}
                                        </p>
                                    </div>
                                    <p className="text-sm text-gray-600 font-medium leading-snug" title={tipo}>
                                        {tipo}
                                    </p>
                                    {activo && (
                                        <div className="absolute top-2 right-2">
                                            <X size={14} className={colores.text} />
                                        </div>
                                    )}
                                </button>
                            )
                        })
                    )}
                </div>
            </div>

            {/* ============================================ */}
            {/* CARDS DE CONTEO - ESPECIALIDAD */}
            {/* ============================================ */}
            <div>
                <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                    <Stethoscope size={16} />
                    Pendientes por Especialidad
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {cargandoConteos ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                        ))
                    ) : (
                        ESPECIALIDADES_LISTA.map(especialidad => {
                            const conteo = conteos?.porEspecialidad.find(c => c.especialidad === especialidad)?.cantidad || 0
                            const colores = ESPECIALIDAD_COLORES[especialidad] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
                            const activo = filtros.especialidad === especialidad

                            const IconoEspecialidad = ESPECIALIDAD_ICONOS[especialidad] || Activity

                            return (
                                <button
                                    key={especialidad}
                                    onClick={() => handleFiltroEspecialidad(especialidad)}
                                    className={`
                                        relative p-4 rounded-xl border-2 transition-all duration-300
                                        hover:shadow-md hover:-translate-y-0.5 flex flex-col items-center text-center
                                        ${activo
                                            ? `${colores.bg} ${colores.border} shadow-md`
                                            : 'bg-white border-gray-100 hover:border-gray-200'
                                        }
                                    `}
                                >
                                    <div className="flex items-center justify-center gap-3 mb-2">
                                        <div className={`w-8 h-8 rounded-lg ${colores.bg} flex items-center justify-center flex-shrink-0 bg-opacity-50`}>
                                            <IconoEspecialidad size={18} className={colores.text} />
                                        </div>
                                        <p className={`text-2xl font-bold ${activo ? colores.text : 'text-gray-800'}`}>
                                            {conteo}
                                        </p>
                                    </div>
                                    <p className="text-xs text-gray-600 font-medium leading-tight" title={especialidad}>
                                        {especialidad}
                                    </p>
                                    {activo && (
                                        <div className="absolute top-2 right-2">
                                            <X size={12} className={colores.text} />
                                        </div>
                                    )}
                                </button>
                            )
                        })
                    )}
                </div>
            </div>

            {/* ============================================ */}
            {/* CARDS DE CONTEO - RUTA */}
            {/* ============================================ */}
            <div>
                <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                    <Route size={16} />
                    Pendientes por Ruta
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {cargandoConteos ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                        ))
                    ) : (
                        conteos?.porRuta && conteos.porRuta.length > 0 ? (
                            conteos.porRuta.map(({ ruta, cantidad }) => {
                                // Buscar config para colores e iconos
                                const colores = RUTA_COLORES[ruta] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
                                const activo = filtros.ruta === ruta

                                // Importar icono dinámico si es posible, o usar default
                                // Nota: En este contexto no tenemos acceso fácil a todos los iconos dinámicos sin un mapa grande
                                // Usamos Route como fallback genérico o intentamos mapear algunos comunes si se desea
                                const IconoRuta = Route

                                return (
                                    <button
                                        key={ruta}
                                        onClick={() => handleFiltroRuta(ruta)}
                                        className={`
                                        relative p-4 rounded-xl border-2 transition-all duration-300
                                        hover:shadow-md hover:-translate-y-0.5 flex flex-col items-center text-center
                                        ${activo
                                                ? `${colores.bg} ${colores.border} shadow-md`
                                                : 'bg-white border-gray-100 hover:border-gray-200'
                                            }
                                    `}
                                    >
                                        <div className="flex items-center justify-center gap-3 mb-2">
                                            <div className={`w-8 h-8 rounded-lg ${colores.bg} flex items-center justify-center flex-shrink-0 bg-opacity-50`}>
                                                <IconoRuta size={18} className={colores.text} />
                                            </div>
                                            <p className={`text-2xl font-bold ${activo ? colores.text : 'text-gray-800'}`}>
                                                {cantidad}
                                            </p>
                                        </div>
                                        <p className="text-xs text-gray-600 font-medium leading-tight truncate w-full" title={ruta}>
                                            {ruta}
                                        </p>
                                        {activo && (
                                            <div className="absolute top-2 right-2">
                                                <X size={12} className={colores.text} />
                                            </div>
                                        )}
                                    </button>
                                )
                            })
                        ) : (
                            <div className="col-span-full p-4 text-center text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                No hay casos de ruta pendientes
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* ============================================ */}
            {/* BARRA DE BÚSQUEDA Y FILTROS */}
            {/* ============================================ */}
            <Card className="bg-[var(--color-primary-50)] border-[var(--color-primary-200)] shadow-md">
                <Card.Body className="space-y-4">
                    {/* Barra principal */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Buscador */}
                        <div className="flex-1 relative">
                            <Input
                                placeholder="Buscar por radicado, nombres/apellidos o identificación..."
                                value={busquedaInput}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusquedaInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                leftIcon={<Search size={18} />}
                            />
                            {busquedaInput && (
                                <button
                                    onClick={handleLimpiarBusqueda}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                                >
                                    <X size={16} className="text-gray-400" />
                                </button>
                            )}
                        </div>

                        {/* Botones */}
                        <div className="flex gap-2">
                            <Button
                                onClick={handleBuscar}
                                leftIcon={<Search size={18} />}
                            >
                                Buscar
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                                leftIcon={<Filter size={18} />}
                                className={mostrarFiltros ? 'bg-gray-100' : ''}
                            >
                                Filtros
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    cargarCasos(paginaActual)
                                    cargarConteos()
                                }}
                                leftIcon={<RefreshCw size={18} />}
                                title="Refrescar"
                            />
                        </div>
                    </div>

                    {/* Filtros expandidos */}
                    {mostrarFiltros && (
                        <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100 animate-fade-in">
                            {/* Estado */}
                            <div className="min-w-[150px]">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                                <select
                                    value={filtros.estadoRadicado || 'Todos'}
                                    onChange={(e) => handleFiltroEstado(e.target.value as EstadoRadicado | 'Todos')}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                >
                                    {ESTADOS_RADICADO_LISTA.map(estado => (
                                        <option key={estado} value={estado}>{estado}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Fecha inicio */}
                            <div className="min-w-[150px]">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={filtros.fechaInicio || ''}
                                        onChange={(e) => setFiltros(prev => ({ ...prev, fechaInicio: e.target.value || undefined }))}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                    />
                                    <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Fecha fin */}
                            <div className="min-w-[150px]">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={filtros.fechaFin || ''}
                                        onChange={(e) => setFiltros(prev => ({ ...prev, fechaFin: e.target.value || undefined }))}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                    />
                                    <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Limpiar filtros */}
                            <div className="flex items-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLimpiarFiltros}
                                    className="text-gray-500"
                                >
                                    Limpiar todo
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Chips de filtros activos */}
                    {(filtros.tipoSolicitud || filtros.especialidad || filtros.busqueda) && (
                        <div className="flex flex-wrap gap-2">
                            {filtros.busqueda && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                                    Búsqueda: "{filtros.busqueda}"
                                    <button onClick={handleLimpiarBusqueda} className="hover:text-gray-900">
                                        <X size={14} />
                                    </button>
                                </span>
                            )}
                            {filtros.tipoSolicitud && (
                                <span className={`inline-flex items-center gap-1 px-3 py-1 ${TIPO_SOLICITUD_COLORES[filtros.tipoSolicitud]?.bg} ${TIPO_SOLICITUD_COLORES[filtros.tipoSolicitud]?.text} rounded-full text-sm`}>
                                    {filtros.tipoSolicitud}
                                    <button onClick={() => handleFiltroTipo(null)} className="hover:opacity-70">
                                        <X size={14} />
                                    </button>
                                </span>
                            )}
                            {filtros.especialidad && (
                                <span className={`inline-flex items-center gap-1 px-3 py-1 ${ESPECIALIDAD_COLORES[filtros.especialidad]?.bg || 'bg-gray-100'} ${ESPECIALIDAD_COLORES[filtros.especialidad]?.text || 'text-gray-700'} rounded-full text-sm`}>
                                    {filtros.especialidad}
                                    <button onClick={() => handleFiltroEspecialidad(null)} className="hover:opacity-70">
                                        <X size={14} />
                                    </button>
                                </span>
                            )}
                            {filtros.ruta && (
                                <span className={`inline-flex items-center gap-1 px-3 py-1 ${RUTA_COLORES[filtros.ruta]?.bg || 'bg-gray-100'} ${RUTA_COLORES[filtros.ruta]?.text || 'text-gray-700'} rounded-full text-sm`}>
                                    {filtros.ruta}
                                    <button onClick={() => handleFiltroRuta(null)} className="hover:opacity-70">
                                        <X size={14} />
                                    </button>
                                </span>
                            )}            </div>
                    )}
                </Card.Body>
            </Card>

            {/* ============================================ */}
            {/* TABLA DE CASOS */}
            {/* ============================================ */}
            <LoadingOverlay isLoading={cargando} label="Cargando casos...">
                <Card>
                    <Card.Body className="p-0">
                        {error ? (
                            <div className="p-8 text-center">
                                <AlertCircle className="mx-auto mb-4 text-red-400" size={48} />
                                <p className="text-red-600">{error}</p>
                                <Button
                                    variant="ghost"
                                    className="mt-4"
                                    onClick={() => cargarCasos(0)}
                                >
                                    Reintentar
                                </Button>
                            </div>
                        ) : casos.length === 0 ? (
                            <div className="p-12 text-center">
                                <Search className="mx-auto mb-4 text-gray-300" size={48} />
                                <p className="text-gray-500">No se encontraron casos con los filtros seleccionados</p>
                            </div>
                        ) : (
                            <>
                                {/* Header de resultados */}
                                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                    <p className="text-sm text-gray-600">
                                        Mostrando <span className="font-semibold">{casos.length}</span> de <span className="font-semibold">{total}</span> casos
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handlePaginaAnterior}
                                            disabled={paginaActual === 0}
                                            leftIcon={<ChevronLeft size={16} />}
                                        >
                                            Anterior
                                        </Button>
                                        <span className="text-sm text-gray-600">
                                            Página {paginaActual + 1} de {totalPaginas || 1}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handlePaginaSiguiente}
                                            disabled={paginaActual >= totalPaginas - 1}
                                            rightIcon={<ChevronRight size={16} />}
                                        >
                                            Siguiente
                                        </Button>
                                    </div>
                                </div>

                                {/* Tabla */}
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-100">
                                                <th
                                                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                                    onClick={() => handleSort('radicado')}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        Radicado
                                                        {filtros.sortField === 'radicado' && (
                                                            <span className="text-[var(--color-primary)]">
                                                                {filtros.sortOrder === 'asc' ? '↑' : '↓'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                                    onClick={() => handleSort('id')}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        Paciente
                                                        {filtros.sortField === 'id' && (
                                                            <span className="text-[var(--color-primary)]">
                                                                {filtros.sortOrder === 'asc' ? '↑' : '↓'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                                    onClick={() => handleSort('tipo_solicitud')}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        Tipo
                                                        {filtros.sortField === 'tipo_solicitud' && (
                                                            <span className="text-[var(--color-primary)]">
                                                                {filtros.sortOrder === 'asc' ? '↑' : '↓'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                                    onClick={() => handleSort('especialidad')}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        Especialidad
                                                        {filtros.sortField === 'especialidad' && (
                                                            <span className="text-[var(--color-primary)]">
                                                                {filtros.sortOrder === 'asc' ? '↑' : '↓'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                                    onClick={() => handleSort('estado_radicado')}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        Estado
                                                        {filtros.sortField === 'estado_radicado' && (
                                                            <span className="text-[var(--color-primary)]">
                                                                {filtros.sortOrder === 'asc' ? '↑' : '↓'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                                    onClick={() => handleSort('created_at')}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        Fecha
                                                        {filtros.sortField === 'created_at' && (
                                                            <span className="text-[var(--color-primary)]">
                                                                {filtros.sortOrder === 'asc' ? '↑' : '↓'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {casos.map((caso, index) => {
                                                const estadoColor = ESTADO_COLORES[caso.estadoRadicado] || ESTADO_COLORES['Pendiente']
                                                const tipoColor = TIPO_SOLICITUD_COLORES[caso.tipoSolicitud]

                                                return (
                                                    <tr
                                                        key={caso.radicado}
                                                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                                        onClick={() => handleSeleccionarCaso(caso, index)}
                                                    >
                                                        <td className="px-4 py-3">
                                                            <span className="font-mono font-semibold text-[var(--color-primary)]">
                                                                {caso.radicado}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div>
                                                                <p className="font-medium text-gray-800 truncate max-w-[200px]">
                                                                    {getNombreCompleto(caso)}
                                                                </p>
                                                                <p className="text-xs text-gray-500">{caso.id}</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${tipoColor?.bg} ${tipoColor?.text}`}>
                                                                {caso.tipoSolicitud?.split(' ')[0] || '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">
                                                            {caso.especialidad || '—'}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${estadoColor.bg} ${estadoColor.text}`}>
                                                                {caso.estadoRadicado || 'Pendiente'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-500">
                                                            {formatFecha(caso.createdAt)}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Footer de paginación */}
                                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handlePaginaAnterior}
                                        disabled={paginaActual === 0}
                                        leftIcon={<ChevronLeft size={16} />}
                                    >
                                        Anterior
                                    </Button>
                                    <span className="text-sm text-gray-600">
                                        Página {paginaActual + 1} de {totalPaginas || 1}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handlePaginaSiguiente}
                                        disabled={paginaActual >= totalPaginas - 1}
                                        rightIcon={<ChevronRight size={16} />}
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            </>
                        )}
                    </Card.Body>
                </Card>
            </LoadingOverlay>

            {/* ============================================ */}
            {/* PANEL DE DETALLE */}
            {/* ============================================ */}
            {
                casoSeleccionado && (
                    <CasoDetallePanel
                        caso={casoSeleccionado}
                        onClose={handleCerrarDetalle}
                        onGuardarYCerrar={handleGuardarYCerrar}
                        onGuardarYSiguiente={handleGuardarYSiguiente}
                        onCasoEliminado={() => {
                            cargarCasos(paginaActual)
                            cargarConteos()
                        }}
                        haySiguiente={indiceSeleccionado < casos.length - 1}
                    />
                )
            }
        </div >
    )
}

export default GestionBackPage
