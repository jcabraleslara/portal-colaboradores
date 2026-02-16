/**
 * Pestaña de consulta CIE-10
 * Módulo Consultar Tablas - Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Search, Stethoscope, Eraser } from 'lucide-react'
import { Card, Button, Input, LoadingOverlay } from '@/components/common'
import { buscarCie10Avanzado, type Cie10 } from '@/services/cie10.service'
import type { LoadingState } from '@/types'
import { UI } from '@/config/constants'

export function Cie10Tab() {
    const [query, setQuery] = useState('')
    const [resultados, setResultados] = useState<Cie10[]>([])
    const [seleccionado, setSeleccionado] = useState<Cie10 | null>(null)
    const [loadingState, setLoadingState] = useState<LoadingState>('idle')
    const [error, setError] = useState('')

    const handleSearch = useCallback(async () => {
        if (!query.trim()) {
            setError('Ingresa un código CIE-10 o descripción del diagnóstico')
            return
        }

        setLoadingState('loading')
        setError('')
        setResultados([])
        setSeleccionado(null)

        await new Promise(resolve => setTimeout(resolve, UI.SEARCH_DEBOUNCE_MS))

        const result = await buscarCie10Avanzado(query.trim())

        if (result.success && result.data) {
            setResultados(result.data)
            setLoadingState('success')
            if (result.data.length === 0) {
                setError('No se encontraron resultados')
            } else if (result.data.length === 1) {
                setSeleccionado(result.data[0])
            }
        } else {
            setError(result.error || 'Error al buscar')
            setLoadingState('error')
        }
    }, [query])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch()
    }

    const handleClear = () => {
        setQuery('')
        setResultados([])
        setSeleccionado(null)
        setError('')
        setLoadingState('idle')
    }

    return (
        <div className="space-y-6">
            {/* Búsqueda */}
            <Card>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            placeholder="Código CIE-10 o descripción del diagnóstico"
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

                {error && loadingState !== 'loading' && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-[var(--color-error)]">{error}</p>
                    </div>
                )}
            </Card>

            {/* Resultados */}
            <LoadingOverlay isLoading={loadingState === 'loading'} label="Buscando diagnósticos CIE-10...">
                {resultados.length > 0 && (
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Lista de resultados */}
                        <Card className="lg:col-span-1">
                            <Card.Header>
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Stethoscope size={20} className="text-[var(--color-primary)]" />
                                        Resultados
                                    </span>
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                        {resultados.length}
                                    </span>
                                </div>
                            </Card.Header>
                            <Card.Body className="p-0">
                                <div className="max-h-[500px] overflow-y-auto">
                                    {resultados.map((dx) => (
                                        <button
                                            key={dx.cie10}
                                            onClick={() => setSeleccionado(dx)}
                                            onDoubleClick={() => {
                                                const text = `${dx.cie10} - ${dx.cie10_descripcion || ''}`;
                                                navigator.clipboard.writeText(text);
                                                toast.success('Copiado: ' + text);
                                            }}
                                            className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors group ${seleccionado?.cie10 === dx.cie10
                                                ? 'bg-primary-50 border-l-4 border-l-primary-500'
                                                : ''
                                                }`}
                                            title="Doble clic para copiar Código + Descripción"
                                        >
                                            <p className="font-mono text-sm font-bold text-primary-600 group-hover:text-primary-700">
                                                {dx.cie10}
                                            </p>
                                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                {dx.cie10_descripcion || 'Sin descripción'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </Card.Body>
                        </Card>

                        {/* Panel de detalle */}
                        {seleccionado ? (
                            <Card className="lg:col-span-2">
                                <Card.Header>
                                    <div
                                        className="flex flex-col gap-1 cursor-pointer group"
                                        onClick={() => {
                                            navigator.clipboard.writeText(seleccionado.cie10);
                                            toast.success('Código copiado: ' + seleccionado.cie10);
                                        }}
                                        title="Click para copiar código"
                                    >
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider group-hover:text-primary-400 transition-colors">
                                            Código CIE-10
                                        </span>
                                        <span className="font-mono text-4xl font-black text-primary-600 group-hover:scale-105 transition-transform origin-left">
                                            {seleccionado.cie10}
                                        </span>
                                    </div>
                                </Card.Header>
                                <Card.Body>
                                    <div className="space-y-6">
                                        <FieldGroup label="Descripción">
                                            <p
                                                className="text-gray-800 text-xl font-bold hover:text-primary-700 cursor-pointer transition-colors leading-tight"
                                                onClick={() => {
                                                    const desc = seleccionado.cie10_descripcion || '';
                                                    navigator.clipboard.writeText(desc);
                                                    toast.success('Descripción copiada');
                                                }}
                                                title="Click para copiar descripción"
                                            >
                                                {seleccionado.cie10_descripcion || '—'}
                                            </p>
                                        </FieldGroup>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <FieldGroup label="Días Incapacidad - Salud Total">
                                                <span className={`inline-flex items-center px-4 py-2 rounded-lg text-lg font-bold ${
                                                    seleccionado.st_dias_incapacidad != null
                                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                        : 'bg-gray-50 text-gray-400 border border-gray-200'
                                                }`}>
                                                    {seleccionado.st_dias_incapacidad != null
                                                        ? `${seleccionado.st_dias_incapacidad} días`
                                                        : 'No definido'}
                                                </span>
                                            </FieldGroup>

                                            <FieldGroup label="Días Incapacidad - Nueva EPS">
                                                <span className={`inline-flex items-center px-4 py-2 rounded-lg text-lg font-bold ${
                                                    seleccionado.neps_dias_incapacidad != null
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : 'bg-gray-50 text-gray-400 border border-gray-200'
                                                }`}>
                                                    {seleccionado.neps_dias_incapacidad != null
                                                        ? `${seleccionado.neps_dias_incapacidad} días`
                                                        : 'No definido'}
                                                </span>
                                            </FieldGroup>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        ) : (
                            <Card className="lg:col-span-2 flex items-center justify-center min-h-[300px]">
                                <div className="text-center text-gray-400">
                                    <Stethoscope size={48} className="mx-auto mb-3 opacity-50" />
                                    <p>Selecciona un diagnóstico para ver sus detalles</p>
                                </div>
                            </Card>
                        )}
                    </div>
                )}
            </LoadingOverlay>
        </div>
    )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-gray-500 mb-2">{label}</label>
            {children}
        </div>
    )
}

export default Cie10Tab
