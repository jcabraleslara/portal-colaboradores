/**
 * Página de Soportes de Facturación
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Flujo de radicación de soportes para facturación con carga de archivos
 * por categoría y sincronización automática con OneDrive.
 */

import { useState, useEffect, useCallback } from 'react'
import {
    Search,
    Send,
    User,
    AlertCircle,
    CheckCircle,
    Plus,
    FileText,
    Upload,
    Trash2,
    Calendar,
    Stethoscope,
    History,
    X,
    ExternalLink,
    RefreshCw,
} from 'lucide-react'
import { Card, Button, Input, LoadingOverlay } from '@/components/common'
import { afiliadosService } from '@/services/afiliados.service'
import { soportesFacturacionService } from '@/services/soportesFacturacion.service'
import { useAuth } from '@/context/AuthContext'
import { Afiliado, LoadingState } from '@/types'
import { AfiliadoFormModal } from './AfiliadoFormModal'
import { GestionRadicadosView } from './GestionRadicadosView'
import {
    SoporteFacturacion,
    EpsFacturacion,
    RegimenFacturacion,
    ServicioPrestado,
    CategoriaArchivo,
    EPS_FACTURACION_LISTA,
    REGIMEN_FACTURACION_LISTA,
    SERVICIOS_PRESTADOS_LISTA,
    CATEGORIAS_ARCHIVOS,
    ESTADO_COLORES,
} from '@/types/soportesFacturacion.types'

// Tipo para archivos por categoría
interface ArchivosPorCategoria {
    categoria: CategoriaArchivo
    files: File[]
}

