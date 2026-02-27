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

// Mapeo de estilos por categoría
const CATEGORY_STYLES: Record<string, { bg: string, border: string, title: string, icon: any }> = {
    'Maternidad': {
        bg: 'bg-rose-50/80 dark:bg-rose-950/40',
        border: 'border-rose-100 dark:border-rose-800/50',
        title: 'text-rose-700 dark:text-rose-400',
        icon: Icons.Baby
    },
    'Crónicas': {
        bg: 'bg-orange-50/80 dark:bg-orange-950/40',
        border: 'border-orange-100 dark:border-orange-800/50',
        title: 'text-orange-700 dark:text-orange-400',
        icon: Icons.HeartPulse
    },
    'Oncología': {
        bg: 'bg-fuchsia-50/80 dark:bg-fuchsia-950/40',
        border: 'border-fuchsia-100 dark:border-fuchsia-800/50',
        title: 'text-fuchsia-700 dark:text-fuchsia-400',
        icon: Icons.Activity
    },
    'Otros': {
        bg: 'bg-slate-50/80 dark:bg-slate-900/60',
        border: 'border-slate-100 dark:border-slate-700/50',
        title: 'text-slate-600 dark:text-slate-400',
        icon: Icons.LayoutGrid
    }
}

// Orden de las categorías
const CATEGORY_ORDER = ['Crónicas', 'Oncología', 'Maternidad', 'Otros']

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

    // Obtener las categorías que tienen items, ordenadas
    const sortedCategories = useMemo(() => {
        const availableCategories = Object.keys(rutasPorCategoria)
        return CATEGORY_ORDER.filter(cat => availableCategories.includes(cat))
            // Agregar cualquier categoría extra que no esté en el orden definido (por si acaso)
            .concat(availableCategories.filter(cat => !CATEGORY_ORDER.includes(cat)))
    }, [rutasPorCategoria])

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {sortedCategories.map((categoria) => {
                const configs = rutasPorCategoria[categoria]
                const style = CATEGORY_STYLES[categoria] || {
                    bg: 'bg-gray-50 dark:bg-gray-900/60',
                    border: 'border-gray-100 dark:border-gray-700/50',
                    title: 'text-gray-600 dark:text-gray-400',
                    icon: Icons.Circle
                }
                const CatIcon = style.icon

                return (
                    <div
                        key={categoria}
                        className={`p-5 rounded-3xl border ${style.bg} ${style.border} transition-all duration-300 hover:shadow-sm`}
                    >
                        <div className="flex items-center gap-2.5 mb-4 px-1">
                            <div className={`p-1.5 rounded-lg bg-white/60 dark:bg-white/10 ${style.title}`}>
                                <CatIcon size={18} />
                            </div>
                            <h3 className={`text-sm font-bold uppercase tracking-wide ${style.title}`}>
                                {categoria}
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {configs.map(config => {
                                const label = esExterno ? config.labelExterno : config.labelInterno
                                const colores = RUTA_COLORES[config.ruta] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
                                const activo = rutaSeleccionada === config.ruta
                                const IconComponent = (Icons as any)[config.icono] || Icons.Circle

                                return (
                                    <button
                                        key={config.ruta}
                                        type="button"
                                        onClick={() => onSeleccionarRuta(config.ruta)}
                                        className={`
                                            relative group p-3 rounded-xl border transition-all duration-200
                                            flex flex-row items-center text-left gap-3 w-full
                                            ${activo
                                                ? `bg-white dark:bg-white/10 border-2 ${colores.border} shadow-sm ring-2 ring-offset-0 ring-offset-transparent ring-${colores.text.split('-')[1]}-100`
                                                : 'bg-white/80 dark:bg-white/5 border-transparent hover:border-[var(--color-primary-200)] hover:bg-white dark:hover:bg-white/10 hover:shadow-sm'
                                            }
                                        `}
                                    >
                                        <div className={`
                                            w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105
                                            ${activo ? colores.bg : 'bg-gray-100 dark:bg-white/10 group-hover:bg-[var(--color-primary-50)] dark:group-hover:bg-primary-900/30'}
                                        `}>
                                            <IconComponent
                                                size={18}
                                                className={activo ? colores.text : 'text-gray-500 dark:text-slate-400 group-hover:text-[var(--color-primary)]'}
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-bold leading-tight ${activo ? 'text-gray-900 dark:text-slate-100' : 'text-gray-600 dark:text-slate-300 group-hover:text-gray-800 dark:group-hover:text-white'}`}>
                                                {label}
                                            </p>
                                        </div>

                                        {activo && (
                                            <div className="absolute top-2 right-2">
                                                <Icons.CheckCircle2 size={14} className={colores.text} />
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
