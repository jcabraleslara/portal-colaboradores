/**
 * Componente de Selección de Rutas (Grid Visual)
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Permite seleccionar una ruta de forma visual para el tipo de solicitud
 * "Activación de Ruta" con lógica de visibilidad por rol.
 */

import { useMemo } from 'react'
import * as Icons from 'lucide-react'
import { RutaBack, RUTA_COLORES, obtenerRutasVisibles } from '@/types/back.types'

interface RutaSelectionGridProps {
    esExterno: boolean
    rutaSeleccionada: RutaBack | null
    onSeleccionarRuta: (ruta: RutaBack) => void
}

export function RutaSelectionGrid({ esExterno, rutaSeleccionada, onSeleccionarRuta }: RutaSelectionGridProps) {
    // Filtrar rutas según rol
    const rutasVisibles = useMemo(() => obtenerRutasVisibles(esExterno), [esExterno])

    // Agrupar por categoría
    const rutasPorCategoria = useMemo(() => {
        const categorias: Record<string, typeof rutasVisibles> = {}
        rutasVisibles.forEach(config => {
            if (!categorias[config.categoria]) {
                categorias[config.categoria] = []
            }
            categorias[config.categoria].push(config)
        })
        return categorias
    }, [rutasVisibles])

    return (
        <div className="space-y-5">
            {Object.entries(rutasPorCategoria).map(([categoria, configs]) => (
                <div key={categoria}>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">{categoria}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {configs.map(config => {
                            const label = esExterno ? config.labelExterno : config.labelInterno
                            const colores = RUTA_COLORES[config.ruta] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
                            const activo = rutaSeleccionada === config.ruta

                            // Obtener icono dinámicamente
                            const IconComponent = (Icons as any)[config.icono] || Icons.Circle

                            return (
                                <button
                                    key={config.ruta}
                                    type="button"
                                    onClick={() => onSeleccionarRuta(config.ruta)}
                                    className={`
                                        relative group p-3 rounded-xl border transition-all duration-200
                                        hover:shadow-md hover:border-[var(--color-primary-300)]
                                        flex flex-row items-center text-left gap-3 h-full
                                        ${activo
                                            ? `${colores.bg} ${colores.border} border-2 shadow-sm`
                                            : 'bg-white border-gray-100'
                                        }
                                    `}
                                >
                                    <div className={`
                                        w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105
                                        ${activo ? 'bg-white/50' : colores.bg}
                                    `}>
                                        <IconComponent size={20} className={colores.text} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-bold leading-tight ${activo ? 'text-gray-900' : 'text-gray-700 group-hover:text-gray-900'}`}>
                                            {label}
                                        </p>
                                    </div>

                                    {activo && (
                                        <div className="absolute top-2 right-2">
                                            <Icons.CheckCircle2 size={16} className={colores.text} />
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}
