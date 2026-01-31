import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
    Search,
    Loader2,
    FileText,
    Trash2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    X,
    ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { Card, Button, Input } from '@/components/common'
import { soportesFacturacionService } from '@/services/soportesFacturacion.service'
import {
    SoporteFacturacion,
    ESTADOS_SOPORTE_LISTA,
    ESTADO_COLORES,
    EPS_FACTURACION_LISTA,
    SERVICIOS_PRESTADOS_LISTA,
    FiltrosSoportesFacturacion,
    RadicadorUnico,
} from '@/types/soportesFacturacion.types'
import { RadicacionDetallePanel } from './RadicacionDetallePanel'

const ITEMS_POR_PAGINA = 20

// Componente Badge simple
const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
        {children}
    </span>
)

// Componente Autocomplete para radicadores
interface RadicadorAutocompleteProps {
    radicadores: RadicadorUnico[]
    value: string
    onChange: (nombre: string) => void
    placeholder?: string
}

function RadicadorAutocomplete({ radicadores, value, onChange, placeholder = 'Buscar radicador...' }: RadicadorAutocompleteProps) {
    const [inputValue, setInputValue] = useState(value)
    const [isOpen, setIsOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Sincronizar inputValue cuando value cambia externamente
    useEffect(() => {
        setInputValue(value)
    }, [value])

    // Cerrar dropdown al hacer clic fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Filtrar radicadores basado en el input (búsqueda flexible por palabras)
    const filteredRadicadores = useMemo(() => {
        if (!inputValue.trim()) return radicadores

        const palabras = inputValue.toLowerCase().trim().split(/\s+/).filter(p => p.length > 0)
        return radicadores.filter(r => {
            const nombreLower = r.nombre.toLowerCase()
            // Todas las palabras deben estar presentes en el nombre
            return palabras.every(palabra => nombreLower.includes(palabra))
        })
    }, [radicadores, inputValue])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        setInputValue(newValue)
        setIsOpen(true)
        // No aplicar filtro hasta que el usuario seleccione o presione enter
    }

    const handleSelect = (radicador: RadicadorUnico) => {
        setInputValue(radicador.nombre)
        onChange(radicador.nombre)
        setIsOpen(false)
    }

    const handleClear = () => {
        setInputValue('')
        onChange('')
        inputRef.current?.focus()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            // Si hay exactamente una coincidencia, seleccionarla
            if (filteredRadicadores.length === 1) {
                handleSelect(filteredRadicadores[0])
            } else if (inputValue.trim()) {
                // Aplicar el filtro con el texto actual
                onChange(inputValue.trim())
                setIsOpen(false)
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false)
        }
    }

    return (
        <div className="relative" ref={containerRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)] pr-16"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                    {inputValue && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        >
                            <X size={14} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {isOpen && filteredRadicadores.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredRadicadores.map((radicador, index) => (
                        <button
                            key={`${radicador.email}-${index}`}
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                            onClick={() => handleSelect(radicador)}
                        >
                            <div className="text-sm font-medium text-gray-900">{radicador.nombre}</div>
                            <div className="text-xs text-gray-500">{radicador.email.split('@')[0]}</div>
                        </button>
                    ))}
                </div>
            )}

            {isOpen && inputValue && filteredRadicadores.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3 text-sm text-gray-500">
                    No se encontraron radicadores
                </div>
            )}
        </div>
    )
}

