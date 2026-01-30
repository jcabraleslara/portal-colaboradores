/**
 * Vista de Radicación de Recobros
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * Formulario para radicar nuevas solicitudes de recobro
 */

import { useState, useCallback, useEffect } from 'react'
import {
    Search,
    User,
    AlertCircle,
    CheckCircle,
    Plus,
    FileText,
    Upload,
    Trash2,
    Send,
    History,
    X,
    MapPin,
    Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, Button, Input, LoadingOverlay } from '@/components/common'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import { afiliadosService } from '@/services/afiliados.service'
import { recobrosService } from '@/services/recobros.service'
import { useAuth } from '@/context/AuthContext'
import { Afiliado, LoadingState } from '@/types'
import { AfiliadoFormModal } from '@/features/soportesFacturacion/AfiliadoFormModal'
import { CupsSelector } from './CupsSelector'
import { CupsSeleccionado, Recobro, ESTADO_RECOBRO_COLORES } from '@/types/recobros.types'

export function RadicacionRecobrosView() {
    const { user } = useAuth()

    // ============================================
    // ESTADO - Búsqueda de Paciente
    // ============================================
    const [documento, setDocumento] = useState('')
    const [paciente, setPaciente] = useState<Afiliado | null>(null)
    const [searchState, setSearchState] = useState<LoadingState>('idle')
    const [searchError, setSearchError] = useState('')
    const [mostrarModalCrearAfiliado, setMostrarModalCrearAfiliado] = useState(false)

    // ============================================
    // ESTADO - Datos del Formulario
    // ============================================
    const [cupsSeleccionados, setCupsSeleccionados] = useState<CupsSeleccionado[]>([])
    const [justificacion, setJustificacion] = useState('')
    const [archivos, setArchivos] = useState<File[]>([])

    // ============================================
    // ESTADO - Historial
    // ============================================
    const [historial, setHistorial] = useState<Recobro[]>([])
    const [mostrarHistorial, setMostrarHistorial] = useState(false)

    // ============================================
    // ESTADO - Envío
    // ============================================
    const [submitState, setSubmitState] = useState<LoadingState>('idle')
    const [submitError, setSubmitError] = useState('')
    const [radicacionExitosa, setRadicacionExitosa] = useState<Recobro | null>(null)

    // ============================================
    // EFECTOS
    // ============================================
    useEffect(() => {
        if (paciente?.id) {
            cargarHistorial(paciente.id)
        }
    }, [paciente?.id])

    // ============================================
    // HANDLERS - Búsqueda de Paciente
    // ============================================
    const handleSearch = async () => {
        if (!documento.trim()) {
            setSearchError('Ingresa un número de documento')
            return
        }

        setSearchState('loading')
        setSearchError('')
        setPaciente(null)
        setMostrarModalCrearAfiliado(false)

        const result = await afiliadosService.buscarPorDocumento(documento.trim())

        if (result.success && result.data) {
            setPaciente(result.data)
            setSearchState('success')
        } else {
            setSearchError('')
            setSearchState('error')
            setMostrarModalCrearAfiliado(true)
        }
    }

    const handleCrearAfiliadoSuccess = (nuevoAfiliado: {
        tipoId: string
        id: string
        nombres: string
        apellido1: string
        apellido2: string
        eps: string
        regimen: string
    }) => {
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

        setPaciente(afiliadoCompleto)
        setSearchState('success')
        setMostrarModalCrearAfiliado(false)
    }

    // ============================================
    // HANDLERS - Archivos
    // ============================================
    const handleFilesChange = useCallback((files: FileList | null) => {
        if (!files) return

        const nuevosArchivos = [...archivos]
        for (let i = 0; i < files.length && nuevosArchivos.length < 10; i++) {
            // Solo permitir PDFs
            if (files[i].type === 'application/pdf') {
                nuevosArchivos.push(files[i])
            }
        }
        setArchivos(nuevosArchivos)
    }, [archivos])

    const handleRemoveFile = useCallback((index: number) => {
        setArchivos(prev => prev.filter((_, i) => i !== index))
    }, [])

    // ============================================
    // HANDLERS - Historial
    // ============================================
    const cargarHistorial = async (pacienteId: string) => {
        const result = await recobrosService.obtenerHistorialPaciente(pacienteId)
        if (result.success && result.data) {
            setHistorial(result.data)
        }
    }

    // ============================================
    // HANDLERS - Formulario
    // ============================================
    const resetFormulario = () => {
        setCupsSeleccionados([])
        setJustificacion('')
        setArchivos([])
        setPaciente(null)
        setDocumento('')
        setSearchState('idle')
        setSubmitState('idle')
        setSubmitError('')
        setRadicacionExitosa(null)
        setHistorial([])
        setMostrarHistorial(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validaciones
        if (!paciente || !paciente.id) {
            setSubmitError('Debes seleccionar un paciente válido')
            return
        }

        if (cupsSeleccionados.length === 0) {
            setSubmitError('Debes agregar al menos un procedimiento CUPS')
            return
        }

        if (archivos.length === 0) {
            setSubmitError('Debes adjuntar al menos un soporte (PDF)')
            return
        }

        setSubmitState('loading')
        setSubmitError('')

        const result = await recobrosService.crearRecobro({
            pacienteId: paciente.id,
            pacienteTipoId: paciente.tipoId || undefined,
            pacienteNombres: getNombreCompleto(paciente) || undefined,
            cupsData: cupsSeleccionados,
            justificacion: justificacion || undefined,
            soportes: archivos,
            radicadorEmail: user?.email || '',
            radicadorNombre: user?.nombreCompleto,
        })

        if (result.success && result.data) {
            setSubmitState('success')
            setRadicacionExitosa(result.data)
            toast.success(`Recobro ${result.data.consecutivo} radicado exitosamente`)
        } else {
            setSubmitError(result.error || 'Error al radicar')
            setSubmitState('error')
            toast.error(result.error || 'Error al radicar el recobro')
        }
    }

    // ============================================
    // HELPERS
    // ============================================
    const getNombreCompleto = (af: Afiliado) => {
        return [af.nombres, af.apellido1, af.apellido2].filter(Boolean).join(' ')
    }

    // ============================================
    // RENDER
    // ============================================

    // Mensaje de éxito
    if (radicacionExitosa) {
        return (
            <Card className="border-[var(--color-success)] bg-green-50">
                <div className="flex items-start gap-4 p-6">
                    <div className="p-3 bg-[var(--color-success)] rounded-full">
                        <CheckCircle className="text-white" size={28} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-semibold text-[var(--color-success)]">
                            Recobro Radicado Exitosamente
                        </h3>
                        <p className="text-gray-600 mt-2">
                            Número de radicado:{' '}
                            <code className="bg-white px-3 py-1 rounded font-bold text-lg text-[var(--color-primary)]">
                                {radicacionExitosa.consecutivo}
                            </code>
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                            Paciente: {radicacionExitosa.pacienteNombres} ({radicacionExitosa.pacienteId})
                        </p>
                        <p className="text-sm text-gray-500">
                            CUPS: {radicacionExitosa.cupsData.length} procedimiento(s)
                        </p>
                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="success"
                                onClick={resetFormulario}
                                leftIcon={<Plus size={18} />}
                            >
                                Nueva Radicación
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        )
    }

    return (
        <LoadingOverlay isLoading={submitState === 'loading'} label="Radicando recobro...">
            <div className="grid gap-6 lg:grid-cols-2">
                {/* ============================================ */}
                {/* COLUMNA IZQUIERDA: Datos del Paciente */}
                {/* ============================================ */}
                <div className="space-y-6">
                    {/* Búsqueda de Paciente */}
                    <Card>
                        <Card.Header>
                            <div className="flex items-center gap-2">
                                <Search size={20} className="text-[var(--color-primary)]" />
                                Identificar Paciente
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
                                        disabled={searchState === 'loading' || !!paciente}
                                    />
                                    {!paciente ? (
                                        <Button
                                            onClick={handleSearch}
                                            isLoading={searchState === 'loading'}
                                        >
                                            <Search size={18} />
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                setPaciente(null)
                                                setDocumento('')
                                                setSearchState('idle')
                                                setHistorial([])
                                            }}
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

                                {/* Datos del Paciente Encontrado */}
                                {paciente && (
                                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="font-bold text-green-800 text-lg">
                                                    {getNombreCompleto(paciente)}
                                                </p>
                                                <p className="text-sm text-green-700 font-mono">
                                                    {paciente.tipoId} {paciente.id}
                                                </p>
                                            </div>
                                            <CheckCircle className="text-green-500" size={24} />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                                            {paciente.edad && (
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <User size={14} />
                                                    <span>{paciente.edad} años</span>
                                                </div>
                                            )}
                                            {paciente.ipsPrimaria && (
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <Building2 size={14} />
                                                    <span className="truncate">{paciente.ipsPrimaria}</span>
                                                </div>
                                            )}
                                            {paciente.municipio && (
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <MapPin size={14} />
                                                    <span>{paciente.municipio}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Contador de casos previos */}
                                        {historial.length > 0 && (
                                            <div className="mt-4 pt-3 border-t border-green-200">
                                                <button
                                                    type="button"
                                                    onClick={() => setMostrarHistorial(!mostrarHistorial)}
                                                    className="flex items-center gap-2 text-sm text-green-700 hover:text-green-800"
                                                >
                                                    <History size={16} />
                                                    <span>
                                                        {historial.length} recobro(s) previo(s)
                                                    </span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Card.Body>
                    </Card>

                    {/* Historial de Recobros (colapsable) */}
                    {mostrarHistorial && historial.length > 0 && (
                        <Card>
                            <Card.Header>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <History size={20} className="text-[var(--color-primary)]" />
                                        Historial de Recobros
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
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {historial.map(recobro => {
                                        const colores = ESTADO_RECOBRO_COLORES[recobro.estado]
                                        return (
                                            <div
                                                key={recobro.id}
                                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                            >
                                                <div>
                                                    <code className="font-bold text-[var(--color-primary)]">
                                                        {recobro.consecutivo}
                                                    </code>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {recobro.cupsData.length} CUPS
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colores.bg} ${colores.text}`}>
                                                        {recobro.estado}
                                                    </span>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {recobro.createdAt.toLocaleDateString('es-CO')}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </Card.Body>
                        </Card>
                    )}

                    {/* Justificación */}
                    <Card>
                        <Card.Header>
                            <div className="flex items-center gap-2">
                                <FileText size={20} className="text-[var(--color-primary)]" />
                                Justificación Clínica
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <RichTextEditor
                                value={justificacion}
                                onChange={setJustificacion}
                                placeholder="Describa la justificación clínica del recobro (opcional pero recomendado)..."
                                disabled={!paciente}
                            />
                        </Card.Body>
                    </Card>
                </div>

                {/* ============================================ */}
                {/* COLUMNA DERECHA: CUPS y Soportes */}
                {/* ============================================ */}
                <div className="space-y-6">
                    {/* Selector de CUPS */}
                    <Card>
                        <Card.Header>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Search size={20} className="text-[var(--color-primary)]" />
                                    Procedimientos CUPS <span className="text-red-500">*</span>
                                </div>
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                    {cupsSeleccionados.length} seleccionado(s)
                                </span>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <CupsSelector
                                value={cupsSeleccionados}
                                onChange={setCupsSeleccionados}
                                disabled={!paciente}
                            />
                        </Card.Body>
                    </Card>

                    {/* Carga de Soportes */}
                    <Card>
                        <Card.Header>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Upload size={20} className="text-[var(--color-primary)]" />
                                    Soportes Documentales <span className="text-red-500">*</span>
                                </div>
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                    {archivos.length} archivo(s)
                                </span>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <div className="space-y-4">
                                {/* Lista de archivos */}
                                {archivos.length > 0 && (
                                    <div className="space-y-2">
                                        {archivos.map((file, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                            >
                                                <div className="flex items-center gap-2 truncate flex-1">
                                                    <FileText size={18} className="text-red-500 flex-shrink-0" />
                                                    <span className="text-sm truncate">{file.name}</span>
                                                    <span className="text-xs text-gray-400">
                                                        ({(file.size / 1024).toFixed(1)} KB)
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFile(index)}
                                                    className="p-1 hover:bg-red-100 rounded text-red-500"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Dropzone */}
                                {archivos.length < 10 && (
                                    <label className={`
                                        flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                                        ${paciente
                                            ? 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-blue-300'
                                            : 'border-gray-200 bg-gray-100 cursor-not-allowed'
                                        }
                                    `}>
                                        <Upload size={32} className="text-gray-400 mb-2" />
                                        <p className="text-sm text-gray-600 text-center">
                                            Arrastra archivos aquí o haz clic para seleccionar
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Solo archivos PDF (máx. 10)
                                        </p>
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            multiple
                                            onChange={(e) => handleFilesChange(e.target.files)}
                                            disabled={!paciente}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>
                        </Card.Body>
                    </Card>

                    {/* Error de envío */}
                    {submitError && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                            <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                            <p className="text-sm text-red-600">{submitError}</p>
                        </div>
                    )}

                    {/* Botón de Envío */}
                    <Button
                        onClick={handleSubmit}
                        isLoading={submitState === 'loading'}
                        leftIcon={<Send size={18} />}
                        disabled={!paciente || cupsSeleccionados.length === 0 || archivos.length === 0}
                        className="w-full py-3 text-base"
                    >
                        Solicitar Recobro
                    </Button>
                </div>
            </div>

            {/* Modal Crear Afiliado */}
            {mostrarModalCrearAfiliado && (
                <AfiliadoFormModal
                    identificacion={documento}
                    onClose={() => setMostrarModalCrearAfiliado(false)}
                    onSuccess={handleCrearAfiliadoSuccess}
                />
            )}
        </LoadingOverlay>
    )
}

export default RadicacionRecobrosView
