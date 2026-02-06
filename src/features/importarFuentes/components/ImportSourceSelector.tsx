/**
 * Grid de cards para seleccionar fuente de importación
 * Diseño responsivo con animaciones escalonadas
 */

import { memo, useMemo } from 'react'
import { Search, LayoutGrid } from 'lucide-react'
import { ImportSourceCard } from './ImportSourceCard'
import { IMPORT_SOURCES } from '../config/importSources.config'
import type { ImportSourceConfig, ImportSourceId } from '../types/import.types'

interface ImportSourceSelectorProps {
    selectedSourceId: ImportSourceId | null
    onSelectSource: (source: ImportSourceConfig) => void
    searchQuery?: string
    onSearchChange?: (query: string) => void
}

function ImportSourceSelectorComponent({
    selectedSourceId,
    onSelectSource,
    searchQuery = '',
    onSearchChange,
}: ImportSourceSelectorProps) {
    // Filtrar fuentes basado en búsqueda
    const filteredSources = useMemo(() => {
        if (!searchQuery.trim()) {
            return IMPORT_SOURCES
        }
        const query = searchQuery.toLowerCase().trim()
        return IMPORT_SOURCES.filter(
            source =>
                source.name.toLowerCase().includes(query) ||
                source.description.toLowerCase().includes(query)
        )
    }, [searchQuery])

    // Contar activas
    const activeCount = IMPORT_SOURCES.filter(s => s.status === 'active').length
    const totalCount = IMPORT_SOURCES.length

    return (
        <div className="space-y-6">
            {/* Header con buscador */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25">
                        <LayoutGrid size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">
                            Selecciona una fuente
                        </h2>
                        <p className="text-sm text-slate-500">
                            {activeCount} disponibles de {totalCount} fuentes
                        </p>
                    </div>
                </div>

                {/* Search input */}
                {onSearchChange && (
                    <div className="relative">
                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            placeholder="Buscar fuente..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="
                                w-full sm:w-64 pl-10 pr-4 py-2.5
                                bg-slate-50 border border-slate-200 rounded-xl
                                text-sm text-slate-700 placeholder:text-slate-400
                                focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300
                                transition-all duration-200
                            "
                        />
                    </div>
                )}
            </div>

            {/* Grid de cards */}
            {filteredSources.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredSources.map((source, index) => (
                        <div
                            key={source.id}
                            className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                            style={{ animationDelay: `${index * 30}ms` }}
                        >
                            <ImportSourceCard
                                source={source}
                                onSelect={onSelectSource}
                                isSelected={selectedSourceId === source.id}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <Search size={40} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">
                        No se encontraron fuentes
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                        Intenta con otro término de búsqueda
                    </p>
                </div>
            )}
        </div>
    )
}

export const ImportSourceSelector = memo(ImportSourceSelectorComponent)
