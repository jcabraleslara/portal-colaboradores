/**
 * Página de Radicación de Casos
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Flujo de 3 pasos:
 * 1. Buscar o crear afiliado
 * 2. Datos de la solicitud
 * 3. Respuesta y historial de radicados
 */

import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
    Search,
    Send,
    User,
    AlertCircle,
    CheckCircle,
    Plus,
    Clock,
    FileText,
    ChevronRight,
    History,
    Stethoscope,
    BookOpen,
    FileEdit,
    Activity,
    Zap,
    Route,
    MessageCircle,
    ArrowLeft,
    Copy,
    Check,
} from 'lucide-react'
import { Card, Button, Input, LoadingOverlay, FileUpload, OrdenadorAutocomplete, Autocomplete, MarkdownRenderer, EditablePhone } from '@/components/common'
import { copyRichText } from '@/utils/clipboard'
import { parseDateLocal } from '@/utils/date.utils'
import { afiliadosService } from '@/services/afiliados.service'
import { backService } from '@/services/back.service'
import { useAuth } from '@/context/AuthContext'
import { Afiliado, LoadingState } from '@/types'
import {
    TipoSolicitudBack,
    EspecialidadAuditoria,
    BackRadicacion,
    ESPECIALIDADES_LISTA,
    ESTADO_COLORES,
    SEXO_LISTA,
    REGIMEN_LISTA,
    TIPO_COTIZANTE_LISTA,
    MUNICIPIOS_CORDOBA,
    IPS_PRIMARIA_LISTA,
    EPS_LISTA,
} from '@/types/back.types'

// Tipo para datos del nuevo afiliado
interface NuevoAfiliadoForm {
    tipoId: string
    id: string
    nombres: string
    apellido1: string
    apellido2: string
    sexo: string
    direccion: string
    telefono: string
    fechaNacimiento: string
    municipioCodigo: string
    municipioNombre: string
    departamento: string
    regimen: string
    ipsPrimaria: string
    tipoCotizante: string
    eps: string
}

