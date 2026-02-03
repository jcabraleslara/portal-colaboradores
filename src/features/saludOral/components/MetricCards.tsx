/**
 * Tarjetas de Métricas para Salud Oral
 * Muestra estadísticas del módulo en formato visual
 */

// Componente de tarjetas de métricas

interface MetricCardProps {
    titulo: string
    valor: number | string
    subtitulo?: string
    subtituloColor?: 'green' | 'red' | 'blue' | 'amber'
    icono: React.ReactNode
    color: 'primary' | 'green' | 'amber' | 'blue' | 'purple'
    onClick?: () => void
    isActive?: boolean
}

export function MetricCard({
    titulo,
    valor,
    subtitulo,
    subtituloColor = 'green',
    icono,
    color,
    onClick,
    isActive = false,
}: MetricCardProps) {
    const colorClasses = {
        primary: {
            gradient: 'from-primary-500 to-primary-600',
            active: 'bg-primary-50 border-primary-300 ring-primary-100',
            dot: 'bg-primary-500',
        },
        green: {
            gradient: 'from-green-500 to-green-600',
            active: 'bg-green-50 border-green-300 ring-green-100',
            dot: 'bg-green-500',
        },
        amber: {
            gradient: 'from-amber-500 to-amber-600',
            active: 'bg-amber-50 border-amber-300 ring-amber-100',
            dot: 'bg-amber-500',
        },
        blue: {
            gradient: 'from-blue-500 to-blue-600',
            active: 'bg-blue-50 border-blue-300 ring-blue-100',
            dot: 'bg-blue-500',
        },
        purple: {
            gradient: 'from-purple-500 to-purple-600',
            active: 'bg-purple-50 border-purple-300 ring-purple-100',
            dot: 'bg-purple-500',
        },
    }

    const subtituloClasses = {
        green: 'text-green-600',
        red: 'text-red-600',
        blue: 'text-blue-600',
        amber: 'text-amber-600',
    }

    const currentStyles = colorClasses[color]

    return (
        <div
            onClick={onClick}
            className={`
                rounded-xl border p-4 transition-all shadow-sm
                ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : 'hover:shadow-md'}
                ${isActive
                    ? `${currentStyles.active} shadow-md ring-1`
                    : 'bg-white border-slate-200'
                }
            `}
        >
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 bg-gradient-to-br ${currentStyles.gradient} rounded-lg shadow-sm`}>
                    {icono}
                </div>
                {isActive && (
                    <div className={`w-2 h-2 rounded-full ${currentStyles.dot} animate-pulse shadow-sm`} />
                )}
            </div>
            <h3 className="text-xs font-semibold text-slate-600 mb-0.5 truncate">{titulo}</h3>
            <div className="flex items-baseline gap-1.5">
                <p className="text-2xl font-bold text-slate-900">
                    {typeof valor === 'number' ? valor.toLocaleString() : valor}
                </p>
                {subtitulo && (
                    <p className={`text-xs font-semibold ${subtituloClasses[subtituloColor]}`}>
                        {subtitulo}
                    </p>
                )}
            </div>
        </div>
    )
}

/**
 * Grid de métricas con diseño responsivo
 */
interface MetricGridProps {
    children: React.ReactNode
    columns?: 2 | 3 | 4 | 5
}

export function MetricGrid({ children, columns = 4 }: MetricGridProps) {
    const colClasses = {
        2: 'md:grid-cols-2',
        3: 'md:grid-cols-3',
        4: 'md:grid-cols-4',
        5: 'md:grid-cols-5',
    }

    return (
        <div className={`grid grid-cols-2 ${colClasses[columns]} gap-4`}>
            {children}
        </div>
    )
}

export default MetricCard
