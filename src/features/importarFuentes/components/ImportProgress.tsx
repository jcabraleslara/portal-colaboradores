/**
 * Componente de progreso para importaciones
 * Barra animada con estados y porcentaje
 */

import { memo } from 'react'
import { Loader2 } from 'lucide-react'

interface ImportProgressProps {
    status: string
    percentage: number
    isProcessing: boolean
}

function ImportProgressComponent({ status, percentage, isProcessing }: ImportProgressProps) {
    if (!isProcessing) return null

    // Color dinámico según progreso
    const getProgressColor = () => {
        if (percentage < 30) return 'from-blue-500 to-blue-400'
        if (percentage < 70) return 'from-indigo-500 to-indigo-400'
        if (percentage < 95) return 'from-violet-500 to-violet-400'
        return 'from-emerald-500 to-emerald-400'
    }

    return (
        <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 animate-in fade-in duration-300">
            {/* Status header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-indigo-600" />
                    <span className="text-sm font-medium text-slate-700">
                        {status || 'Iniciando...'}
                    </span>
                </div>
                <span className="text-sm font-bold text-indigo-600 tabular-nums">
                    {percentage}%
                </span>
            </div>

            {/* Progress bar */}
            <div className="relative h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                {/* Animated background */}
                <div className="absolute inset-0 opacity-20">
                    <div
                        className="h-full bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer"
                        style={{ backgroundSize: '200% 100%' }}
                    />
                </div>

                {/* Progress fill */}
                <div
                    className={`
                        h-full bg-gradient-to-r ${getProgressColor()}
                        transition-all duration-500 ease-out
                        shadow-sm relative overflow-hidden
                    `}
                    style={{ width: `${percentage}%` }}
                >
                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shine" />
                </div>
            </div>

            {/* Helper text */}
            <p className="text-xs text-slate-400 text-center">
                Por favor espere, esto puede tomar unos momentos...
            </p>
        </div>
    )
}

export const ImportProgress = memo(ImportProgressComponent)
