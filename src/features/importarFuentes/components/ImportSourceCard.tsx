/**
 * Card visual para seleccionar una fuente de importación
 * Diseño moderno con gradientes y animaciones
 */

import { memo } from 'react'
import { Clock, CheckCircle2, Wrench } from 'lucide-react'
import type { ImportSourceConfig } from '../types/import.types'

interface ImportSourceCardProps {
    source: ImportSourceConfig
    onSelect: (source: ImportSourceConfig) => void
    isSelected?: boolean
}

function ImportSourceCardComponent({ source, onSelect, isSelected }: ImportSourceCardProps) {
    const { icon: Icon, name, description, gradient, status } = source

    const isDisabled = status !== 'active'

    const handleClick = () => {
        if (!isDisabled) {
            onSelect(source)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
            e.preventDefault()
            onSelect(source)
        }
    }

    return (
        <div
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={`
                group relative overflow-hidden rounded-2xl border-2 p-5
                transition-all duration-300 ease-out
                ${isDisabled
                    ? 'cursor-not-allowed opacity-60 border-slate-200 bg-slate-50'
                    : isSelected
                        ? 'cursor-pointer border-indigo-500 bg-indigo-50/50 shadow-lg shadow-indigo-500/20 scale-[1.02]'
                        : 'cursor-pointer border-slate-200 bg-white hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 hover:scale-[1.02] active:scale-[0.98]'
                }
            `}
            aria-disabled={isDisabled}
            aria-selected={isSelected}
        >
            {/* Gradient accent bar */}
            <div
                className={`
                    absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient.from} ${gradient.to}
                    transition-all duration-300
                    ${isDisabled ? 'opacity-30' : 'opacity-100'}
                    ${!isDisabled && !isSelected ? 'group-hover:h-1.5' : ''}
                `}
            />

            {/* Status badge */}
            {status !== 'active' && (
                <div className="absolute top-3 right-3">
                    {status === 'coming-soon' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-amber-100 text-amber-700">
                            <Clock size={10} />
                            Próximamente
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-slate-100 text-slate-600">
                            <Wrench size={10} />
                            Mantenimiento
                        </span>
                    )}
                </div>
            )}

            {/* Selected indicator */}
            {isSelected && (
                <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-indigo-100 text-indigo-700">
                        <CheckCircle2 size={10} />
                        Seleccionado
                    </span>
                </div>
            )}

            <div className="flex items-start gap-4 pt-2">
                {/* Icon container */}
                <div
                    className={`
                        shrink-0 p-3 rounded-xl transition-all duration-300
                        ${gradient.iconBg} ${gradient.iconText}
                        ${!isDisabled && !isSelected ? 'group-hover:scale-110 group-hover:shadow-md' : ''}
                        ${isSelected ? 'scale-110 shadow-md' : ''}
                    `}
                >
                    <Icon size={24} strokeWidth={1.75} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                    <h3
                        className={`
                            font-semibold text-base truncate transition-colors duration-200
                            ${isDisabled ? 'text-slate-400' : isSelected ? 'text-indigo-900' : 'text-slate-800 group-hover:text-slate-900'}
                        `}
                    >
                        {name}
                    </h3>
                    <p
                        className={`
                            text-sm mt-0.5 line-clamp-2 transition-colors duration-200
                            ${isDisabled ? 'text-slate-400' : 'text-slate-500'}
                        `}
                    >
                        {description}
                    </p>
                </div>
            </div>

            {/* Hover glow effect */}
            {!isDisabled && (
                <div
                    className={`
                        absolute inset-0 bg-gradient-to-br ${gradient.from} ${gradient.to}
                        opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300 pointer-events-none
                    `}
                />
            )}
        </div>
    )
}

export const ImportSourceCard = memo(ImportSourceCardComponent)
