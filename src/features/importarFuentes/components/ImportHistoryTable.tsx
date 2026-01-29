import { useEffect, useState } from 'react'
import { supabase } from '@/config/supabase.config'
import { FileText, User, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

interface HistoryLog {
    id: string
    fecha_importacion: string
    usuario: string
    archivo_nombre: string
    total_registros: number
    exitosos: number
    fallidos: number
    duplicados: number
    duracion: string
    detalles: any
}

export function ImportHistoryTable() {
    const [logs, setLogs] = useState<HistoryLog[]>([])
    const [loading, setLoading] = useState(true)

    const fetchHistory = async () => {
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
    }

    useEffect(() => {
        fetchHistory()
    }, [])

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

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Historial de Importaciones</h3>
                    <p className="text-sm text-slate-500">Últimos 50 registros de actividad</p>
                </div>
                <button
                    onClick={fetchHistory}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Actualizar"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Fecha</th>
                                <th className="px-6 py-4 font-semibold">Archivo</th>
                                <th className="px-6 py-4 font-semibold">Usuario</th>
                                <th className="px-6 py-4 font-semibold text-center">Registros</th>
                                <th className="px-6 py-4 font-semibold text-center">Estado</th>
                                <th className="px-6 py-4 font-semibold text-right">Duración</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && logs.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-32"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-16 mx-auto"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-16 mx-auto"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-16 ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        <p>No hay registros de importación aún.</p>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
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
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-700">
                                                <FileText size={16} className="text-indigo-400" />
                                                <span className="font-medium truncate max-w-[200px]" title={log.archivo_nombre}>
                                                    {log.archivo_nombre}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                            <div className="flex items-center gap-2">
                                                <User size={14} />
                                                <span className="truncate max-w-[150px]" title={log.usuario}>
                                                    {log.usuario.split('@')[0]}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                                {log.total_registros.toLocaleString()}
                                            </span>
                                        </td>
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
