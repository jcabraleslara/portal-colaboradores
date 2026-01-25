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
    Plus,
    Mail,
    Phone,
    Briefcase,
    Download,
    FileSpreadsheet,
    FileText,
    FileType,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { Card, Button, Input, LoadingOverlay } from '@/components/common'
import { contactosService } from '@/services/contactos.service'
import {
    Contacto,
    ContactoFiltros,
    ConteosContactos,
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
    const { user } = useAuth()
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
    // Modal nuevo contacto
    const [mostrarNuevoContacto, setMostrarNuevoContacto] = useState(false)

    // Estado para exportación
    const [exporting, setExporting] = useState(false)
    const [showExportMenu, setShowExportMenu] = useState(false)

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
    // EXPORTACIÓN
    // ============================================

    const downloadFile = (content: string, fileName: string, contentType: string) => {
        const a = document.createElement("a");
        const file = new Blob(['\uFEFF' + content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
    }

    const handleExport = async (format: 'csv' | 'xlsx' | 'txt') => {
        setExporting(true)
        setShowExportMenu(false)
        try {
            // Obtener todos los datos con los filtros actuales
            const result = await contactosService.obtenerContactosFiltrados(
                filtros,
                0,
                100000 // Limit alto para exportar "todo"
            )

            if (!result.success || !result.data || result.data.contactos.length === 0) {
                toast.warning('No hay datos para exportar')
                return
            }

            // Formatear datos para exportación
            const exportData = result.data.contactos.map(item => ({
                'ID': item.id,
                'Tratamiento': item.tratamiento || '',
                'Nombre Completo': getNombreCompleto(item),
                'Identificación': item.identificacion || '',
                'Empresa': item.empresa || '',
                'Puesto': item.puesto || '',
                'Área': item.area || '',
                'Email Institucional': item.email_institucional || '',
                'Email Personal': item.email_personal || '',
                'Celular 1': item.celular_1 || '',
                'Celular 2': item.celular_2 || '',
                'Dirección': item.direccion || '',
                'Ciudad': item.ciudad || '',
                'Departamento': item.departamento || '',
                'País': item.pais || '',
                'Fecha Nacimiento': item.fecha_nacimiento || '',
                'Notas': item.notas || '',
            }))

            const fileName = `directorio_institucional_${new Date().toISOString().split('T')[0]}_${new Date().getTime()}`

            if (format === 'xlsx') {
                const ws = XLSX.utils.json_to_sheet(exportData)
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, "Contactos")
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

            toast.success('Exportación completada')

        } catch (error) {
            console.error('Error exportando:', error)
            toast.error('Ocurrió un error al exportar los datos')
        } finally {
            setExporting(false)
        }
    }

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

                            {/* Botón Exportar */}
                            {['superadmin', 'admin', 'auditoria', 'gerencia'].includes(user?.rol || '') && (
                                <div className="relative">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setShowExportMenu(!showExportMenu)}
                                        disabled={exporting}
                                        leftIcon={<Download size={18} />}
                                        className={showExportMenu ? 'bg-gray-100' : ''}
                                    >
                                        {exporting ? '...' : 'Exportar'}
                                    </Button>

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
                    </div>

                    {/* Chips de filtros activos */}
                    {(filtros.empresa || filtros.area || filtros.ciudad || filtros.busqueda) && (
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
                                    <button onClick={() => setFiltros(prev => ({ ...prev, empresa: undefined }))} className="hover:opacity-70">
                                        <X size={14} />
                                    </button>
                                </span>
                            )}
                            {filtros.area && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm">
                                    Área: {filtros.area}
                                    <button onClick={() => setFiltros(prev => ({ ...prev, area: undefined }))} className="hover:opacity-70">
                                        <X size={14} />
                                    </button>
                                </span>
                            )}
                            {filtros.ciudad && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-50 text-cyan-700 rounded-full text-sm">
                                    Ciudad: {filtros.ciudad}
                                    <button onClick={() => setFiltros(prev => ({ ...prev, ciudad: undefined }))} className="hover:opacity-70">
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

                    {/* Panel de Filtros Expandible */}
                    {mostrarFiltros && (
                        <div className="pt-4 mt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                                <select
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2 px-3 border"
                                    value={filtros.empresa || ''}
                                    onChange={(e) => setFiltros(prev => ({ ...prev, empresa: e.target.value || undefined }))}
                                >
                                    <option value="">Todas las empresas</option>
                                    {conteos?.porEmpresa.map((item) => (
                                        <option key={item.empresa} value={item.empresa}>
                                            {item.empresa} ({item.cantidad})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
                                <select
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2 px-3 border"
                                    value={filtros.area || ''}
                                    onChange={(e) => setFiltros(prev => ({ ...prev, area: e.target.value || undefined }))}
                                >
                                    <option value="">Todas las áreas</option>
                                    {conteos?.porArea.map((item) => (
                                        <option key={item.area} value={item.area}>
                                            {item.area} ({item.cantidad})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                                <select
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2 px-3 border"
                                    value={filtros.ciudad || ''}
                                    onChange={(e) => setFiltros(prev => ({ ...prev, ciudad: e.target.value || undefined }))}
                                >
                                    <option value="">Todas las ciudades</option>
                                    {conteos?.porCiudad?.map((item) => (
                                        <option key={item.ciudad} value={item.ciudad}>
                                            {item.ciudad} ({item.cantidad})
                                        </option>
                                    ))}
                                </select>
                            </div>
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
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {contactos.map((contacto) => {
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
