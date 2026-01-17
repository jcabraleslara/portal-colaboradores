/**
 * Página de Directorio Institucional
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Vista principal para gestionar contactos institucionales con:
 * - Cards de conteo clickeables como filtros rápidos
 * - Tabla optimizada con búsqueda y filtros avanzados
 * - Panel de detalle para gestión de contactos
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Search,
    Filter,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    X,
    Building2,
    Users,
    UserCircle,
    Plus,
    Mail,
    Phone,
    Briefcase,
} from 'lucide-react'
import { Card, Button, Input, LoadingOverlay } from '@/components/common'
import { contactosService } from '@/services/contactos.service'
import {
    Contacto,
    ContactoFiltros,
    ConteosContactos,
    ROL_COLORES,
} from '@/types/contactos.types'
import { ContactoDetallePanel } from './ContactoDetallePanel'
import { NuevoContactoModal } from './NuevoContactoModal'

const ITEMS_POR_PAGINA = 30

// Colores para empresas (rotativos)
const EMPRESA_COLORES = [
    { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
]

export function DirectorioPage() {
    // ============================================
    // ESTADO
    // ============================================

    // Datos
    const [contactos, setContactos] = useState<Contacto[]>([])
    const [conteos, setConteos] = useState<ConteosContactos | null>(null)
    const [total, setTotal] = useState(0)

    // Paginación
    const [paginaActual, setPaginaActual] = useState(0)

    // Filtros
    const [filtros, setFiltros] = useState<ContactoFiltros>({})
    const [busquedaInput, setBusquedaInput] = useState('')
    const [mostrarFiltros, setMostrarFiltros] = useState(false)

    // Estado de carga
    const [cargando, setCargando] = useState(true)
    const [cargandoConteos, setCargandoConteos] = useState(true)

    // Panel de detalle
    const [contactoSeleccionado, setContactoSeleccionado] = useState<Contacto | null>(null)

    // Modal nuevo contacto
    const [mostrarNuevoContacto, setMostrarNuevoContacto] = useState(false)

    // ============================================
    // FUNCIONES DE CARGA
    // ============================================

    const cargarConteos = useCallback(async () => {
        setCargandoConteos(true)
        const result = await contactosService.obtenerConteos()
        if (result.success && result.data) {
            setConteos(result.data)
        }
        setCargandoConteos(false)
    }, [])

    const cargarContactos = useCallback(async (nuevaPagina = 0) => {
        setCargando(true)

        const result = await contactosService.obtenerContactosFiltrados(
            filtros,
            nuevaPagina * ITEMS_POR_PAGINA,
            ITEMS_POR_PAGINA
        )

        if (result.success && result.data) {
            setContactos(result.data.contactos)
            setTotal(result.data.total)
            setPaginaActual(nuevaPagina)
        } else {
            setContactos([])
        }
        setCargando(false)
    }, [filtros])

    // Cargar datos iniciales
    useEffect(() => {
        cargarConteos()
    }, [cargarConteos])

    // Recargar contactos cuando cambian filtros
    useEffect(() => {
        cargarContactos(0)
    }, [cargarContactos])

    // ============================================
    // HANDLERS DE FILTROS
    // ============================================

    const handleBuscar = useCallback(() => {
        setFiltros(prev => ({
            ...prev,
            busqueda: busquedaInput.trim() || undefined,
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

    const handleFiltroEmpresa = useCallback((empresa: string | null) => {
        setFiltros(prev => ({
            ...prev,
            empresa: prev.empresa === empresa ? null : empresa,
        }))
    }, [])

    const handleFiltroRol = useCallback((rol: string | null) => {
        setFiltros(prev => ({
            ...prev,
            rol: prev.rol === rol ? null : rol,
        }))
    }, [])

    const handleLimpiarFiltros = useCallback(() => {
        setBusquedaInput('')
        setFiltros({})
    }, [])

    // ============================================
    // HANDLERS DE PAGINACIÓN
    // ============================================

    const totalPaginas = useMemo(() => Math.ceil(total / ITEMS_POR_PAGINA), [total])

    const handlePaginaAnterior = useCallback(() => {
        if (paginaActual > 0) {
            cargarContactos(paginaActual - 1)
        }
    }, [paginaActual, cargarContactos])

    const handlePaginaSiguiente = useCallback(() => {
        if (paginaActual < totalPaginas - 1) {
            cargarContactos(paginaActual + 1)
        }
    }, [paginaActual, totalPaginas, cargarContactos])

    // ============================================
    // HANDLERS DE SELECCIÓN
    // ============================================

    const handleSeleccionarContacto = useCallback((contacto: Contacto) => {
        setContactoSeleccionado(contacto)
    }, [])

    const handleCerrarDetalle = useCallback(() => {
        setContactoSeleccionado(null)
    }, [])

    const handleGuardarContacto = useCallback(async () => {
        handleCerrarDetalle()
        await cargarContactos(paginaActual)
        await cargarConteos()
    }, [handleCerrarDetalle, cargarContactos, paginaActual, cargarConteos])

    const handleNuevoContactoCreado = useCallback(async () => {
        setMostrarNuevoContacto(false)
        await cargarContactos(0)
        await cargarConteos()
    }, [cargarContactos, cargarConteos])

    // ============================================
    // HELPERS
    // ============================================

    const getNombreCompleto = (contacto: Contacto) => {
        return [
            contacto.tratamiento,
            contacto.primer_nombre,
            contacto.segundo_nombre,
            contacto.apellidos
        ].filter(Boolean).join(' ')
    }

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="space-y-6 pb-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                        Directorio Institucional
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Gestiona los contactos de la organización
                    </p>
                </div>
                <Button
                    onClick={() => setMostrarNuevoContacto(true)}
                    leftIcon={<Plus size={18} />}
                >
                    Nuevo Contacto
                </Button>
            </div>

            {/* ============================================ */}
            {/* CARDS DE CONTEO - EMPRESAS */}
            {/* ============================================ */}
            <div>
                <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                    <Building2 size={16} />
                    Por Empresa ({conteos?.total || 0} contactos)
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {cargandoConteos ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                        ))
                    ) : (
                        conteos?.porEmpresa.slice(0, 6).map((item, index) => {
                            const colores = EMPRESA_COLORES[index % EMPRESA_COLORES.length]
                            const activo = filtros.empresa === item.empresa

                            return (
                                <button
                                    key={item.empresa}
                                    onClick={() => handleFiltroEmpresa(item.empresa)}
                                    className={`
                                        relative p-4 rounded-xl border-2 transition-all duration-300
                                        hover:shadow-lg hover:-translate-y-0.5 flex flex-col items-center text-center
                                        ${activo
                                            ? `${colores.bg} ${colores.border} shadow-md ring-2 ring-offset-2`
                                            : 'bg-white border-gray-100 hover:border-gray-200'
                                        }
                                    `}
                                >
                                    <p className={`text-2xl font-bold ${activo ? colores.text : 'text-gray-800'}`}>
                                        {item.cantidad}
                                    </p>
                                    <p className="text-xs text-gray-600 font-medium leading-tight mt-1 truncate w-full" title={item.empresa}>
                                        {item.empresa}
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
            {/* CARDS DE CONTEO - ROLES */}
            {/* ============================================ */}
            <div>
                <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                    <Users size={16} />
                    Por Rol
                </h2>
                <div className="flex flex-wrap gap-3">
                    {cargandoConteos ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-12 w-32 bg-gray-100 rounded-xl animate-pulse" />
                        ))
                    ) : (
                        conteos?.porRol.map(item => {
                            const colores = ROL_COLORES[item.rol] || ROL_COLORES['operativo']
                            const activo = filtros.rol === item.rol

                            return (
                                <button
                                    key={item.rol}
                                    onClick={() => handleFiltroRol(item.rol)}
                                    className={`
                                        relative px-4 py-2 rounded-xl border-2 transition-all duration-300
                                        hover:shadow-md flex items-center gap-2
                                        ${activo
                                            ? `${colores.bg} ${colores.border} shadow-md`
                                            : 'bg-white border-gray-100 hover:border-gray-200'
                                        }
                                    `}
                                >
                                    <UserCircle size={18} className={activo ? colores.text : 'text-gray-500'} />
                                    <span className={`font-semibold ${activo ? colores.text : 'text-gray-700'}`}>
                                        {item.cantidad}
                                    </span>
                                    <span className="text-sm text-gray-600 capitalize">
                                        {item.rol}
                                    </span>
                                    {activo && (
                                        <X size={14} className={colores.text} />
                                    )}
                                </button>
                            )
                        })
                    )}
                </div>
            </div>

            {/* ============================================ */}
            {/* BARRA DE BÚSQUEDA Y FILTROS */}
            {/* ============================================ */}
            <Card>
                <Card.Body className="space-y-4">
                    {/* Barra principal */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Buscador */}
                        <div className="flex-1 relative">
                            <Input
                                placeholder="Buscar por nombre, identificación, puesto, empresa, área..."
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
                                    cargarContactos(paginaActual)
                                    cargarConteos()
                                }}
                                leftIcon={<RefreshCw size={18} />}
                                title="Refrescar"
                            />
                        </div>
                    </div>

                    {/* Chips de filtros activos */}
                    {(filtros.empresa || filtros.rol || filtros.busqueda) && (
                        <div className="flex flex-wrap gap-2">
                            {filtros.busqueda && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                                    Búsqueda: "{filtros.busqueda}"
                                    <button onClick={handleLimpiarBusqueda} className="hover:text-gray-900">
                                        <X size={14} />
                                    </button>
                                </span>
                            )}
                            {filtros.empresa && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                                    Empresa: {filtros.empresa}
                                    <button onClick={() => handleFiltroEmpresa(null)} className="hover:opacity-70">
                                        <X size={14} />
                                    </button>
                                </span>
                            )}
                            {filtros.rol && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm capitalize">
                                    Rol: {filtros.rol}
                                    <button onClick={() => handleFiltroRol(null)} className="hover:opacity-70">
                                        <X size={14} />
                                    </button>
                                </span>
                            )}
                            <button
                                onClick={handleLimpiarFiltros}
                                className="text-sm text-gray-500 hover:text-gray-700 underline"
                            >
                                Limpiar todo
                            </button>
                        </div>
                    )}
                </Card.Body>
            </Card>

            {/* ============================================ */}
            {/* TABLA DE CONTACTOS */}
            {/* ============================================ */}
            <LoadingOverlay isLoading={cargando} label="Cargando contactos...">
                <Card>
                    <Card.Body className="p-0">
                        {contactos.length === 0 ? (
                            <div className="p-12 text-center">
                                <Users className="mx-auto mb-4 text-gray-300" size={48} />
                                <p className="text-gray-500">No se encontraron contactos con los filtros seleccionados</p>
                            </div>
                        ) : (
                            <>
                                {/* Header de resultados */}
                                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                    <p className="text-sm text-gray-600">
                                        Mostrando <span className="font-semibold">{contactos.length}</span> de <span className="font-semibold">{total}</span> contactos
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
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Puesto</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Empresa</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contacto</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {contactos.map((contacto) => {
                                                const rolColor = ROL_COLORES[contacto.rol] || ROL_COLORES['operativo']

                                                return (
                                                    <tr
                                                        key={contacto.id}
                                                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                                        onClick={() => handleSeleccionarContacto(contacto)}
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div>
                                                                <p className="font-medium text-gray-800">
                                                                    {getNombreCompleto(contacto)}
                                                                </p>
                                                                {contacto.identificacion && (
                                                                    <p className="text-xs text-gray-500">{contacto.identificacion}</p>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <Briefcase size={14} className="text-gray-400" />
                                                                <span className="text-sm text-gray-700">{contacto.puesto || '—'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">
                                                            {contacto.empresa || '—'}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="space-y-1">
                                                                {contacto.celular_1 && (
                                                                    <div className="flex items-center gap-1 text-xs text-gray-600">
                                                                        <Phone size={12} />
                                                                        {contacto.celular_1}
                                                                    </div>
                                                                )}
                                                                {contacto.email_personal && (
                                                                    <div className="flex items-center gap-1 text-xs text-gray-500 truncate max-w-[180px]">
                                                                        <Mail size={12} />
                                                                        {contacto.email_personal}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium capitalize ${rolColor.bg} ${rolColor.text}`}>
                                                                {contacto.rol}
                                                            </span>
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
            {contactoSeleccionado && (
                <ContactoDetallePanel
                    contacto={contactoSeleccionado}
                    onClose={handleCerrarDetalle}
                    onGuardar={handleGuardarContacto}
                />
            )}

            {/* ============================================ */}
            {/* MODAL NUEVO CONTACTO */}
            {/* ============================================ */}
            {mostrarNuevoContacto && (
                <NuevoContactoModal
                    onClose={() => setMostrarNuevoContacto(false)}
                    onCreated={handleNuevoContactoCreado}
                />
            )}
        </div>
    )
}

export default DirectorioPage
