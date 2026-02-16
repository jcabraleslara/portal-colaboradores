/**
 * Pestaña de consulta de Medicamentos (MAPIISS)
 * Módulo Consultar Tablas - Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Search, Pill, Eraser } from 'lucide-react'
import { Card, Button, Input, LoadingOverlay } from '@/components/common'
import { medicamentosService, type Medicamento } from '@/services/medicamentos.service'
import type { LoadingState } from '@/types'
import { UI } from '@/config/constants'

export function MedicamentosTab() {
    const [query, setQuery] = useState('')
    const [resultados, setResultados] = useState<Medicamento[]>([])
    const [seleccionado, setSeleccionado] = useState<Medicamento | null>(null)
    const [loadingState, setLoadingState] = useState<LoadingState>('idle')
    const [error, setError] = useState('')

    const handleSearch = useCallback(async () => {
        if (!query.trim()) {
            setError('Ingresa un código MAPIISS o nombre del medicamento')
            return
        }

        setLoadingState('loading')
        setError('')
        setResultados([])
        setSeleccionado(null)

        await new Promise(resolve => setTimeout(resolve, UI.SEARCH_DEBOUNCE_MS))

        const result = await medicamentosService.buscar(query.trim())

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
                            placeholder="Código MAPIISS o nombre del medicamento"
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
            <LoadingOverlay isLoading={loadingState === 'loading'} label="Buscando medicamentos...">
                {resultados.length > 0 && (
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Lista de resultados */}
                        <Card className="lg:col-span-1">
                            <Card.Header>
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Pill size={20} className="text-[var(--color-primary)]" />
                                        Resultados
                                    </span>
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                        {resultados.length}
                                    </span>
                                </div>
                            </Card.Header>
                            <Card.Body className="p-0">
                                <div className="max-h-[500px] overflow-y-auto">
                                    {resultados.map((med) => (
                                        <button
                                            key={med.mapiiss}
                                            onClick={() => setSeleccionado(med)}
                                            onDoubleClick={() => {
                                                const text = `${med.mapiiss} - ${med.map_descripcion || ''}`;
                                                navigator.clipboard.writeText(text);
                                                toast.success('Copiado: ' + text);
                                            }}
                                            className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors group ${seleccionado?.mapiiss === med.mapiiss
                                                ? 'bg-primary-50 border-l-4 border-l-primary-500'
                                                : ''
                                                }`}
                                            title="Doble clic para copiar Código + Descripción"
                                        >
                                            <p className="font-mono text-sm font-bold text-primary-600 group-hover:text-primary-700">
                                                {med.mapiiss}
                                            </p>
                                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                {med.map_descripcion || 'Sin descripción'}
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
                                            navigator.clipboard.writeText(seleccionado.mapiiss);
                                            toast.success('Código copiado: ' + seleccionado.mapiiss);
                                        }}
                                        title="Click para copiar código"
                                    >
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider group-hover:text-primary-400 transition-colors">
                                            Código MAPIISS
                                        </span>
                                        <span className="font-mono text-4xl font-black text-primary-600 group-hover:scale-105 transition-transform origin-left">
                                            {seleccionado.mapiiss}
                                        </span>
                                    </div>
                                </Card.Header>
                                <Card.Body>
                                    <div className="space-y-6">
                                        <FieldGroup label="Descripción">
                                            <p
                                                className="text-gray-800 text-xl font-bold hover:text-primary-700 cursor-pointer transition-colors leading-tight"
                                                onClick={() => {
                                                    const desc = seleccionado.map_descripcion || '';
                                                    navigator.clipboard.writeText(desc);
                                                    toast.success('Descripción copiada');
                                                }}
                                                title="Click para copiar descripción"
                                            >
                                                {seleccionado.map_descripcion || '—'}
                                            </p>
                                        </FieldGroup>

                                        <FieldGroup label="Capítulo">
                                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                {seleccionado.capitulo || '—'}
                                            </span>
                                        </FieldGroup>
                                    </div>
                                </Card.Body>
                            </Card>
                        ) : (
                            <Card className="lg:col-span-2 flex items-center justify-center min-h-[300px]">
                                <div className="text-center text-gray-400">
                                    <Pill size={48} className="mx-auto mb-3 opacity-50" />
                                    <p>Selecciona un medicamento para ver sus detalles</p>
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

export default MedicamentosTab
