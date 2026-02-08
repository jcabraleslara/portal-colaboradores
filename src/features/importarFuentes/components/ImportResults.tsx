/**
 * Componente para mostrar resultados de importación
 * Cards con estadísticas y opciones de descarga
 */

import { memo } from 'react'
import {
    CheckCircle2,
    AlertCircle,
    FileSpreadsheet,
    Download,
    RotateCcw,
    Clock,
    TrendingUp,
} from 'lucide-react'
import type { ImportResult } from '../types/import.types'

interface ImportResultsProps {
    result: ImportResult
    sourceName: string
    onReset: () => void
}

function ImportResultsComponent({ result, sourceName, onReset }: ImportResultsProps) {
    const hasErrors = result.errors > 0
    const successRate = result.totalProcessed > 0
        ? ((result.success / result.totalProcessed) * 100).toFixed(1)
        : '0'

    // Descargar reporte (errores o informativo)
    const handleDownloadReport = (content: string, prefix: string) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `${prefix}_${sourceName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    return (
        <div
            className={`
                p-6 rounded-2xl border animate-in fade-in zoom-in-95 duration-500
                ${hasErrors
                    ? 'bg-gradient-to-br from-orange-50 to-amber-50/50 border-orange-100'
                    : 'bg-gradient-to-br from-emerald-50 to-teal-50/50 border-emerald-100'
                }
            `}
        >
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                    <div
                        className={`
                            p-3 rounded-xl shrink-0 shadow-sm
                            ${hasErrors
                                ? 'bg-orange-100 text-orange-600'
                                : 'bg-emerald-100 text-emerald-600'
                            }
                        `}
                    >
                        {hasErrors ? <AlertCircle size={28} /> : <CheckCircle2 size={28} />}
                    </div>

                    <div className="flex-1">
                        <h4
                            className={`
                                text-xl font-bold
                                ${hasErrors ? 'text-orange-900' : 'text-emerald-900'}
                            `}
                        >
                            {hasErrors ? 'Importación con observaciones' : '¡Importación exitosa!'}
                        </h4>
                        <p className="text-sm text-slate-600 mt-1">
                            Fuente: <span className="font-medium">{sourceName}</span>
                        </p>

                        {/* Mini progress bar */}
                        <div className="flex items-center gap-3 mt-3">
                            <div className="flex-1 h-2 max-w-48 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${hasErrors ? 'bg-orange-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${successRate}%` }}
                                />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <TrendingUp size={14} className={hasErrors ? 'text-orange-600' : 'text-emerald-600'} />
                                <span className="text-sm font-bold text-slate-700">
                                    {successRate}% efectividad
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 ml-2 px-2.5 py-1 bg-white/60 rounded-lg">
                                <Clock size={12} className="text-slate-400" />
                                <span className="text-xs font-mono text-slate-500">
                                    {result.duration}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Registros"
                        value={result.totalProcessed}
                        variant="default"
                    />
                    <StatCard
                        label="Duplicados"
                        value={result.duplicates}
                        sublabel="Omitidos del archivo"
                        variant="info"
                        icon={FileSpreadsheet}
                    />
                    <StatCard
                        label="Importados"
                        value={result.success}
                        variant="success"
                    />
                    <StatCard
                        label="Fallidos"
                        value={result.errors}
                        variant={result.errors > 0 ? 'error' : 'default'}
                    />
                </div>

                {/* Error report download */}
                {result.errorReport && (
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                            <h5 className="text-sm font-bold text-rose-800">
                                Se detectaron inconsistencias
                            </h5>
                            <p className="text-xs text-rose-600 mt-0.5">
                                {result.errorMessage || 'Algunos registros no pudieron procesarse correctamente.'}
                            </p>
                        </div>
                        <button
                            onClick={() => handleDownloadReport(result.errorReport!, 'reporte_errores')}
                            className="
                                inline-flex items-center gap-2 px-4 py-2
                                bg-white border border-rose-200 text-rose-700
                                text-xs font-bold rounded-lg shadow-sm
                                hover:bg-rose-50 active:scale-95
                                transition-all duration-200
                            "
                        >
                            <Download size={14} />
                            Descargar Reporte CSV
                        </button>
                    </div>
                )}

                {/* Info report download */}
                {result.infoReport && (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                            <h5 className="text-sm font-bold text-slate-700">
                                Log de importacion disponible
                            </h5>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Resumen detallado del proceso de sincronizacion
                            </p>
                        </div>
                        <button
                            onClick={() => handleDownloadReport(result.infoReport!, 'log_importacion')}
                            className="
                                inline-flex items-center gap-2 px-4 py-2
                                bg-white border border-slate-200 text-slate-700
                                text-xs font-bold rounded-lg shadow-sm
                                hover:bg-slate-50 active:scale-95
                                transition-all duration-200
                            "
                        >
                            <Download size={14} />
                            Descargar Log CSV
                        </button>
                    </div>
                )}

                {/* Generic error message */}
                {hasErrors && !result.errorReport && (
                    <p className="text-sm text-orange-700 bg-orange-100/50 p-3 rounded-lg flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span>
                            Algunos registros no pudieron guardarse.
                            Revisa la consola (F12) para detalles técnicos.
                        </span>
                    </p>
                )}

                {/* Reset button */}
                <div className="flex justify-center pt-2">
                    <button
                        onClick={onReset}
                        className="
                            inline-flex items-center gap-2 text-sm font-medium
                            text-slate-600 hover:text-indigo-600
                            transition-colors duration-200
                        "
                    >
                        <RotateCcw size={14} />
                        Importar otro archivo
                    </button>
                </div>
            </div>
        </div>
    )
}

/** Componente interno para las cards de estadísticas */
interface StatCardProps {
    label: string
    value: number
    sublabel?: string
    variant: 'default' | 'info' | 'success' | 'error'
    icon?: React.ElementType
}

function StatCard({ label, value, sublabel, variant, icon: Icon }: StatCardProps) {
    const variantStyles = {
        default: 'text-slate-500',
        info: 'text-indigo-600',
        success: 'text-emerald-600',
        error: 'text-orange-600',
    }

    const valueStyles = {
        default: 'text-slate-800',
        info: 'text-indigo-700',
        success: 'text-emerald-700',
        error: value > 0 ? 'text-orange-600' : 'text-slate-400',
    }

    return (
        <div className="relative bg-white/60 p-4 rounded-xl border border-black/5 shadow-sm overflow-hidden">
            {Icon && (
                <div className="absolute -right-2 -top-2 text-indigo-100/30">
                    <Icon size={56} />
                </div>
            )}
            <p className={`text-xs uppercase tracking-wider font-semibold mb-1 ${variantStyles[variant]}`}>
                {label}
            </p>
            <p className={`text-2xl font-bold ${valueStyles[variant]}`}>
                {value.toLocaleString()}
            </p>
            {sublabel && (
                <p className="text-[10px] text-slate-400 mt-0.5">{sublabel}</p>
            )}
        </div>
    )
}

export const ImportResults = memo(ImportResultsComponent)
