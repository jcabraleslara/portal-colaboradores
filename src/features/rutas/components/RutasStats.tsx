import { X, Route, AlertCircle } from 'lucide-react'
import {
    ESTADO_COLORES,
    RUTA_COLORES,
    EstadoRadicado,
    ESTADOS_RADICADO_LISTA
} from '@/types/back.types'

interface RutasStatsProps {
    conteos: {
        porEstado: Record<string, number>
        porRuta: Record<string, number>
    } | null
    loading: boolean
    filtroEstado: string | undefined
    filtroRuta: string | undefined
    onFiltroEstado: (estado: EstadoRadicado | 'Todos') => void
    onFiltroRuta: (ruta: string | null) => void
}

export function RutasStats({
    conteos,
    loading,
    filtroEstado,
    filtroRuta,
    onFiltroEstado,
    onFiltroRuta
}: RutasStatsProps) {

    // Estados que queremos destacar en los contadores superiores
    const ESTADOS_DESTACADOS = ESTADOS_RADICADO_LISTA.filter(e => e !== 'Todos') as EstadoRadicado[]

    return (
        <div className="space-y-6">
            {/* 1. Por Estado (Solo los principales para no saturar) */}
            <div>
                <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                    <AlertCircle size={16} />
                    Estado de Solicitudes
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                        ))
                    ) : (
                        ESTADOS_DESTACADOS.map(estado => {
                            const cantidad = conteos?.porEstado[estado] || 0
                            const colores = ESTADO_COLORES[estado]
                            const activo = filtroEstado === estado

                            return (
                                <button
                                    key={estado}
                                    onClick={() => onFiltroEstado(activo ? 'Todos' : estado)}
                                    className={`
                                        relative p-4 rounded-xl border-2 transition-all duration-300
                                        hover:shadow-lg hover:-translate-y-0.5 flex flex-col items-center text-center
                                        ${activo
                                            ? `${colores.bg} ${colores.border} shadow-md ring-2 ring-offset-2 ring-${colores.border.replace('border-', '')}`
                                            : 'bg-white border-gray-100 hover:border-gray-200'
                                        }
                                    `}
                                >
                                    <div className="flex items-center justify-center gap-3 mb-2">
                                        <p className={`text-3xl font-bold ${activo ? colores.text : 'text-gray-800'}`}>
                                            {cantidad}
                                        </p>
                                    </div>
                                    <p className="text-sm text-gray-600 font-medium leading-snug">
                                        {estado}
                                    </p>
                                    {activo && (
                                        <div className="absolute top-2 right-2">
                                            <X size={14} className={colores.text} />
                                        </div>
                                    )}
                                </button>
                            )
                        })
                    )}
                </div>
            </div>

            {/* 2. Por Ruta */}
            <div>
                <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                    <Route size={16} />
                    Pendientes por Ruta
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                        ))
                    ) : (
                        conteos?.porRuta && Object.entries(conteos.porRuta).length > 0 ? (
                            Object.entries(conteos.porRuta)
                                .sort(([, a], [, b]) => b - a) // Ordenar mayor a menor
                                .map(([ruta, cantidad]) => {
                                    const colores = RUTA_COLORES[ruta] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
                                    const activo = filtroRuta === ruta

                                    return (
                                        <button
                                            key={ruta}
                                            onClick={() => onFiltroRuta(activo ? null : ruta)}
                                            className={`
                                                relative p-4 rounded-xl border-2 transition-all duration-300
                                                hover:shadow-md hover:-translate-y-0.5 flex flex-col items-center text-center
                                                ${activo
                                                    ? `${colores.bg} ${colores.border} shadow-md`
                                                    : 'bg-white border-gray-100 hover:border-gray-200'
                                                }
                                            `}
                                        >
                                            <div className="flex items-center justify-center gap-3 mb-2">
                                                <div className={`w-8 h-8 rounded-lg ${colores.bg} flex items-center justify-center flex-shrink-0 bg-opacity-50`}>
                                                    <Route size={18} className={colores.text} />
                                                </div>
                                                <p className={`text-2xl font-bold ${activo ? colores.text : 'text-gray-800'}`}>
                                                    {cantidad}
                                                </p>
                                            </div>
                                            <p className="text-xs text-gray-600 font-medium leading-tight truncate w-full" title={ruta}>
                                                {ruta}
                                            </p>
                                            {activo && (
                                                <div className="absolute top-2 right-2">
                                                    <X size={12} className={colores.text} />
                                                </div>
                                            )}
                                        </button>
                                    )
                                })
                        ) : (
                            <div className="col-span-full p-4 text-center text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                No hay rutas pendientes
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    )
}
