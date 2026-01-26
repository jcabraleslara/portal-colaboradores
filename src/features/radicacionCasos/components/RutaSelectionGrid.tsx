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
        <div className="space-y-6">
            {Object.entries(rutasPorCategoria).map(([categoria, configs]) => (
                <div key={categoria}>
                    <h3 className="text-sm font-semibold text-gray-600 mb-3">{categoria}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
                                        relative p-4 rounded-xl border-2 transition-all duration-300
                                        hover:shadow-lg hover:-translate-y-0.5 
                                        flex flex-col items-center text-center gap-2
                                        ${activo
                                            ? `${colores.bg} ${colores.border} shadow-md ring-2 ring-offset-2`
                                            : 'bg-white border-gray-200 hover:border-gray-300'
                                        }
                                    `}
                                >
                                    <div className={`w-12 h-12 rounded-lg ${colores.bg} flex items-center justify-center`}>
                                        <IconComponent size={24} className={colores.text} />
                                    </div>
                                    <p className={`text-sm font-medium leading-tight ${activo ? colores.text : 'text-gray-700'}`}>
                                        {label}
                                    </p>
                                    {activo && (
                                        <div className="absolute top-2 right-2">
                                            <Icons.Check size={16} className={colores.text} />
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