export function GestionRadicadosView() {
    const { user } = useAuth()
    const esAdmin = user?.rol === 'admin' || user?.rol === 'superadmin'
    // ============================================
    // ESTADO
    // ============================================
    const [casos, setCasos] = useState<SoporteFacturacion[]>([])
    const [total, setTotal] = useState(0)
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Filtros
    const [filtros, setFiltros] = useState<FiltrosSoportesFacturacion>({
        estado: 'Pendiente',
    })
    const [busquedaInput, setBusquedaInput] = useState('')

    // Paginación
    const [paginaActual, setPaginaActual] = useState(0)

    // Conteos
    const [conteos, setConteos] = useState<Record<string, number>>({})

    // Radicadores únicos para autocomplete
    const [radicadores, setRadicadores] = useState<RadicadorUnico[]>([])

    // Panel Detalle
    const [casoSeleccionado, setCasoSeleccionado] = useState<SoporteFacturacion | null>(null)

    // ============================================
    // CARGA DE DATOS
    // ============================================
    const cargarDatos = useCallback(async () => {
        setCargando(true)
        setError(null)

        try {
            const offset = paginaActual * ITEMS_POR_PAGINA
            const result = await soportesFacturacionService.obtenerListaFiltrada(
                filtros,
                offset,
                ITEMS_POR_PAGINA
            )

            if (result.success && result.data) {
                setCasos(result.data.soportes)
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
        const result = await soportesFacturacionService.obtenerConteosPorEstado()
        if (result.success && result.data) {
            setConteos(result.data)
        }
    }, [])

    const cargarRadicadores = useCallback(async () => {
        const result = await soportesFacturacionService.obtenerRadicadoresUnicos()
        if (result.success && result.data) {
            setRadicadores(result.data)
        }
    }, [])

    useEffect(() => {
        cargarDatos()
    }, [cargarDatos])

    useEffect(() => {
        cargarConteos()
        cargarRadicadores()
    }, [cargarConteos, cargarRadicadores])

    // ============================================
    // HANDLERS
    // ============================================
    const handleBuscar = (e: React.FormEvent) => {
        e.preventDefault()
        setFiltros(prev => ({
            ...prev,
            busqueda: busquedaInput || undefined,
            estado: 'Todos' // Al buscar, buscar en todos los estados por defecto
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
            estado: estado as any
        }))
        setPaginaActual(0)
    }

    const handleVerDetalle = (caso: SoporteFacturacion) => {
        setCasoSeleccionado(caso)
    }

    const handleCerrarDetalle = () => {
        setCasoSeleccionado(null)
    }

    const handleActualizacionExitosa = () => {
        // Recargar datos y conteos
        cargarDatos()
        cargarConteos()
    }

    const handleEliminar = async (e: React.MouseEvent, radicado: string) => {
        e.stopPropagation() // Evitar abrir el detalle

        if (!window.confirm(`¿Está seguro de eliminar el radicado ${radicado}? Esta acción es irreversible.`)) {
            return
        }

        try {
            const result = await soportesFacturacionService.eliminarRadicado(radicado)
            if (result.success) {
                toast.success(`Radicado ${radicado} eliminado exitosamente`)
                cargarDatos()
                cargarConteos()
            } else {
                toast.error(result.error || 'Error al eliminar el radicado')
            }
        } catch (error) {
            console.error(error)
            toast.error('Error procesando la solicitud')
        }
    }

    const handleSort = (columna: FiltrosSoportesFacturacion['sortBy']) => {
        setFiltros(prev => {
            const isAsc = prev.sortBy === columna && prev.sortOrder === 'asc'
            return {
                ...prev,
                sortBy: columna,
                sortOrder: isAsc ? 'desc' : 'asc'
            }
        })
        setPaginaActual(0)
    }

    const renderSortIcon = (columna: string) => {
        if (filtros.sortBy !== columna) return <ArrowUpDown size={14} className="ml-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        return filtros.sortOrder === 'asc'
            ? <ArrowUp size={14} className="ml-1 text-[var(--color-primary)]" />
            : <ArrowDown size={14} className="ml-1 text-[var(--color-primary)]" />
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {ESTADOS_SOPORTE_LISTA.filter(e => e !== 'Todos').map(estado => {
                    const count = conteos[estado] || 0
                    const color = ESTADO_COLORES[estado as keyof typeof ESTADO_COLORES]
                    const isSelected = filtros.estado === estado

                    return (
                        <div
                            key={estado}
                            onClick={() => handleFiltroEstado(estado)}
                            className={`
                                cursor-pointer rounded-xl p-4 border transition-all
                                ${isSelected
                                    ? `ring-2 ring-[var(--color-primary)] border-transparent bg-white shadow-md`
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                                }
                            `}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-sm font-medium ${color?.text || 'text-gray-600'}`}>
                                    {estado}
                                </span>
                                <div className={`p-1.5 rounded-full ${color?.bg} ${color?.text}`}>
                                    <FileText size={14} />
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
                                placeholder="Buscar por radicado, identificación, nombre o ID en archivos..."
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

                    <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-100">
                        <div className="w-48">
                            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">EPS</label>
                            <select
                                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                value={filtros.eps || ''}
                                onChange={(e) => setFiltros(prev => ({ ...prev, eps: e.target.value as any || undefined }))}
                            >
                                <option value="">Todas</option>
                                {EPS_FACTURACION_LISTA.map(eps => (
                                    <option key={eps} value={eps}>{eps}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-48">
                            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Estado</label>
                            <select
                                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                value={filtros.estado || 'Todos'}
                                onChange={(e) => handleFiltroEstado(e.target.value)}
                            >
                                {ESTADOS_SOPORTE_LISTA.map(estado => (
                                    <option key={estado} value={estado}>{estado}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-56">
                            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Servicio Prestado</label>
                            <select
                                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                value={filtros.servicioPrestado || ''}
                                onChange={(e) => {
                                    setFiltros(prev => ({ ...prev, servicioPrestado: e.target.value as any || undefined }))
                                    setPaginaActual(0)
                                }}
                            >
                                <option value="">Todos los servicios</option>
                                {SERVICIOS_PRESTADOS_LISTA.map(servicio => (
                                    <option key={servicio} value={servicio}>{servicio}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-56">
                            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Radicador</label>
                            <RadicadorAutocomplete
                                radicadores={radicadores}
                                value={filtros.radicadorNombre || ''}
                                onChange={(nombre) => {
                                    setFiltros(prev => ({ ...prev, radicadorNombre: nombre || undefined }))
                                    setPaginaActual(0)
                                }}
                                placeholder="Buscar por nombre..."
                            />
                        </div>
                        <div className="w-40">
                            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">F. Atención Desde</label>
                            <Input
                                type="date"
                                className="w-full text-sm"
                                value={filtros.fechaAtencionInicio || ''}
                                onChange={(e) => {
                                    setFiltros(prev => ({ ...prev, fechaAtencionInicio: e.target.value || undefined }))
                                    setPaginaActual(0)
                                }}
                            />
                        </div>
                        <div className="w-40">
                            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">F. Atención Hasta</label>
                            <Input
                                type="date"
                                className="w-full text-sm"
                                value={filtros.fechaAtencionFin || ''}
                                onChange={(e) => {
                                    setFiltros(prev => ({ ...prev, fechaAtencionFin: e.target.value || undefined }))
                                    setPaginaActual(0)
                                }}
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Tabla de Resultados */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors" onClick={() => handleSort('radicado')}>
                                    <div className="flex items-center">
                                        Radicado
                                        {renderSortIcon('radicado')}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors" onClick={() => handleSort('fechaRadicacion')}>
                                    <div className="flex items-center">
                                        Fecha Radicación
                                        {renderSortIcon('fechaRadicacion')}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors" onClick={() => handleSort('fechaAtencion')}>
                                    <div className="flex items-center">
                                        Fecha Atención
                                        {renderSortIcon('fechaAtencion')}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors" onClick={() => handleSort('servicioPrestado')}>
                                    <div className="flex items-center">
                                        Servicio
                                        {renderSortIcon('servicioPrestado')}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors" onClick={() => handleSort('radicadorEmail')}>
                                    <div className="flex items-center">
                                        Radicador
                                        {renderSortIcon('radicadorEmail')}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors" onClick={() => handleSort('eps')}>
                                    <div className="flex items-center">
                                        EPS
                                        {renderSortIcon('eps')}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors" onClick={() => handleSort('estado')}>
                                    <div className="flex items-center">
                                        Estado
                                        {renderSortIcon('estado')}
                                    </div>
                                </th>
                                {esAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {cargando ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <Loader2 className="animate-spin mb-2" size={32} />
                                            <p>Cargando radicados...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : casos.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                        No se encontraron radicados con los filtros seleccionados
                                    </td>
                                </tr>
                            ) : (
                                casos.map(caso => (
                                    <tr key={caso.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleVerDetalle(caso)}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-[var(--color-primary)]">
                                                {caso.radicado}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {caso.fechaRadicacion ? caso.fechaRadicacion.toLocaleDateString('es-CO') : '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {caso.fechaAtencion ? caso.fechaAtencion.toLocaleDateString('es-CO') : '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-700">
                                                {caso.servicioPrestado}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {caso.radicadorNombre || 'Sin nombre'}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {caso.radicadorEmail.split('@')[0]}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-700">{caso.eps}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Badge
                                                className={`
                                                    ${ESTADO_COLORES[caso.estado]?.bg} 
                                                    ${ESTADO_COLORES[caso.estado]?.text}
                                                    border ${ESTADO_COLORES[caso.estado]?.border}
                                                `}
                                            >
                                                {caso.estado}
                                            </Badge>
                                        </td>
                                        {esAdmin && (
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <button
                                                    onClick={(e) => handleEliminar(e, caso.radicado)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-full transition-colors"
                                                    title="Eliminar radicado"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        )}

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
            {casoSeleccionado && (
                <RadicacionDetallePanel
                    caso={casoSeleccionado}
                    onClose={handleCerrarDetalle}
                    onUpdate={handleActualizacionExitosa}
                />
            )}
        </div>
    )
}