export function RadicacionCasosPage() {
    const { user } = useAuth()
    const location = useLocation()

    // ============================================
    // ESTADO - PASO 1: Búsqueda de Afiliado
    // ============================================
    const [documento, setDocumento] = useState('')
    const [afiliado, setAfiliado] = useState<Afiliado | null>(null)
    const [searchState, setSearchState] = useState<LoadingState>('idle')
    const [searchError, setSearchError] = useState('')
    const [mostrarFormularioNuevo, setMostrarFormularioNuevo] = useState(false)
    const [nuevoAfiliado, setNuevoAfiliado] = useState<NuevoAfiliadoForm>({
        tipoId: 'CC',
        id: '',
        nombres: '',
        apellido1: '',
        apellido2: '',
        sexo: '',
        direccion: '',
        telefono: '',
        fechaNacimiento: '',
        municipioCodigo: '',
        municipioNombre: '',
        departamento: '23', // Córdoba por defecto
        regimen: '',
        ipsPrimaria: '',
        tipoCotizante: '',
        eps: 'NUEVA EPS',
    })
    const [creandoAfiliado, setCreandoAfiliado] = useState(false)

    // ============================================
    // ESTADO - PASO 2: Datos de la Solicitud
    // ============================================
    const [tipoSolicitud, setTipoSolicitud] = useState<TipoSolicitudBack>('Auditoría Médica')
    const [especialidad, setEspecialidad] = useState<EspecialidadAuditoria>('Medicina Interna')
    const [ordenador, setOrdenador] = useState('')
    const [observaciones, setObservaciones] = useState('')
    const [archivos, setArchivos] = useState<File[]>([])

    // ============================================
    // ESTADO - PASO 3: Respuesta y Envío
    // ============================================
    const [submitState, setSubmitState] = useState<LoadingState>('idle')
    const [submitError, setSubmitError] = useState('')
    const [radicacionExitosa, setRadicacionExitosa] = useState<BackRadicacion | null>(null)
    const [historial, setHistorial] = useState<BackRadicacion[]>([])
    const [cargandoHistorial, setCargandoHistorial] = useState(false)
    const [filtroEstado, setFiltroEstado] = useState<string>('Todos')

    // ============================================
    // ESTADO - Vista activa después del Paso 1
    // ============================================
    type VistaActiva = 'selector' | 'radicar' | 'respuestas'
    const [vistaActiva, setVistaActiva] = useState<VistaActiva>('selector')

    // Estado para animación de copia al portapapeles
    const [copiandoRespuesta, setCopiandoRespuesta] = useState<string | null>(null)

    // ============================================
    // EFECTOS
    // ============================================

    // Manejar navegación desde otros módulos (Validación de Derechos)
    useEffect(() => {
        if (location.state?.afiliado) {
            const af = location.state.afiliado as Afiliado
            setAfiliado(af)
            setDocumento(af.id || '')
            setSearchState('success')

            // Si viene con acción específica
            if (location.state.action === 'radicar') {
                setVistaActiva('radicar')
            }

            // Limpiar el estado de history para no volver a ejecutarlo si navega a otra parte y vuelve
            // window.history.replaceState({}, document.title)
        }
    }, [location.state])

    // Cargar historial cuando hay afiliado
    useEffect(() => {
        if (afiliado?.id) {
            cargarHistorial(afiliado.id)
        }
    }, [afiliado?.id])

    // ============================================
    // HANDLERS - PASO 1
    // ============================================

    const handleSearch = async () => {
        if (!documento.trim()) {
            setSearchError('Ingresa un número de documento')
            return
        }

        setSearchState('loading')
        setSearchError('')
        setAfiliado(null)
        setMostrarFormularioNuevo(false)
        resetFormulario()

        const result = await afiliadosService.buscarPorDocumento(documento.trim())

        if (result.success && result.data) {
            setAfiliado(result.data)
            setSearchState('success')
        } else {
            // No encontrado: mostrar formulario de creación
            setSearchError('Afiliado no encontrado en el sistema')
            setMostrarFormularioNuevo(true)
            setNuevoAfiliado(prev => ({ ...prev, id: documento.trim() }))
            setSearchState('error')
        }
    }

    const handleCrearAfiliado = async () => {
        // Validaciones
        if (!nuevoAfiliado.nombres.trim()) {
            setSearchError('El nombre es requerido')
            return
        }
        if (!nuevoAfiliado.apellido1.trim()) {
            setSearchError('El primer apellido es requerido')
            return
        }

        setCreandoAfiliado(true)
        setSearchError('')

        const result = await backService.crearAfiliado({
            tipoId: nuevoAfiliado.tipoId,
            id: nuevoAfiliado.id,
            nombres: nuevoAfiliado.nombres,
            apellido1: nuevoAfiliado.apellido1,
            apellido2: nuevoAfiliado.apellido2 || undefined,
            sexo: nuevoAfiliado.sexo || undefined,
            direccion: nuevoAfiliado.direccion || undefined,
            telefono: nuevoAfiliado.telefono || undefined,
            fechaNacimiento: nuevoAfiliado.fechaNacimiento || undefined,
            municipio: nuevoAfiliado.municipioCodigo || undefined,
            departamento: nuevoAfiliado.departamento || undefined,
            regimen: nuevoAfiliado.regimen || undefined,
            ipsPrimaria: nuevoAfiliado.ipsPrimaria || undefined,
            tipoCotizante: nuevoAfiliado.tipoCotizante || undefined,
            eps: nuevoAfiliado.eps || undefined,
        })

        setCreandoAfiliado(false)

        if (result.success) {
            // Simular afiliado recién creado
            setAfiliado({
                tipoId: nuevoAfiliado.tipoId,
                id: nuevoAfiliado.id,
                nombres: nuevoAfiliado.nombres.toUpperCase(),
                apellido1: nuevoAfiliado.apellido1.toUpperCase(),
                apellido2: nuevoAfiliado.apellido2?.toUpperCase() || null,
                sexo: nuevoAfiliado.sexo || null,
                direccion: nuevoAfiliado.direccion?.toUpperCase() || null,
                telefono: nuevoAfiliado.telefono || null,
                fechaNacimiento: nuevoAfiliado.fechaNacimiento ? parseDateLocal(nuevoAfiliado.fechaNacimiento) : null,
                estado: 'ACTIVO',
                municipio: nuevoAfiliado.municipioCodigo || null,
                departamento: nuevoAfiliado.departamento || null,
                observaciones: null,
                ipsPrimaria: nuevoAfiliado.ipsPrimaria || null,
                tipoCotizante: nuevoAfiliado.tipoCotizante || null,
                rango: null,
                email: null,
                regimen: nuevoAfiliado.regimen || null,
                edad: null,
                eps: nuevoAfiliado.eps || 'NUEVA EPS',
                fuente: 'PORTAL_COLABORADORES',
                updatedAt: null,
                busquedaTexto: null,
            })
            setMostrarFormularioNuevo(false)
            setSearchState('success')
        } else {
            setSearchError(result.error || 'Error al crear el afiliado')
        }
    }

    const handlePhoneUpdate = (newPhone: string) => {
        if (afiliado) {
            setAfiliado({ ...afiliado, telefono: newPhone })
        }
    }

    // ============================================
    // HANDLERS - PASO 2
    // ============================================

    const resetFormulario = () => {
        setTipoSolicitud('Auditoría Médica')
        setEspecialidad('Medicina Interna')
        setOrdenador('')
        setObservaciones('')
        setArchivos([])
        setSubmitState('idle')
        setSubmitError('')
        setRadicacionExitosa(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!afiliado?.id) {
            setSubmitError('Primero selecciona un afiliado')
            return
        }

        // Ordenador requerido solo si NO es Solicitud de Historia Clínica
        const requiereOrdenador = tipoSolicitud !== 'Solicitud de Historia Clínica'
        if (requiereOrdenador && !ordenador.trim()) {
            setSubmitError('El ordenador es requerido')
            return
        }

        setSubmitState('loading')
        setSubmitError('')

        const radicadorNombre = user?.nombreCompleto || 'SISTEMA'

        const result = await backService.crearRadicacion({
            radicador: radicadorNombre,
            id: afiliado.id,
            tipoSolicitud,
            especialidad: tipoSolicitud === 'Auditoría Médica' ? especialidad : undefined,
            ordenador: requiereOrdenador ? ordenador : undefined,
            observaciones: observaciones || undefined,
            archivos: archivos.length > 0 ? archivos : undefined,
        })

        if (result.success && result.data) {
            setSubmitState('success')
            setRadicacionExitosa(result.data)
            // Recargar historial
            await cargarHistorial(afiliado.id)
        } else {
            setSubmitError(result.error || 'Error al radicar el caso')
            setSubmitState('error')
        }
    }

    // ============================================
    // HANDLERS - PASO 3
    // ============================================

    const cargarHistorial = async (documentoId: string) => {
        setCargandoHistorial(true)
        const result = await backService.obtenerHistorialPorId(documentoId)
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
        setMostrarFormularioNuevo(false)
        setHistorial([])
        resetFormulario()
        setVistaActiva('selector')
        setFiltroEstado('Todos')
    }

    // Volver al selector de acciones
    const handleVolverSelector = () => {
        setVistaActiva('selector')
        resetFormulario()
        setFiltroEstado('Todos')
    }

    // ============================================
    // RENDER
    // ============================================

    const getNombreCompleto = (af: Afiliado) => {
        return [af.nombres, af.apellido1, af.apellido2].filter(Boolean).join(' ')
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                    Radicación de Casos
                </h1>
                <p className="text-gray-500 mt-1">
                    Radica solicitudes de auditoría, historias clínicas y más
                </p>
            </div>

            {/* ============================================ */}
            {/* MENSAJE DE ÉXITO */}
            {/* ============================================ */}
            {radicacionExitosa && (
                <Card className="border-[var(--color-success)] bg-green-50">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-[var(--color-success)] rounded-full">
                            <CheckCircle className="text-white" size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-[var(--color-success)]">
                                ¡Caso radicado exitosamente!
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                                Número de radicado:{' '}
                                <code className="bg-white px-2 py-0.5 rounded font-bold text-[var(--color-primary)]">
                                    {radicacionExitosa.radicado}
                                </code>
                            </p>
                            <div className="flex gap-2 mt-4">
                                <Button
                                    variant="success"
                                    size="sm"
                                    onClick={handleNuevaRadicacion}
                                    leftIcon={<Plus size={16} />}
                                >
                                    Radicar otro caso
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* ============================================ */}
            {/* PASO 1: BÚSQUEDA DE AFILIADO */}
            {/* ============================================ */}
            {!radicacionExitosa && (
                <Card>
                    <Card.Header>
                        <div className="flex items-center gap-2">
                            <Search size={20} className="text-[var(--color-primary)]" />
                            Paso 1: Buscar Afiliado
                        </div>
                    </Card.Header>
                    <Card.Body>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                                <Input
                                    placeholder="Número de documento del afiliado"
                                    value={documento}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        setDocumento(e.target.value.replace(/\D/g, ''))
                                        setSearchError('')
                                        setMostrarFormularioNuevo(false)
                                    }}
                                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSearch()}
                                    leftIcon={<User size={20} />}
                                    disabled={searchState === 'loading' || !!afiliado}
                                />
                            </div>
                            {!afiliado ? (
                                <Button
                                    onClick={handleSearch}
                                    isLoading={searchState === 'loading'}
                                    leftIcon={<Search size={20} />}
                                >
                                    Buscar
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    onClick={handleNuevaRadicacion}
                                    leftIcon={<User size={18} />}
                                    className="border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-50)]"
                                >
                                    Cambiar afiliado
                                </Button>
                            )}
                        </div>

                        {/* Error de búsqueda */}
                        {searchError && !mostrarFormularioNuevo && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                                <AlertCircle size={18} className="text-[var(--color-error)]" />
                                <p className="text-sm text-[var(--color-error)]">{searchError}</p>
                            </div>
                        )}

                        {/* Formulario de nuevo afiliado */}
                        {mostrarFormularioNuevo && !afiliado && (
                            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertCircle size={18} className="text-amber-600" />
                                    <p className="text-sm font-medium text-amber-800">
                                        Afiliado no encontrado. Complete los datos para crearlo:
                                    </p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Tipo de Documento *
                                        </label>
                                        <select
                                            value={nuevoAfiliado.tipoId}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNuevoAfiliado(prev => ({ ...prev, tipoId: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                        >
                                            <option value="CC">Cédula de Ciudadanía</option>
                                            <option value="TI">Tarjeta de Identidad</option>
                                            <option value="CE">Cédula de Extranjería</option>
                                            <option value="PA">Pasaporte</option>
                                            <option value="RC">Registro Civil</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Número de Documento *
                                        </label>
                                        <Input
                                            value={nuevoAfiliado.id}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, id: e.target.value.replace(/\D/g, '') }))}
                                            disabled
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Nombres *
                                        </label>
                                        <Input
                                            value={nuevoAfiliado.nombres}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, nombres: e.target.value }))}
                                            placeholder="Nombres completos"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Primer Apellido *
                                        </label>
                                        <Input
                                            value={nuevoAfiliado.apellido1}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, apellido1: e.target.value }))}
                                            placeholder="Primer apellido"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Segundo Apellido
                                        </label>
                                        <Input
                                            value={nuevoAfiliado.apellido2}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, apellido2: e.target.value }))}
                                            placeholder="Segundo apellido (opcional)"
                                        />
                                    </div>

                                    {/* Sexo */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Sexo
                                        </label>
                                        <select
                                            value={nuevoAfiliado.sexo}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNuevoAfiliado(prev => ({ ...prev, sexo: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] text-sm"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {SEXO_LISTA.map((s: { value: string; label: string }) => (
                                                <option key={s.value} value={s.value}>{s.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Fecha Nacimiento */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Fecha de Nacimiento
                                        </label>
                                        <input
                                            type="date"
                                            value={nuevoAfiliado.fechaNacimiento}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, fechaNacimiento: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] text-sm"
                                        />
                                    </div>

                                    {/* Teléfono */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Teléfono
                                        </label>
                                        <Input
                                            value={nuevoAfiliado.telefono}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, telefono: e.target.value }))}
                                            placeholder="Número de contacto"
                                        />
                                    </div>

                                    {/* Dirección - campo completo */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Dirección
                                        </label>
                                        <Input
                                            value={nuevoAfiliado.direccion}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, direccion: e.target.value }))}
                                            placeholder="Dirección de residencia"
                                        />
                                    </div>

                                    {/* Municipio - Autocomplete */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Municipio
                                        </label>
                                        <Autocomplete
                                            value={nuevoAfiliado.municipioNombre}
                                            onChange={(val: string) => {
                                                const municipio = MUNICIPIOS_CORDOBA.find((m: { codigo: string; nombre: string; departamento: string }) => m.nombre === val)
                                                setNuevoAfiliado(prev => ({
                                                    ...prev,
                                                    municipioNombre: val,
                                                    municipioCodigo: municipio?.codigo || '',
                                                    departamento: municipio?.departamento || '23',
                                                }))
                                            }}
                                            options={MUNICIPIOS_CORDOBA.map((m: { codigo: string; nombre: string; departamento: string }) => m.nombre)}
                                            placeholder="Buscar municipio..."
                                            allowFreeText={false}
                                        />
                                    </div>

                                    {/* Régimen */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Régimen
                                        </label>
                                        <select
                                            value={nuevoAfiliado.regimen}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNuevoAfiliado(prev => ({ ...prev, regimen: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] text-sm"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {REGIMEN_LISTA.map((r: { value: string; label: string }) => (
                                                <option key={r.value} value={r.value}>{r.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* EPS */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            EPS
                                        </label>
                                        <select
                                            value={nuevoAfiliado.eps}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNuevoAfiliado(prev => ({ ...prev, eps: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] text-sm"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {EPS_LISTA.map((eps: string) => (
                                                <option key={eps} value={eps}>{eps}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Tipo Cotizante */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Tipo Cotizante
                                        </label>
                                        <select
                                            value={nuevoAfiliado.tipoCotizante}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNuevoAfiliado(prev => ({ ...prev, tipoCotizante: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] text-sm"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {TIPO_COTIZANTE_LISTA.map((t: { value: string; label: string }) => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* IPS Primaria - Autocomplete */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            IPS Primaria
                                        </label>
                                        <Autocomplete
                                            value={nuevoAfiliado.ipsPrimaria}
                                            onChange={(val: string) => setNuevoAfiliado(prev => ({ ...prev, ipsPrimaria: val }))}
                                            options={IPS_PRIMARIA_LISTA}
                                            placeholder="Buscar IPS..."
                                            allowFreeText={true}
                                        />
                                    </div>
                                </div>

                                {searchError && (
                                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                                        {searchError}
                                    </div>
                                )}

                                <div className="mt-4 flex justify-end">
                                    <Button
                                        onClick={handleCrearAfiliado}
                                        isLoading={creandoAfiliado}
                                        leftIcon={<Plus size={18} />}
                                    >
                                        Crear y continuar
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Info del afiliado encontrado */}
                        {afiliado && (
                            <div className={`mt-4 p-4 rounded-lg border transition-colors ${afiliado.eps?.toUpperCase().includes('SALUD TOTAL')
                                ? 'bg-rose-50 border-rose-200'
                                : 'bg-[var(--color-primary-50)] border-transparent'
                                }`}>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500">Documento</p>
                                        <p className={`font-semibold ${afiliado.eps?.toUpperCase().includes('SALUD TOTAL')
                                            ? 'text-rose-600'
                                            : 'text-[var(--color-primary)]'
                                            }`}>{afiliado.id}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-xs text-gray-500">Nombre Completo</p>
                                        <p className="font-medium">{getNombreCompleto(afiliado)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">EPS</p>
                                        <p className={`font-bold ${afiliado.eps?.toUpperCase().includes('SALUD TOTAL')
                                            ? 'text-rose-700'
                                            : 'font-medium'
                                            }`}>{afiliado.eps || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Teléfono</p>
                                        <div className="font-medium">
                                            <EditablePhone
                                                initialValue={afiliado.telefono}
                                                tipoId={afiliado.tipoId || ''}
                                                id={afiliado.id || ''}
                                                onUpdate={handlePhoneUpdate}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ============================================ */}
                        {/* SELECTOR DE ACCIONES - Después de encontrar afiliado */}
                        {/* ============================================ */}
                        {afiliado && vistaActiva === 'selector' && !radicacionExitosa && (
                            <div className="mt-6">
                                <p className="text-sm font-medium text-gray-600 mb-4 text-center">
                                    ¿Qué deseas hacer?
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                                    {/* Botón Radicar Caso */}
                                    <button
                                        type="button"
                                        onClick={() => setVistaActiva('radicar')}
                                        className="group relative flex flex-col items-center p-6 rounded-2xl border-2 border-gray-100 bg-gradient-to-br from-white to-gray-50 hover:border-[var(--color-primary)] hover:shadow-xl hover:shadow-[var(--color-primary)]/10 transition-all duration-300 hover:-translate-y-1"
                                    >
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-blue-600 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                                            <Send size={28} className="text-white" />
                                        </div>
                                        <h3 className="font-bold text-lg text-gray-800 mb-1">Radicar Caso</h3>
                                        <p className="text-sm text-gray-500 text-center">
                                            Crear nueva solicitud de auditoría o trámite
                                        </p>
                                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ChevronRight size={20} className="text-[var(--color-primary)]" />
                                        </div>
                                    </button>

                                    {/* Botón Ver Respuestas */}
                                    <button
                                        type="button"
                                        onClick={() => setVistaActiva('respuestas')}
                                        className="group relative flex flex-col items-center p-6 rounded-2xl border-2 border-gray-100 bg-gradient-to-br from-white to-gray-50 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 hover:-translate-y-1"
                                    >
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                                            <MessageCircle size={28} className="text-white" />
                                        </div>
                                        <h3 className="font-bold text-lg text-gray-800 mb-1">Ver Respuestas</h3>
                                        <p className="text-sm text-gray-500 text-center">
                                            Consultar estado y respuestas del Back
                                        </p>
                                        {historial.length > 0 && (
                                            <span className="absolute top-4 right-4 px-2.5 py-1 text-xs font-bold bg-emerald-500 text-white rounded-full shadow-md animate-pulse">
                                                {historial.length}
                                            </span>
                                        )}
                                        <div className={`absolute top-4 right-4 ${historial.length > 0 ? 'hidden' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                            <ChevronRight size={20} className="text-emerald-500" />
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}
                    </Card.Body>
                </Card>
            )}

            {/* ============================================ */}
            {/* PASO 2: DATOS DE LA SOLICITUD */}
            {/* ============================================ */}
            {afiliado && vistaActiva === 'radicar' && !radicacionExitosa && (
                <LoadingOverlay isLoading={submitState === 'loading'} label="Radicando caso...">
                    <Card>
                        <Card.Header>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Send size={20} className="text-[var(--color-primary)]" />
                                    Radicar Nuevo Caso
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleVolverSelector}
                                    leftIcon={<ArrowLeft size={16} />}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    Volver
                                </Button>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Selector Visual Premium de Tipo de Solicitud */}
                                <div className="space-y-4">
                                    <label className="block text-sm font-semibold text-gray-700">
                                        Tipo de Solicitud <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {[
                                            { id: 'Auditoría Médica', icon: Stethoscope, color: 'blue', desc: 'Evaluación técnica de pertinencia médica' },
                                            { id: 'Solicitud de Historia Clínica', icon: BookOpen, color: 'emerald', desc: 'Copia o resumen de registro clínico' },
                                            { id: 'Ajuste de Ordenamiento', icon: FileEdit, color: 'amber', desc: 'Corrección o cambio en órdenes médicas' },
                                            { id: 'Renovación de prequirúrgicos', icon: Activity, color: 'rose', desc: 'Actualización de exámenes para cirugía' },
                                            { id: 'Gestión de Mipres', icon: Zap, color: 'purple', desc: 'Trámite de tecnologías no PBS' },
                                            { id: 'Activación de Ruta', icon: Route, color: 'cyan', desc: 'Ingreso a rutas integrales de atención' },
                                        ].map((opcion) => (
                                            <button
                                                key={opcion.id}
                                                type="button"
                                                onClick={() => setTipoSolicitud(opcion.id as any)}
                                                className={`
                                                    relative group flex flex-row items-center p-4 rounded-xl border-2 transition-all duration-300 text-left gap-4
                                                    ${tipoSolicitud === opcion.id
                                                        ? `border-red-500 bg-red-50 shadow-md translate-y-[-2px]`
                                                        : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm hover:translate-y-[-1px]'
                                                    }
                                                `}
                                            >
                                                <div className={`
                                                    w-10 h-10 rounded-lg flex items-center justify-center transition-colors flex-shrink-0
                                                    ${tipoSolicitud === opcion.id
                                                        ? 'bg-red-500 text-white'
                                                        : 'bg-gray-50 text-gray-500 group-hover:bg-gray-100'
                                                    }
                                                `}>
                                                    <opcion.icon size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className={`font-bold text-sm mb-0.5 ${tipoSolicitud === opcion.id ? 'text-red-600' : 'text-gray-700'}`}>
                                                        {opcion.id}
                                                    </h3>
                                                    <p className="text-xs text-gray-500 leading-tight">
                                                        {opcion.desc}
                                                    </p>
                                                </div>
                                                {tipoSolicitud === opcion.id && (
                                                    <div className="absolute top-2 right-2 text-red-500">
                                                        <CheckCircle size={16} fill="currentColor" className="text-white" />
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Especialidad (solo para Auditoría Médica) */}
                                    {tipoSolicitud === 'Auditoría Médica' && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                                                Especialidad *
                                            </label>
                                            <select
                                                value={especialidad}
                                                onChange={(e) => setEspecialidad(e.target.value as EspecialidadAuditoria)}
                                                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] focus:border-[var(--color-primary)]"
                                            >
                                                {ESPECIALIDADES_LISTA.map((esp: EspecialidadAuditoria) => (
                                                    <option key={esp} value={esp}>
                                                        {esp}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Ordenador - Autocomplete (no requerido para Solicitud de Historia Clínica) */}
                                    {tipoSolicitud !== 'Solicitud de Historia Clínica' && (
                                        <div className={`space-y-2 ${tipoSolicitud !== 'Auditoría Médica' ? 'md:col-span-2' : ''}`}>
                                            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                                                Ordenador *
                                            </label>
                                            <OrdenadorAutocomplete
                                                value={ordenador}
                                                onChange={setOrdenador}
                                                placeholder="Escriba para buscar ordenador..."
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Busque por cualquier parte del nombre. Si no encuentra el ordenador, puede escribirlo libremente.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Observaciones y Soportes en misma fila */}
                                <div className="grid md:grid-cols-3 gap-6">
                                    {/* Observaciones (2/3) */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                                            Observaciones
                                        </label>
                                        <textarea
                                            value={observaciones}
                                            onChange={(e) => setObservaciones(e.target.value)}
                                            placeholder="Notas adicionales sobre la solicitud..."
                                            rows={5}
                                            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] focus:border-[var(--color-primary)] resize-none h-full"
                                        />
                                    </div>

                                    {/* Soportes - File Upload (1/3) */}
                                    <div className="h-full">
                                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                                            Soportes (PDF)
                                        </label>
                                        <FileUpload
                                            files={archivos}
                                            onChange={setArchivos}
                                            maxSizeMB={10}
                                            maxFiles={5}
                                        />
                                    </div>
                                </div>

                                {/* Error de envío */}
                                {submitError && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                                        <AlertCircle size={18} className="text-[var(--color-error)]" />
                                        <p className="text-sm text-[var(--color-error)]">{submitError}</p>
                                    </div>
                                )}

                                {/* Botón de envío */}
                                <div className="flex justify-end">
                                    <Button
                                        type="submit"
                                        size="lg"
                                        isLoading={submitState === 'loading'}
                                        leftIcon={<Send size={20} />}
                                    >
                                        Radicar Caso
                                    </Button>
                                </div>
                            </form>
                        </Card.Body>
                    </Card>
                </LoadingOverlay>
            )}

            {/* ============================================ */}
            {/* VISTA DE RESPUESTAS DEL BACK */}
            {/* ============================================ */}
            {afiliado && vistaActiva === 'respuestas' && (
                <Card>
                    <Card.Header>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MessageCircle size={20} className="text-emerald-500" />
                                Respuestas del Back
                                {historial.length > 0 && (
                                    <span className="ml-2 px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full">
                                        {historial.length} {historial.length === 1 ? 'caso' : 'casos'}
                                    </span>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleVolverSelector}
                                leftIcon={<ArrowLeft size={16} />}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                Volver
                            </Button>
                        </div>
                    </Card.Header>
                    <Card.Body>
                        <LoadingOverlay isLoading={cargandoHistorial} label="Cargando respuestas...">
                            {historial.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                                        <History size={36} className="text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-600 mb-2">
                                        Sin radicados previos
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-6">
                                        Este afiliado no tiene casos radicados aún
                                    </p>
                                    <Button
                                        variant="primary"
                                        onClick={() => setVistaActiva('radicar')}
                                        leftIcon={<Send size={18} />}
                                    >
                                        Radicar primer caso
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Filtros dinámicos por estado */}
                                    {historial.length > 3 && (
                                        <div className="flex flex-wrap gap-2 mb-4 p-1.5 bg-gray-50 rounded-lg border border-gray-100">
                                            <button
                                                onClick={() => setFiltroEstado('Todos')}
                                                className={`
                                                    px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                                                    ${filtroEstado === 'Todos'
                                                        ? 'bg-white text-[var(--color-primary)] shadow-sm ring-1 ring-gray-200'
                                                        : 'text-gray-500 hover:bg-gray-200/50 hover:text-gray-700'
                                                    }
                                                `}
                                            >
                                                Todos ({historial.length})
                                            </button>

                                            {Array.from(new Set(historial.map(r => r.estadoRadicado))).sort().map(estado => {
                                                const count = historial.filter(r => r.estadoRadicado === estado).length
                                                const isActive = filtroEstado === estado

                                                return (
                                                    <button
                                                        key={estado}
                                                        onClick={() => setFiltroEstado(estado)}
                                                        className={`
                                                            px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5
                                                            ${isActive
                                                                ? 'bg-white shadow-sm ring-1 ring-gray-200 text-gray-800'
                                                                : 'text-gray-500 hover:bg-gray-200/50 hover:text-gray-700'
                                                            }
                                                        `}
                                                    >
                                                        {estado}
                                                        <span className={`
                                                            px-1.5 py-0.5 rounded-full text-[10px] 
                                                            ${isActive ? 'bg-gray-100 text-gray-700' : 'bg-gray-200 text-gray-500'}
                                                        `}>
                                                            {count}
                                                        </span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {(filtroEstado === 'Todos'
                                        ? historial
                                        : historial.filter(h => h.estadoRadicado === filtroEstado)
                                    ).map((radicacion) => {
                                        const colores = ESTADO_COLORES[radicacion.estadoRadicado] || {
                                            bg: 'bg-gray-100',
                                            text: 'text-gray-700',
                                            border: 'border-gray-300'
                                        }
                                        const mostrarDireccionamiento = radicacion.tipoSolicitud === 'Auditoría Médica'
                                        // Detectar si el fondo es oscuro para ajustar colores de texto
                                        const esFondoOscuro = radicacion.estadoRadicado === 'Contrarreferido'

                                        return (
                                            <div
                                                key={radicacion.radicado}
                                                className={`p-4 rounded-xl border-2 ${colores.border} ${colores.bg} transition-all hover:shadow-md`}
                                            >
                                                {/* Header del radicado */}
                                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`font-mono font-bold text-lg ${esFondoOscuro ? 'text-cyan-400' : 'text-[var(--color-primary)]'}`}>
                                                            {radicacion.radicado}
                                                        </span>
                                                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${colores.bg} ${colores.text} border ${colores.border}`}>
                                                            {radicacion.estadoRadicado}
                                                        </span>
                                                    </div>
                                                    <div className={`flex items-center gap-1 text-sm ${esFondoOscuro ? 'text-gray-300' : 'text-gray-500'}`}>
                                                        <Clock size={14} />
                                                        {radicacion.createdAt.toLocaleDateString('es-CO', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric',
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Detalles */}
                                                <div className="grid gap-2 text-sm">
                                                    {/* Tipo de Solicitud - Badge destacado */}
                                                    <div className={`
                                                        inline-flex items-center gap-2 px-3 py-1.5 rounded-lg w-fit
                                                        ${esFondoOscuro
                                                            ? 'bg-gradient-to-r from-slate-700/80 to-slate-600/60 border border-slate-500/50'
                                                            : 'bg-gradient-to-r from-slate-50 to-white border border-slate-200 shadow-sm'
                                                        }
                                                    `}>
                                                        <FileText size={15} className={esFondoOscuro ? 'text-cyan-400' : 'text-[var(--color-primary)]'} />
                                                        <span className={`font-semibold ${esFondoOscuro ? 'text-white' : 'text-slate-700'}`}>
                                                            {radicacion.tipoSolicitud}
                                                        </span>
                                                        {radicacion.especialidad && (
                                                            <>
                                                                <span className={`mx-1 ${esFondoOscuro ? 'text-gray-500' : 'text-gray-300'}`}>•</span>
                                                                <span className={`font-medium ${esFondoOscuro ? 'text-indigo-300' : 'text-indigo-600'}`}>
                                                                    {radicacion.especialidad}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>

                                                    {radicacion.ordenador && (
                                                        <div className="flex items-center gap-2">
                                                            <User size={14} className={esFondoOscuro ? 'text-gray-400' : 'text-gray-400'} />
                                                            <span className={esFondoOscuro ? 'text-gray-300' : 'text-gray-600'}>Ordenador:</span>
                                                            <span className={`font-medium ${esFondoOscuro ? 'text-white' : ''}`}>{radicacion.ordenador}</span>
                                                        </div>
                                                    )}

                                                    {/* Direccionamiento (destacado) */}
                                                    {mostrarDireccionamiento && radicacion.direccionamiento && (
                                                        <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                            <div className="flex items-center gap-2">
                                                                <Route size={16} className="text-blue-600" />
                                                                <span className="text-blue-600 font-semibold">
                                                                    Direccionamiento: {!radicacion.direccionamiento || radicacion.direccionamiento === (null as unknown as string) || String(radicacion.direccionamiento) === 'NaN'
                                                                        ? (radicacion.estadoRadicado === 'Pendiente' ? 'Pendiente por gestión' : '-')
                                                                        : radicacion.direccionamiento}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Respuesta del Back (destacada y prominente) */}
                                                    {radicacion.respuestaBack && (
                                                        <div className="mt-3 p-4 bg-gradient-to-br from-white to-emerald-50 rounded-xl border-2 border-emerald-200 shadow-sm">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <MessageCircle size={16} className="text-emerald-600" />
                                                                <span className="text-sm font-bold text-emerald-700">Respuesta del Back:</span>
                                                            </div>
                                                            <div className="text-gray-800 leading-relaxed">
                                                                <MarkdownRenderer
                                                                    markdown={radicacion.respuestaBack === 'NaN' ? '-' : radicacion.respuestaBack}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Estado sin respuesta */}
                                                    {!radicacion.respuestaBack && radicacion.estadoRadicado === 'Pendiente' && (
                                                        <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-2">
                                                            <Clock size={16} className="text-amber-600" />
                                                            <span className="text-amber-700 text-sm">
                                                                Caso pendiente de respuesta
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Observaciones del Radicador (Contexto original) */}
                                                    {radicacion.observaciones && (
                                                        <div className={`mt-3 p-3 rounded-lg border flex flex-col gap-1
                                                            ${esFondoOscuro ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-200'}
                                                        `}>
                                                            <div className="flex items-center gap-2">
                                                                <FileText size={14} className={esFondoOscuro ? 'text-gray-400' : 'text-gray-500'} />
                                                                <span className={`text-xs font-bold uppercase ${esFondoOscuro ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                    Observaciones de la Solicitud:
                                                                </span>
                                                            </div>
                                                            <p className={`text-sm whitespace-pre-wrap ${esFondoOscuro ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                {(!radicacion.observaciones || radicacion.observaciones === 'NaN' || radicacion.observaciones.trim() === '')
                                                                    ? 'Ninguna observación'
                                                                    : radicacion.observaciones}
                                                            </p>
                                                            <p className={`text-xs italic mt-2 capitalize ${esFondoOscuro ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                Radicado por: {radicacion.radicador.toLowerCase()}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Soportes y Botón Copiar Respuesta */}
                                                    <div className="flex items-center justify-between mt-2">
                                                        {/* Soportes */}
                                                        <div className="flex flex-col gap-1 items-start">
                                                            {radicacion.soportes && radicacion.soportes.length > 0 && radicacion.soportes.map((url, idx) => (
                                                                <a
                                                                    key={idx}
                                                                    href={url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`text-xs hover:underline flex items-center gap-1 cursor-pointer ${esFondoOscuro ? 'text-cyan-400 hover:text-cyan-300' : 'text-blue-600 hover:text-blue-800'}`}
                                                                >
                                                                    📎 {radicacion.soportes!.length > 1 ? `Archivo adjunto ${idx + 1}` : '1 archivo(s) adjunto(s)'}
                                                                </a>
                                                            ))}
                                                        </div>

                                                        {/* Botón Copiar Respuesta - Solo visible si hay respuesta válida */}
                                                        {radicacion.respuestaBack &&
                                                            radicacion.respuestaBack !== 'NaN' &&
                                                            radicacion.respuestaBack.trim() !== '' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        try {
                                                                            const exito = await copyRichText(radicacion.respuestaBack || '')
                                                                            if (exito) {
                                                                                setCopiandoRespuesta(radicacion.radicado)
                                                                                // Resetear animación después de 2 segundos
                                                                                setTimeout(() => setCopiandoRespuesta(null), 2000)
                                                                            }
                                                                        } catch (err) {
                                                                            console.error('Error al copiar:', err)
                                                                        }
                                                                    }}
                                                                    className={`
                                                                    flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                                                                    transition-all duration-300 ease-out
                                                                    ${copiandoRespuesta === radicacion.radicado
                                                                            ? 'bg-emerald-500 text-white scale-105 shadow-lg shadow-emerald-500/30'
                                                                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm'
                                                                        }
                                                                `}
                                                                >
                                                                    {copiandoRespuesta === radicacion.radicado ? (
                                                                        <>
                                                                            <Check size={14} className="animate-bounce" />
                                                                            ¡Copiado!
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Copy size={14} />
                                                                            Copiar Respuesta
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </LoadingOverlay>
                    </Card.Body>
                </Card>
            )}
        </div>
    )
}

export default RadicacionCasosPage
