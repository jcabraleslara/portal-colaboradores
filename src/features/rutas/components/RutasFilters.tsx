import { Search, Filter, Calendar, RefreshCw, X } from 'lucide-react'
import { Button, Card, Input } from '@/components/common'
import { ESTADOS_RADICADO_LISTA, EstadoRadicado } from '@/types/back.types'

interface RutasFiltersProps {
    busqueda: string
    filtros: {
        estadoRadicado: string
        ruta?: string | null
        fechaInicio?: string
        fechaFin?: string
    }
    mostrarFiltros: boolean
    onBusquedaChange: (val: string) => void
    onFiltroChange: (key: string, val: any) => void
    onToggleFiltros: () => void
    onBuscar: () => void
    onLimpiarBusqueda: () => void
    onLimpiarFiltros: () => void
    onRefrescar: () => void
}

export function RutasFilters({
    busqueda,
    filtros,
    mostrarFiltros,
    onBusquedaChange,
    onFiltroChange,
    onToggleFiltros,
    onBuscar,
    onLimpiarBusqueda,
    onLimpiarFiltros,
    onRefrescar
}: RutasFiltersProps) {

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onBuscar()
        }
    }

    return (
        <Card className="bg-[var(--color-primary-50)] border-[var(--color-primary-200)] shadow-md">
            <Card.Body className="space-y-4">
                {/* Barra principal */}
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Buscador */}
                    <div className="flex-1 relative">
                        <Input
                            placeholder="Buscar por radicado, nombres/apellidos o identificación..."
                            value={busqueda}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onBusquedaChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            leftIcon={<Search size={18} />}
                        />
                        {busqueda && (
                            <button
                                onClick={onLimpiarBusqueda}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                            >
                                <X size={16} className="text-gray-400" />
                            </button>
                        )}
                    </div>

                    {/* Botones */}
                    <div className="flex gap-2">
                        <Button
                            onClick={onBuscar}
                            leftIcon={<Search size={18} />}
                        >
                            Buscar
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={onToggleFiltros}
                            leftIcon={<Filter size={18} />}
                            className={mostrarFiltros ? 'bg-gray-100' : ''}
                        >
                            Filtros
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={onRefrescar}
                            leftIcon={<RefreshCw size={18} />}
                            title="Refrescar"
                        />
                    </div>
                </div>

                {/* Filtros expandidos */}
                {mostrarFiltros && (
                    <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100 animate-fade-in">
                        {/* Estado */}
                        <div className="min-w-[150px]">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                            <select
                                value={filtros.estadoRadicado || 'Todos'}
                                onChange={(e) => onFiltroChange('estadoRadicado', e.target.value as EstadoRadicado | 'Todos')}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                            >
                                {ESTADOS_RADICADO_LISTA.map(estado => (
                                    <option key={estado} value={estado}>{estado}</option>
                                ))}
                            </select>
                        </div>

                        {/* Fecha inicio */}
                        <div className="min-w-[150px]">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={filtros.fechaInicio || ''}
                                    onChange={(e) => onFiltroChange('fechaInicio', e.target.value || undefined)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                />
                                <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Fecha fin */}
                        <div className="min-w-[150px]">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={filtros.fechaFin || ''}
                                    onChange={(e) => onFiltroChange('fechaFin', e.target.value || undefined)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                />
                                <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Limpiar filtros */}
                        <div className="flex items-end">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onLimpiarFiltros}
                                className="text-gray-500"
                            >
                                Limpiar todo
                            </Button>
                        </div>
                    </div>
                )}
            </Card.Body>
        </Card>
    )
}