export function SoportesFacturacionPage() {
    const { user } = useAuth()

    // ============================================
    // ESTADO - Búsqueda de Afiliado
    // ============================================
    const [documento, setDocumento] = useState('')
    const [afiliado, setAfiliado] = useState<Afiliado | null>(null)
    const [searchState, setSearchState] = useState<LoadingState>('idle')
    const [searchError, setSearchError] = useState('')
    const [mostrarModalCrearAfiliado, setMostrarModalCrearAfiliado] = useState(false)

    // ============================================
    // ESTADO - Datos del Formulario
    // ============================================
    const [eps, setEps] = useState<EpsFacturacion>('NUEVA EPS')
    const [regimen, setRegimen] = useState<RegimenFacturacion>('CONTRIBUTIVO')
    const [servicioPrestado, setServicioPrestado] = useState<ServicioPrestado>('Consulta Especializada')
    const [fechaAtencion, setFechaAtencion] = useState('')
    const [observaciones, setObservaciones] = useState('')

    // ============================================
    // ESTADO - Archivos por Categoría
    // ============================================
    const [archivosPorCategoria, setArchivosPorCategoria] = useState<ArchivosPorCategoria[]>(
        CATEGORIAS_ARCHIVOS.map(cat => ({ categoria: cat.id, files: [] }))
    )

    // ============================================
    // ESTADO - Envío y Resultado
    // ============================================
    const [submitState, setSubmitState] = useState<LoadingState>('idle')
    const [submitError, setSubmitError] = useState('')
    const [radicacionExitosa, setRadicacionExitosa] = useState<SoporteFacturacion | null>(null)
    const [sincronizandoOneDrive, setSincronizandoOneDrive] = useState(false)

    // ============================================
    // ESTADO - Historial
    // ============================================
    const [historial, setHistorial] = useState<SoporteFacturacion[]>([])
    const [, setCargandoHistorial] = useState(false)
    const [mostrarHistorial, setMostrarHistorial] = useState(false)

    // ============================================
    // ESTADO - Vista (Tabs)
    // ============================================
    type TabView = 'radicacion' | 'gestion'
    const [vistaActual, setVistaActual] = useState<TabView>('radicacion')

    // ============================================
    // EFECTOS
    // ============================================
    useEffect(() => {
        if (afiliado?.id) {
            cargarHistorial(afiliado.id)
        }
    }, [afiliado?.id])

    // ============================================
    // HANDLERS - Búsqueda
    // ============================================
    const handleSearch = async () => {
        if (!documento.trim()) {
            setSearchError('Ingresa un número de documento')
            return
        }

        setSearchState('loading')
        setSearchError('')
        setAfiliado(null)
        setMostrarModalCrearAfiliado(false)
        resetFormulario()

        const result = await afiliadosService.buscarPorDocumento(documento.trim())

        if (result.success && result.data) {
            setAfiliado(result.data)
            setSearchState('success')
            // Pre-llenar EPS y régimen si están disponibles
            if (result.data.eps) {
                const epsMatch = EPS_FACTURACION_LISTA.find(e =>
                    result.data!.eps?.toUpperCase().includes(e.toUpperCase())
                )
                if (epsMatch) setEps(epsMatch)
            }
            if (result.data.regimen) {
                setRegimen(result.data.regimen.toUpperCase() as RegimenFacturacion)
            }
        } else {
            // Afiliado no encontrado - mostrar modal para crear
            setSearchError('')
            setSearchState('error')
            setMostrarModalCrearAfiliado(true)
        }
    }

    const handleCrearAfiliadoSuccess = (nuevoAfiliado: { tipoId: string; id: string; nombres: string; apellido1: string; apellido2: string; eps: string; regimen: string }) => {
        // Mapear datos del nuevo afiliado a formato Afiliado
        const afiliadoCompleto: Afiliado = {
            tipoId: nuevoAfiliado.tipoId,
            id: nuevoAfiliado.id,
            nombres: nuevoAfiliado.nombres,
            apellido1: nuevoAfiliado.apellido1,
            apellido2: nuevoAfiliado.apellido2,
            eps: nuevoAfiliado.eps,
            regimen: nuevoAfiliado.regimen,
            sexo: null,
            direccion: null,
            telefono: null,
            fechaNacimiento: null,
            estado: null,
            municipio: null,
            observaciones: null,
            ipsPrimaria: null,
            tipoCotizante: null,
            departamento: null,
            rango: null,
            email: null,
            edad: null,
            fuente: 'PORTAL_COLABORADORES',
            updatedAt: new Date(),
            busquedaTexto: null,
        }

        setAfiliado(afiliadoCompleto)
        setSearchState('success')
        setMostrarModalCrearAfiliado(false)

        // Pre-llenar datos
        setEps(nuevoAfiliado.eps as EpsFacturacion)
        setRegimen(nuevoAfiliado.regimen as RegimenFacturacion)
    }

    // ============================================
    // HANDLERS - Archivos
    // ============================================
    const handleFilesChange = useCallback((categoria: CategoriaArchivo, files: FileList | null) => {
        if (!files) return

        const config = CATEGORIAS_ARCHIVOS.find(c => c.id === categoria)
        const maxArchivos = config?.maxArchivos || 5

        setArchivosPorCategoria(prev =>
            prev.map(item => {
                if (item.categoria !== categoria) return item

                const nuevosArchivos = [...item.files]
                for (let i = 0; i < files.length && nuevosArchivos.length < maxArchivos; i++) {
                    nuevosArchivos.push(files[i])
                }
                return { ...item, files: nuevosArchivos }
            })
        )
    }, [])

    const handleRemoveFile = useCallback((categoria: CategoriaArchivo, index: number) => {
        setArchivosPorCategoria(prev =>
            prev.map(item => {
                if (item.categoria !== categoria) return item
                return {
                    ...item,
                    files: item.files.filter((_, i) => i !== index)
                }
            })
        )
    }, [])

    // ============================================
    // HANDLERS - Formulario
    // ============================================
    const resetFormulario = () => {
        setEps('NUEVA EPS')
        setRegimen('CONTRIBUTIVO')
        setServicioPrestado('Consulta Especializada')
        setFechaAtencion('')
        setObservaciones('')
        setArchivosPorCategoria(CATEGORIAS_ARCHIVOS.map(cat => ({ categoria: cat.id, files: [] })))
        setSubmitState('idle')
        setSubmitError('')
        setRadicacionExitosa(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!afiliado) {
            setSubmitError('Primero selecciona un afiliado')
            return
        }

        if (!fechaAtencion) {
            setSubmitError('La fecha de atención es requerida')
            return
        }

        // Validar archivos requeridos
        const categoriasRequeridas = CATEGORIAS_ARCHIVOS.filter(c => c.requerido)
        for (const cat of categoriasRequeridas) {
            const archivos = archivosPorCategoria.find(a => a.categoria === cat.id)
            if (!archivos || archivos.files.length === 0) {
                setSubmitError(`Debes subir al menos un archivo en: ${cat.label}`)
                return
            }
        }

        setSubmitState('loading')
        setSubmitError('')

        const result = await soportesFacturacionService.crearRadicacion({
            radicadorEmail: user?.email || '',
            radicadorNombre: user?.nombreCompleto,
            eps,
            regimen,
            servicioPrestado,
            fechaAtencion,
            tipoId: afiliado.tipoId || undefined,
            identificacion: afiliado.id || undefined,
            nombresCompletos: getNombreCompleto(afiliado) || undefined,
            observaciones: observaciones || undefined,
            archivos: archivosPorCategoria.filter(a => a.files.length > 0),
        })

        if (result.success && result.data) {
            setSubmitState('success')
            setRadicacionExitosa(result.data)
            if (afiliado.id) {
                await cargarHistorial(afiliado.id)
            }
        } else {
            setSubmitError(result.error || 'Error al radicar')
            setSubmitState('error')
        }
    }

    // ============================================
    // HANDLERS - OneDrive
    // ============================================
    const handleSincronizarOneDrive = async () => {
        if (!radicacionExitosa) return

        setSincronizandoOneDrive(true)
        const result = await soportesFacturacionService.sincronizarOneDrive(radicacionExitosa.radicado)

        if (result.success) {
            setRadicacionExitosa(prev => prev ? {
                ...prev,
                onedriveSyncStatus: 'synced',
                onedriveFolderUrl: result.data?.folderUrl || null,
            } : null)
        }
        setSincronizandoOneDrive(false)
    }

    // ============================================
    // HANDLERS - Historial
    // ============================================
    const cargarHistorial = async (identificacion: string) => {
        setCargandoHistorial(true)
        const result = await soportesFacturacionService.obtenerHistorialPorIdentificacion(identificacion)
        if (result.success && result.data) {
            setHistorial(result.data)
        }
        setCargandoHistorial(false)
    }

    const handleNuevaRadicacion = () => {
        setDocumento('')
        setAfiliado(null)
        setSearchState('idle')
        setSearchError('')
        setHistorial([])
        resetFormulario()
        setMostrarHistorial(false)
    }

    // ============================================
    // HELPERS
    // ============================================
    const getNombreCompleto = (af: Afiliado) => {
        return [af.nombres, af.apellido1, af.apellido2].filter(Boolean).join(' ')
    }

    const getTotalArchivos = () => {
        return archivosPorCategoria.reduce((sum, cat) => sum + cat.files.length, 0)
    }

    // ============================================
    // RENDER
    // ============================================
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                        Soportes de Facturación
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Radica soportes para facturación con carga organizada por categoría
                    </p>
                </div>
                {afiliado && (
                    <Button
                        variant="ghost"
                        onClick={() => setMostrarHistorial(!mostrarHistorial)}
                        leftIcon={<History size={18} />}
                        className="border border-gray-200"
                    >
                        Historial ({historial.length})
                    </Button>
                )}
            </div>

            {/* ============================================ */}
            {/* TABS DE NAVEGACIÓN */}
            {/* ============================================ */}
            <div className="border-b border-gray-200 mb-6">
                <div className="flex gap-1">
                    <button
                        onClick={() => setVistaActual('radicacion')}
                        className={`
                            px-6 py-3 text-sm font-medium border-b-2 transition-colors
                            ${vistaActual === 'radicacion'
                                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }
                        `}
                    >
                        📄 Nueva Radicación
                    </button>
                    <button
                        onClick={() => setVistaActual('gestion')}
                        className={`
                            px-6 py-3 text-sm font-medium border-b-2 transition-colors
                            ${vistaActual === 'gestion'
                                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }
                        `}
                    >
                        📋 Gestión de Radicados
                    </button>
                </div>
            </div>

            {/* ============================================ */}
            {/* CONTENIDO: NUEVA RADICACIÓN */}
            {/* ============================================ */}
            {vistaActual === 'radicacion' && (
                <>
                    {/* Mensaje de Éxito */}
                    {radicacionExitosa && (
                        <Card className="border-[var(--color-success)] bg-green-50">
                            <div className="flex items-start gap-4 p-4">
                                <div className="p-2 bg-[var(--color-success)] rounded-full">
                                    <CheckCircle className="text-white" size={24} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-[var(--color-success)]">
                                        ¡Radicación exitosa!
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Número de radicado:{' '}
                                        <code className="bg-white px-2 py-0.5 rounded font-bold text-[var(--color-primary)]">
                                            {radicacionExitosa.radicado}
                                        </code>
                                    </p>
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        <Button
                                            variant="success"
                                            size="sm"
                                            onClick={handleNuevaRadicacion}
                                            leftIcon={<Plus size={16} />}
                                        >
                                            Nueva radicación
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={handleSincronizarOneDrive}
                                            isLoading={sincronizandoOneDrive}
                                            leftIcon={<RefreshCw size={16} />}
                                            disabled={radicacionExitosa.onedriveSyncStatus === 'synced'}
                                        >
                                            {radicacionExitosa.onedriveSyncStatus === 'synced'
                                                ? 'Sincronizado ✓'
                                                : 'Sincronizar OneDrive'
                                            }
                                        </Button>
                                        {radicacionExitosa.onedriveFolderUrl && (
                                            <a
                                                href={radicacionExitosa.onedriveFolderUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                            >
                                                <ExternalLink size={14} />
                                                Ver en OneDrive
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Panel de Historial */}
                    {mostrarHistorial && historial.length > 0 && (
                        <Card>
                            <Card.Header>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <History size={20} className="text-[var(--color-primary)]" />
                                        Historial de Radicaciones
                                    </div>
                                    <button
                                        onClick={() => setMostrarHistorial(false)}
                                        className="p-1 hover:bg-gray-100 rounded"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </Card.Header>
                            <Card.Body>
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {historial.map(soporte => {
                                        const colores = ESTADO_COLORES[soporte.estado] || ESTADO_COLORES['Pendiente']
                                        return (
                                            <div
                                                key={soporte.id}
                                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                            >
                                                <div>
                                                    <code className="font-bold text-[var(--color-primary)]">
                                                        {soporte.radicado}
                                                    </code>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {soporte.eps} • {soporte.servicioPrestado}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colores.bg} ${colores.text}`}>
                                                        {soporte.estado}
                                                    </span>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {soporte.fechaRadicacion.toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </Card.Body>
                        </Card>
                    )}

                    {/* Formulario Principal */}
                    {!radicacionExitosa && (
                        <LoadingOverlay isLoading={submitState === 'loading'} label="Radicando soportes...">
                            <div className="grid gap-6 lg:grid-cols-3">
                                {/* Columna Izquierda: Búsqueda y Datos */}
                                <div className="lg:col-span-1 space-y-6">
                                    {/* Búsqueda de Afiliado */}
                                    <Card>
                                        <Card.Header>
                                            <div className="flex items-center gap-2">
                                                <Search size={20} className="text-[var(--color-primary)]" />
                                                Buscar Afiliado
                                            </div>
                                        </Card.Header>
                                        <Card.Body>
                                            <div className="space-y-4">
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="Número de documento"
                                                        value={documento}
                                                        onChange={(e) => {
                                                            setDocumento(e.target.value.replace(/\D/g, ''))
                                                            setSearchError('')
                                                        }}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                                        leftIcon={<User size={18} />}
                                                        disabled={searchState === 'loading' || !!afiliado}
                                                    />
                                                    {!afiliado ? (
                                                        <Button
                                                            onClick={handleSearch}
                                                            isLoading={searchState === 'loading'}
                                                        >
                                                            <Search size={18} />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            onClick={handleNuevaRadicacion}
                                                            className="border"
                                                        >
                                                            <X size={18} />
                                                        </Button>
                                                    )}
                                                </div>

                                                {searchError && (
                                                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                                                        <AlertCircle size={16} className="text-red-500" />
                                                        <p className="text-sm text-red-600">{searchError}</p>
                                                    </div>
                                                )}

                                                {afiliado && (
                                                    <div className="p-3 bg-[var(--color-primary-50)] rounded-lg">
                                                        <p className="font-semibold text-[var(--color-primary)]">
                                                            {getNombreCompleto(afiliado)}
                                                        </p>
                                                        <p className="text-sm text-gray-600">
                                                            {afiliado.tipoId} {afiliado.id}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </Card.Body>
                                    </Card>

                                    {/* Datos del Servicio */}
                                    {afiliado && (
                                        <Card>
                                            <Card.Header>
                                                <div className="flex items-center gap-2">
                                                    <Stethoscope size={20} className="text-[var(--color-primary)]" />
                                                    Datos del Servicio
                                                </div>
                                            </Card.Header>
                                            <Card.Body>
                                                <form className="space-y-4">
                                                    {/* EPS */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            EPS <span className="text-red-500">*</span>
                                                        </label>
                                                        <select
                                                            value={eps}
                                                            onChange={(e) => setEps(e.target.value as EpsFacturacion)}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-[var(--color-primary-100)] focus:border-transparent"
                                                        >
                                                            {EPS_FACTURACION_LISTA.map(e => (
                                                                <option key={e} value={e}>{e}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Régimen */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            Régimen <span className="text-red-500">*</span>
                                                        </label>
                                                        <select
                                                            value={regimen}
                                                            onChange={(e) => setRegimen(e.target.value as RegimenFacturacion)}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-[var(--color-primary-100)] focus:border-transparent"
                                                        >
                                                            {REGIMEN_FACTURACION_LISTA.map(r => (
                                                                <option key={r.value} value={r.value}>{r.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Servicio Prestado */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            Servicio Prestado <span className="text-red-500">*</span>
                                                        </label>
                                                        <select
                                                            value={servicioPrestado}
                                                            onChange={(e) => setServicioPrestado(e.target.value as ServicioPrestado)}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-[var(--color-primary-100)] focus:border-transparent"
                                                        >
                                                            {SERVICIOS_PRESTADOS_LISTA.map(s => (
                                                                <option key={s} value={s}>{s}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Fecha de Atención */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            Fecha de Atención <span className="text-red-500">*</span>
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="date"
                                                                value={fechaAtencion}
                                                                onChange={(e) => setFechaAtencion(e.target.value)}
                                                                className="w-full px-3 py-2 pl-10 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-[var(--color-primary-100)] focus:border-transparent"
                                                            />
                                                            <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                        </div>
                                                    </div>

                                                    {/* Observaciones */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            Observaciones
                                                        </label>
                                                        <textarea
                                                            value={observaciones}
                                                            onChange={(e) => setObservaciones(e.target.value)}
                                                            placeholder="Observaciones adicionales..."
                                                            rows={3}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-[var(--color-primary-100)] focus:border-transparent resize-none"
                                                        />
                                                    </div>
                                                </form>
                                            </Card.Body>
                                        </Card>
                                    )}
                                </div>

                                {/* Columna Derecha: Carga de Archivos */}
                                {afiliado && (
                                    <div className="lg:col-span-2 space-y-4">
                                        <Card>
                                            <Card.Header>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Upload size={20} className="text-[var(--color-primary)]" />
                                                        Soportes Documentales
                                                    </div>
                                                    <span className="text-sm text-gray-500">
                                                        {getTotalArchivos()} archivo(s)
                                                    </span>
                                                </div>
                                            </Card.Header>
                                            <Card.Body>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    {CATEGORIAS_ARCHIVOS.map(categoria => {
                                                        const archivosCategoria = archivosPorCategoria.find(
                                                            a => a.categoria === categoria.id
                                                        )?.files || []

                                                        return (
                                                            <div
                                                                key={categoria.id}
                                                                className={`p-4 rounded-lg border-2 border-dashed transition-colors ${archivosCategoria.length > 0
                                                                    ? 'border-green-300 bg-green-50'
                                                                    : categoria.requerido
                                                                        ? 'border-amber-300 bg-amber-50'
                                                                        : 'border-gray-200 bg-gray-50'
                                                                    }`}
                                                            >
                                                                <div className="flex items-start justify-between mb-2">
                                                                    <div>
                                                                        <h4 className="font-medium text-gray-800 text-sm">
                                                                            {categoria.label}
                                                                            {categoria.requerido && (
                                                                                <span className="text-red-500 ml-1">*</span>
                                                                            )}
                                                                        </h4>
                                                                        <p className="text-xs text-gray-500">
                                                                            {categoria.descripcion}
                                                                        </p>
                                                                    </div>
                                                                    <span className="text-xs text-gray-400">
                                                                        {archivosCategoria.length}/{categoria.maxArchivos}
                                                                    </span>
                                                                </div>

                                                                {/* Lista de archivos */}
                                                                {archivosCategoria.length > 0 && (
                                                                    <div className="space-y-1 mb-2">
                                                                        {archivosCategoria.map((file, index) => (
                                                                            <div
                                                                                key={index}
                                                                                className="flex items-center justify-between bg-white px-2 py-1 rounded text-xs"
                                                                            >
                                                                                <div className="flex items-center gap-1 truncate flex-1">
                                                                                    <FileText size={12} className="text-gray-400 flex-shrink-0" />
                                                                                    <span className="truncate">{file.name}</span>
                                                                                </div>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveFile(categoria.id, index)}
                                                                                    className="p-0.5 hover:bg-red-100 rounded text-red-500"
                                                                                >
                                                                                    <Trash2 size={12} />
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Input de archivo */}
                                                                {archivosCategoria.length < categoria.maxArchivos && (
                                                                    <label className="flex items-center justify-center gap-2 p-2 bg-white rounded border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                                                                        <Plus size={16} className="text-gray-400" />
                                                                        <span className="text-xs text-gray-500">
                                                                            Agregar archivo
                                                                        </span>
                                                                        <input
                                                                            type="file"
                                                                            accept=".pdf,.jpg,.jpeg,.png"
                                                                            multiple
                                                                            onChange={(e) => handleFilesChange(categoria.id, e.target.files)}
                                                                            className="hidden"
                                                                        />
                                                                    </label>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>

                                                {/* Error de envío */}
                                                {submitError && (
                                                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                                                        <AlertCircle size={18} className="text-red-500" />
                                                        <p className="text-sm text-red-600">{submitError}</p>
                                                    </div>
                                                )}

                                                {/* Botón de Envío */}
                                                <div className="mt-6 flex justify-end">
                                                    <Button
                                                        onClick={handleSubmit}
                                                        isLoading={submitState === 'loading'}
                                                        leftIcon={<Send size={18} />}
                                                        disabled={getTotalArchivos() === 0}
                                                        className="px-8"
                                                    >
                                                        Radicar Soportes
                                                    </Button>
                                                </div>
                                            </Card.Body>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        </LoadingOverlay>
                    )}

                    {/* Modal Crear Afiliado */}
                    {mostrarModalCrearAfiliado && (
                        <AfiliadoFormModal
                            identificacion={documento}
                            onClose={() => setMostrarModalCrearAfiliado(false)}
                            onSuccess={handleCrearAfiliadoSuccess}
                        />
                    )}
                </>
            )}



            {/* ============================================ */}
            {/* CONTENIDO: GESTIÓN DE RADICADOS */}
            {/* ============================================ */}
            {vistaActual === 'gestion' && (
                <GestionRadicadosView />
            )}
        </div>
    )
}

export default SoportesFacturacionPage
