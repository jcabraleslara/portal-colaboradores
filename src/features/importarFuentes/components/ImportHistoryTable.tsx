/**
 * Tabla de historial de importaciones
 * Muestra las últimas importaciones con detalles
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/config/supabase.config'
import { FileText, User, Clock, CheckCircle, XCircle, RefreshCw, Tag } from 'lucide-react'
import { getImportSourceById } from '../config/importSources.config'
import type { ImportSourceId } from '../types/import.types'

interface HistoryLog {
    id: string
    fecha_importacion: string
    usuario: string
    archivo_nombre: string
    tipo_fuente?: ImportSourceId
    total_registros: number
    exitosos: number
    fallidos: number
    duplicados: number
    duracion: string
    detalles: Record<string, unknown>
}

export function ImportHistoryTable() {
    const [logs, setLogs] = useState<HistoryLog[]>([])
    const [loading, setLoading] = useState(true)

    const fetchHistory = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('import_history')
            .select('*')
            .order('fecha_importacion', { ascending: false })
            .limit(50)

        if (error) {
            console.error('Error fetching history:', error)
        } else {
            setLogs(data || [])
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchHistory()
    }, [fetchHistory])

    const formatDate = (dateStr: string) => {
        return new Intl.DateTimeFormat('es-CO', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(new Date(dateStr))
    }

    const formatTime = (dateStr: string) => {
        return new Intl.DateTimeFormat('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).format(new Date(dateStr))
    }

    /** Obtiene el nombre de la fuente desde la configuración */
    const getSourceName = (tipoFuente?: ImportSourceId): string => {
        if (!tipoFuente) return 'Citas' // Legacy default
        const source = getImportSourceById(tipoFuente)
        return source?.name || tipoFuente
    }

    /** Obtiene el color del badge según la fuente */
    const getSourceBadgeStyle = (tipoFuente?: ImportSourceId): string => {
        if (!tipoFuente) return 'bg-indigo-50 text-indigo-700 border-indigo-200'

        const source = getImportSourceById(tipoFuente)
        if (!source) return 'bg-slate-50 text-slate-700 border-slate-200'

        // Mapear gradientes a colores de badge
        const colorMap: Record<string, string> = {
            'from-blue-500': 'bg-blue-50 text-blue-700 border-blue-200',
            'from-indigo-500': 'bg-indigo-50 text-indigo-700 border-indigo-200',
            'from-violet-500': 'bg-violet-50 text-violet-700 border-violet-200',
            'from-pink-500': 'bg-pink-50 text-pink-700 border-pink-200',
            'from-emerald-500': 'bg-emerald-50 text-emerald-700 border-emerald-200',
            'from-amber-500': 'bg-amber-50 text-amber-700 border-amber-200',
            'from-cyan-500': 'bg-cyan-50 text-cyan-700 border-cyan-200',
            'from-slate-600': 'bg-slate-100 text-slate-700 border-slate-200',
        }

        return colorMap[source.gradient.from] || 'bg-slate-50 text-slate-700 border-slate-200'
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Historial de Importaciones</h3>
                    <p className="text-sm text-slate-500">Últimos 50 registros de actividad</p>
                </div>
                <button
                    onClick={fetchHistory}
                    disabled={loading}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Actualizar"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Fecha</th>
                                <th className="px-6 py-4 font-semibold">Fuente</th>
                                <th className="px-6 py-4 font-semibold">Archivo</th>
                                <th className="px-6 py-4 font-semibold">Usuario</th>
                                <th className="px-6 py-4 font-semibold text-center">Registros</th>
                                <th className="px-6 py-4 font-semibold text-center">Estado</th>
                                <th className="px-6 py-4 font-semibold text-right">Duración</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && logs.length === 0 ? (
                                // Skeleton loading
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-16 mx-auto" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-16 mx-auto" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-16 ml-auto" /></td>
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                        <p>No hay registros de importación aún.</p>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        {/* Fecha */}
                                        <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900">
                                                    {formatDate(log.fecha_importacion)}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    {formatTime(log.fecha_importacion)}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Tipo de Fuente */}
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getSourceBadgeStyle(log.tipo_fuente)}`}>
                                                <Tag size={12} />
                                                {getSourceName(log.tipo_fuente)}
                                            </span>
                                        </td>

                                        {/* Archivo */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-700">
                                                <FileText size={16} className="text-indigo-400 shrink-0" />
                                                <span className="font-medium truncate max-w-[180px]" title={log.archivo_nombre}>
                                                    {log.archivo_nombre}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Usuario */}
                                        <td className="px-6 py-4 text-slate-500">
                                            <div className="flex items-center gap-2">
                                                <User size={14} />
                                                <span className="truncate max-w-[120px]" title={log.usuario}>
                                                    {log.usuario.split('@')[0]}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Total Registros */}
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                                {log.total_registros.toLocaleString()}
                                            </span>
                                        </td>

                                        {/* Estado (Exitosos/Fallidos) */}
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 items-center">
                                                {log.exitosos > 0 && (
                                                    <span className="flex items-center text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 w-full justify-center">
                                                        <CheckCircle size={10} className="mr-1" />
                                                        {log.exitosos.toLocaleString()}
                                                    </span>
                                                )}
                                                {log.fallidos > 0 && (
                                                    <span className="flex items-center text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 w-full justify-center">
                                                        <XCircle size={10} className="mr-1" />
                                                        {log.fallidos.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Duración */}
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 text-slate-500 text-xs font-mono">
                                                <Clock size={12} />
                                                {log.duracion}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
