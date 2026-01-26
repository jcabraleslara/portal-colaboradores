/**
 * Página de Gestión de Rutas
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useEffect, useCallback } from 'react'
import { RutasStats } from './components/RutasStats'
import { RutasFilters } from './components/RutasFilters'
import { RutasTable } from './components/RutasTable'
import { rutasService } from './services/rutas.service'
import { BackRadicacionExtendido, EstadoRadicado } from '@/types/back.types'
import { CasoDetallePanel } from '@/features/gestionBack/CasoDetallePanel' // Reutilizamos panel de detalle
import { RutasConfig } from './components/RutasConfig'
import { Settings, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/common'

export default function RutasPage() {
    // ============================================
    // ESTADO
    // ============================================

    // Datos
    const [casos, setCasos] = useState<BackRadicacionExtendido[]>([])
    const [conteos, setConteos] = useState<{ porEstado: Record<string, number>, porRuta: Record<string, number> } | null>(null)
    const [total, setTotal] = useState(0)

    // Paginación
    const [paginaActual, setPaginaActual] = useState(0)

    // Filtros
    const [busqueda, setBusqueda] = useState('')
    const [filtros, setFiltros] = useState({
        estadoRadicado: 'Pendiente',
        ruta: undefined as string | undefined | null,
        fechaInicio: undefined as string | undefined,
        fechaFin: undefined as string | undefined,
        sortField: 'created_at',
        sortOrder: 'desc' as 'asc' | 'desc'
    })
    const [mostrarFiltros, setMostrarFiltros] = useState(false)
    const [modoConfig, setModoConfig] = useState(false)

    // Estados de carga
    const [cargando, setCargando] = useState(true)
    const [cargandoConteos, setCargandoConteos] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Panel Detalle
    const [casoSeleccionado, setCasoSeleccionado] = useState<BackRadicacionExtendido | null>(null)
    const [indiceSeleccionado, setIndiceSeleccionado] = useState<number>(-1)

    // ============================================
    // CARGA DE DATOS
    // ============================================

    const cargarConteos = useCallback(async () => {
        setCargandoConteos(true)
        const result = await rutasService.obtenerConteos()
        if (result.success && result.data) {
            setConteos(result.data)
        }
        setCargandoConteos(false)
    }, [])

    const cargarCasos = useCallback(async (nuevaPagina = 0) => {
        setCargando(true)
        setError(null)

        const result = await rutasService.obtenerRutasFiltradas({
            ...filtros,
            ruta: filtros.ruta || undefined,
            busqueda: busqueda.trim() || undefined
        }, nuevaPagina * 50, 50)

        if (result.success && result.data) {
            setCasos(result.data.casos)
            setTotal(result.data.total)
            setPaginaActual(nuevaPagina)
        } else {
            setError(result.error || 'Error cargando rutas')
        }
        setCargando(false)
    }, [filtros, busqueda])

    useEffect(() => {
        cargarConteos()
        cargarCasos(0)
    }, [])
    // Nota: cargarCasos se llama en useEffect separado o dep? 
    // Mejor controlar con handlers específicos para evitar loops, 
    // pero aquí para simplicidad inicial cargamos al montar.
    // Realmente, cuando cambian filtros queremos recargar:
    useEffect(() => {
        cargarCasos(0)
    }, [filtros]) // Al cambiar filtros reseteamos a pág 0

    // ============================================
    // HANDLERS
    // ============================================

    const handleBuscar = () => {
        // Al buscar, forzamos recarga.
        // Si hay búsqueda, quizás queramos limpiar filtros de estado para buscar en todo
        if (busqueda.trim()) {
            setFiltros(prev => ({ ...prev, estadoRadicado: 'Todos' }))
        }
        cargarCasos(0)
    }

    const handleFiltroEstado = (estado: EstadoRadicado | 'Todos') => {
        setFiltros(prev => ({ ...prev, estadoRadicado: estado }))
    }

    const handleFiltroRuta = (ruta: string | null) => {
        setFiltros(prev => ({ ...prev, ruta: ruta || undefined })) // toggle logic is in component
    }

    // Detalle
    const handleSeleccionarCaso = (caso: BackRadicacionExtendido, index: number) => {
        setCasoSeleccionado(caso)
        setIndiceSeleccionado(index)
    }

    const handleCerrarDetalle = () => {
        setCasoSeleccionado(null)
        setIndiceSeleccionado(-1)
        // Refrescar datos al cerrar por si hubo cambios
        cargarCasos(paginaActual)
        cargarConteos()
    }

    const handleGuardarYCerrar = async () => {
        handleCerrarDetalle()
    }

    const handleGuardarYSiguiente = async () => {
        await cargarCasos(paginaActual)
        await cargarConteos()

        const nuevoIndice = indiceSeleccionado + 1
        if (nuevoIndice < casos.length) {
            setCasoSeleccionado(casos[nuevoIndice])
            setIndiceSeleccionado(nuevoIndice)
        } else {
            handleCerrarDetalle()
        }
    }

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="space-y-6 pb-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                    Gestión de Rutas
                </h1>
                <p className="text-gray-500 mt-1">
                    Gestión especializada para solicitudes de Activación de Ruta
                </p>
            </div>
            <div className="flex gap-2">
                <Button
                    variant={modoConfig ? 'ghost' : 'solid'}
                    onClick={() => setModoConfig(false)}
                    leftIcon={<LayoutGrid size={18} />}
                >
                    Tablero
                </Button>
                <Button
                    variant={modoConfig ? 'solid' : 'ghost'}
                    onClick={() => setModoConfig(true)}
                    leftIcon={<Settings size={18} />}
                >
                    Configuración
                </Button>
            </div>

            {modoConfig ? (
                <RutasConfig />
            ) : (
                <>
                    <RutasStats
                        conteos={conteos}
                        loading={cargandoConteos}
                        filtroEstado={filtros.estadoRadicado}
                        filtroRuta={filtros.ruta}
                        onFiltroEstado={handleFiltroEstado}
                        onFiltroRuta={handleFiltroRuta}
                    />

                    <RutasFilters
                        busqueda={busqueda}
                        filtros={filtros}
                        mostrarFiltros={mostrarFiltros}
                        onBusquedaChange={setBusqueda}
                        onFiltroChange={(k, v) => setFiltros(prev => ({ ...prev, [k]: v }))}
                        onToggleFiltros={() => setMostrarFiltros(!mostrarFiltros)}
                        onBuscar={handleBuscar}
                        onLimpiarBusqueda={() => {
                            setBusqueda('')
                            setFiltros(prev => ({ ...prev, busqueda: undefined }))
                        }}
                        onLimpiarFiltros={() => {
                            setBusqueda('')
                            setFiltros({
                                estadoRadicado: 'Pendiente',
                                ruta: undefined,
                                fechaInicio: undefined,
                                fechaFin: undefined,
                                sortField: 'created_at',
                                sortOrder: 'desc'
                            })
                        }}
                        onRefrescar={() => {
                            cargarCasos(paginaActual)
                            cargarConteos()
                        }}
                    />

                    <RutasTable
                        casos={casos}
                        total={total}
                        paginaActual={paginaActual}
                        cargando={cargando}
                        error={error}
                        onPaginaAnterior={() => cargarCasos(paginaActual - 1)}
                        onPaginaSiguiente={() => cargarCasos(paginaActual + 1)}
                        onSeleccionarCaso={handleSeleccionarCaso}
                        onSort={(field) => {
                            setFiltros(prev => ({
                                ...prev,
                                sortField: field,
                                sortOrder: prev.sortField === field && prev.sortOrder === 'desc' ? 'asc' : 'desc'
                            }))
                        }}
                        sortField={filtros.sortField}
                        sortOrder={filtros.sortOrder}
                    />
                </>
            )}

            {casoSeleccionado && (
                <CasoDetallePanel
                    caso={casoSeleccionado}
                    onClose={handleCerrarDetalle}
                    onGuardarYCerrar={handleGuardarYCerrar}
                    onGuardarYSiguiente={handleGuardarYSiguiente}
                    onCasoEliminado={handleCerrarDetalle}
                    haySiguiente={indiceSeleccionado < casos.length - 1}
                />
            )}
        </div>
    )
}
