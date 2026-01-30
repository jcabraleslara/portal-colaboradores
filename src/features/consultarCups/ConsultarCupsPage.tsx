/**
 * Página de Consulta de CUPS
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Search, FileText, Eraser, Save, Check, X } from 'lucide-react'
import { Card, Button, Input, LoadingOverlay } from '@/components/common'
import { cupsService, PERTINENCIA_OPTIONS, type PertinenciaOption } from '@/services/cups.service'
import { useAuth } from '@/context/AuthContext'
import type { Cups, LoadingState } from '@/types'
import { UI } from '@/config/constants'

const CONTRATOS_CONFIG = [
    { key: 'pgp_rc', label: 'PGP NEPS RC' },
    { key: 'pgp_rs', label: 'PGP NEPS RS' },
    { key: 'pgp_derm', label: 'PGP Salud Total DERM' },
    { key: 'cpt_cerete', label: 'Cápita ST Cereté' },
    { key: 'cpt_monteria', label: 'Cápita NEPS Montería' },
    { key: 'cpt_cienaga', label: 'Cápita NEPS Ciénaga' },
    { key: 'pgp_imat', label: 'PGP IMAT' },
] as const


export function ConsultarCupsPage() {
    const { user } = useAuth()
    const isSuperadmin = user?.rol === 'superadmin'

    const [query, setQuery] = useState('')
    const [resultados, setResultados] = useState<Cups[]>([])
    const [cupsSeleccionado, setCupsSeleccionado] = useState<Cups | null>(null)
    const [loadingState, setLoadingState] = useState<LoadingState>('idle')
    const [error, setError] = useState('')

    // Estado para edición (solo superadmin)
    const [modoEdicion, setModoEdicion] = useState(false)
    const [cupsEditado, setCupsEditado] = useState<Cups | null>(null)
    const [guardando, setGuardando] = useState(false)
    const [mensajeExito, setMensajeExito] = useState('')

    const handleSearch = useCallback(async () => {
        if (!query.trim()) {
            setError('Ingresa un código CUPS o descripción')
            return
        }

        setLoadingState('loading')
        setError('')
        setResultados([])
        setCupsSeleccionado(null)
        setModoEdicion(false)

        await new Promise(resolve => setTimeout(resolve, UI.SEARCH_DEBOUNCE_MS))

        const result = await cupsService.buscar(query.trim())

        if (result.success && result.data) {
            setResultados(result.data)
            setLoadingState('success')
            if (result.data.length === 0) {
                setError('No se encontraron resultados')
            } else if (result.data.length === 1) {
                const uniqueCups = result.data[0]
                setCupsSeleccionado(uniqueCups)
                setCupsEditado({ ...uniqueCups })
                setModoEdicion(false)
                setMensajeExito('')
            }
        } else {
            setError(result.error || 'Error al buscar')
            setLoadingState('error')
        }
    }, [query])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch()
        }
    }

    const handleClear = () => {
        setQuery('')
        setResultados([])
        setCupsSeleccionado(null)
        setError('')
        setLoadingState('idle')
        setModoEdicion(false)
        setCupsEditado(null)
    }

    const handleSelectCups = (cups: Cups) => {
        setCupsSeleccionado(cups)
        setCupsEditado({ ...cups })
        setModoEdicion(false)
        setMensajeExito('')
    }

    const handleToggleEdicion = () => {
        if (modoEdicion) {
            // Cancelar edición
            setCupsEditado(cupsSeleccionado ? { ...cupsSeleccionado } : null)
        }
        setModoEdicion(!modoEdicion)
        setMensajeExito('')
    }

    const handleInputChange = (field: keyof Cups, value: string | boolean | string[] | null) => {
        if (!cupsEditado) return
        setCupsEditado({ ...cupsEditado, [field]: value })
    }

    const handlePertinenciaToggle = (option: PertinenciaOption) => {
        if (!cupsEditado) return
        const current = cupsEditado.pertinencia || []
        const updated = current.includes(option)
            ? current.filter(p => p !== option)
            : [...current, option]
        setCupsEditado({ ...cupsEditado, pertinencia: updated.length > 0 ? updated : null })
    }

    const handleGuardar = async () => {
        if (!cupsEditado || !cupsSeleccionado) return

        setGuardando(true)
        setMensajeExito('')

        const result = await cupsService.actualizar(cupsSeleccionado.cups, cupsEditado)

        if (result.success && result.data) {
            setCupsSeleccionado(result.data)
            setCupsEditado({ ...result.data })
            setModoEdicion(false)
            setMensajeExito('CUPS actualizado correctamente')
            // Actualizar en la lista de resultados
            setResultados(prev =>
                prev.map(c => c.cups === result.data!.cups ? result.data! : c)
            )
            setTimeout(() => setMensajeExito(''), 3000)
        } else {
            setError(result.error || 'Error al guardar')
        }

        setGuardando(false)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                    Consultar CUPS
                </h1>
                <p className="text-gray-500 mt-1">
                    Buscar procedimientos por código o descripción
                </p>
            </div>

            {/* Búsqueda */}
            <Card>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            placeholder="Código CUPS o palabras de la descripción"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value)
                                setError('')
                            }}
                            onKeyDown={handleKeyDown}
                            leftIcon={<Search size={20} />}
                            size="lg"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={handleSearch}
                            isLoading={loadingState === 'loading'}
                            size="lg"
                            leftIcon={<Search size={20} />}
                        >
                            Buscar
                        </Button>
                        {(resultados.length > 0 || error) && (
                            <Button
                                variant="accent"
                                size="lg"
                                onClick={handleClear}
                                leftIcon={<Eraser size={20} />}
                                className="animate-scale-in"
                            >
                                Limpiar
                            </Button>
                        )}
                    </div>
                </div>

                {/* Error */}
                {error && loadingState !== 'loading' && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-[var(--color-error)]">{error}</p>
                    </div>
                )}
            </Card>

            {/* Resultados */}
            <LoadingOverlay isLoading={loadingState === 'loading'} label="Buscando CUPS...">
                {resultados.length > 0 && (
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Lista de resultados */}
                        <Card className="lg:col-span-1">
                            <Card.Header>
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <FileText size={20} className="text-[var(--color-primary)]" />
                                        Resultados
                                    </span>
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                        {resultados.length}
                                    </span>
                                </div>
                            </Card.Header>
                            <Card.Body className="p-0">
                                <div className="max-h-[500px] overflow-y-auto">
                                    {resultados.map((cups) => (
                                        <button
                                            key={cups.cups}
                                            onClick={() => handleSelectCups(cups)}
                                            onDoubleClick={() => {
                                                const text = `${cups.cups} - ${cups.descripcion || ''}`;
                                                navigator.clipboard.writeText(text);
                                                toast.success('Copiado: ' + text);
                                            }}
                                            className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors group ${cupsSeleccionado?.cups === cups.cups
                                                ? 'bg-primary-50 border-l-4 border-l-primary-500'
                                                : ''
                                                }`}
                                            title="Doble clic para copiar Código + Descripción"
                                        >
                                            <p className="font-mono text-sm font-bold text-primary-600 group-hover:text-primary-700">
                                                {cups.cups}
                                            </p>
                                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                {cups.descripcion || 'Sin descripción'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </Card.Body>
                        </Card>

                        {/* Panel de detalle */}
                        {cupsSeleccionado && cupsEditado && (
                            <Card className="lg:col-span-2">
                                <Card.Header>
                                    <div className="flex items-start justify-between">
                                        <div
                                            className="flex flex-col gap-1 cursor-pointer group"
                                            onClick={() => {
                                                navigator.clipboard.writeText(cupsSeleccionado.cups);
                                                toast.success('Código CUPS copiado: ' + cupsSeleccionado.cups);
                                            }}
                                            title="Click para copiar código"
                                        >
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider group-hover:text-primary-400 transition-colors">
                                                Código CUPS
                                            </span>
                                            <span className="font-mono text-4xl font-black text-primary-600 group-hover:scale-105 transition-transform origin-left">
                                                {cupsSeleccionado.cups}
                                            </span>
                                        </div>
                                        {isSuperadmin && (
                                            <div className="flex gap-2 pt-2">
                                                {modoEdicion ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="primary"
                                                            onClick={handleGuardar}
                                                            isLoading={guardando}
                                                            leftIcon={<Save size={16} />}
                                                        >
                                                            Guardar
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={handleToggleEdicion}
                                                            leftIcon={<X size={16} />}
                                                        >
                                                            Cancelar
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={handleToggleEdicion}
                                                        className="text-gray-400 hover:text-primary-600 hover:bg-primary-50"
                                                    >
                                                        Editar
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </Card.Header>
                                <Card.Body>
                                    {/* Mensaje de éxito */}
                                    {mensajeExito && (
                                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                                            <Check size={18} />
                                            {mensajeExito}
                                        </div>
                                    )}

                                    <div className="space-y-6">
                                        {/* Descripción */}
                                        <FieldGroup label="Descripción">
                                            {modoEdicion ? (
                                                <textarea
                                                    value={cupsEditado.descripcion || ''}
                                                    onChange={(e) => handleInputChange('descripcion', e.target.value)}
                                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[80px]"
                                                />
                                            ) : (
                                                <p
                                                    className="text-gray-800 text-xl font-bold hover:text-primary-700 cursor-pointer transition-colors leading-tight"
                                                    onClick={() => {
                                                        const desc = cupsSeleccionado.descripcion || '';
                                                        navigator.clipboard.writeText(desc);
                                                        toast.success('Descripción copiada');
                                                    }}
                                                    title="Click para copiar descripción"
                                                >
                                                    {cupsSeleccionado.descripcion || '—'}
                                                </p>
                                            )}
                                        </FieldGroup>

                                        {/* Campos booleanos de contratos */}
                                        <FieldGroup label="Contratos Activos">
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {CONTRATOS_CONFIG.map(({ key, label }) => {
                                                    const value = modoEdicion
                                                        ? cupsEditado?.[key as keyof Cups]
                                                        : cupsSeleccionado?.[key as keyof Cups]

                                                    // En modo lectura, ocultar los que son false
                                                    if (!modoEdicion && value !== true) return null

                                                    return (
                                                        <BooleanChip
                                                            key={key}
                                                            label={label}
                                                            value={value as boolean}
                                                            editable={modoEdicion}
                                                            onChange={(v) => handleInputChange(key as keyof Cups, v)}
                                                        />
                                                    )
                                                })}

                                                {!modoEdicion && !CONTRATOS_CONFIG.some(c => cupsSeleccionado?.[c.key as keyof Cups] === true) && (
                                                    <div className="col-span-full py-2">
                                                        <p className="text-gray-500 italic text-sm bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 inline-block">
                                                            Este CUPS no tiene contrato asociado
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </FieldGroup>

                                        {/* Pertinencia - Multi-select */}
                                        <FieldGroup label="Pertinencia">
                                            <div className="flex flex-wrap gap-2">
                                                {PERTINENCIA_OPTIONS.map((option) => {
                                                    const isSelected = (modoEdicion ? cupsEditado.pertinencia : cupsSeleccionado.pertinencia)?.includes(option) ?? false
                                                    return (
                                                        <button
                                                            key={option}
                                                            type="button"
                                                            disabled={!modoEdicion}
                                                            onClick={() => handlePertinenciaToggle(option)}
                                                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${isSelected
                                                                ? 'bg-primary-500 text-white'
                                                                : modoEdicion
                                                                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                    : 'bg-gray-100 text-gray-400'
                                                                } ${modoEdicion ? 'cursor-pointer' : 'cursor-default'}`}
                                                        >
                                                            {isSelected && <Check size={14} className="inline mr-1" />}
                                                            {option}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </FieldGroup>

                                        {/* Contratos (texto) */}
                                        <FieldGroup label="Contratos Sisma">
                                            {modoEdicion ? (
                                                <Input
                                                    value={cupsEditado.contratos || ''}
                                                    onChange={(e) => handleInputChange('contratos', e.target.value)}
                                                />
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {cupsSeleccionado.contratos ? (
                                                        cupsSeleccionado.contratos.split(',').map((contrato, index) => (
                                                            <span
                                                                key={index}
                                                                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm hover:bg-indigo-100 transition-colors cursor-default"
                                                            >
                                                                {contrato.trim()}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <p className="text-gray-500 italic">Sin contratos asignados</p>
                                                    )}
                                                </div>
                                            )}
                                        </FieldGroup>

                                        {/* Observaciones */}
                                        <FieldGroup label="Observaciones">
                                            {modoEdicion ? (
                                                <textarea
                                                    value={cupsEditado.observaciones || ''}
                                                    onChange={(e) => handleInputChange('observaciones', e.target.value)}
                                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[100px]"
                                                />
                                            ) : (
                                                <p className="text-gray-700 whitespace-pre-wrap">
                                                    {cupsSeleccionado.observaciones || '—'}
                                                </p>
                                            )}
                                        </FieldGroup>
                                    </div>
                                </Card.Body>
                            </Card>
                        )}

                        {/* Placeholder cuando no hay selección */}
                        {!cupsSeleccionado && (
                            <Card className="lg:col-span-2 flex items-center justify-center min-h-[300px]">
                                <div className="text-center text-gray-400">
                                    <FileText size={48} className="mx-auto mb-3 opacity-50" />
                                    <p>Selecciona un CUPS para ver sus detalles</p>
                                </div>
                            </Card>
                        )}
                    </div>
                )}
            </LoadingOverlay>
        </div>
    )
}

// Componentes auxiliares
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-gray-500 mb-2">{label}</label>
            {children}
        </div>
    )
}

function BooleanChip({
    label,
    value,
    editable,
    onChange,
}: {
    label: string
    value: boolean | null
    editable: boolean
    onChange: (value: boolean) => void
}) {
    const isActive = value === true

    return (
        <button
            type="button"
            disabled={!editable}
            onClick={() => editable && onChange(!isActive)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${isActive
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-600 border border-red-200'
                } ${editable ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'}`}
        >
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-400'}`} />
            {label}
        </button>
    )
}

export default ConsultarCupsPage
