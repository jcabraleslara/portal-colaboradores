/**
 * Componente QuickAccessCard - Card premium para accesos rápidos
 */

import { Link } from 'react-router-dom'
import { ArrowRight, LucideIcon } from 'lucide-react'

interface QuickAccessCardProps {
    title: string
    description: string
    path: string
    icon: LucideIcon
    colorScheme: 'primary' | 'accent' | 'success' | 'warning'
}

const colorConfig = {
    primary: {
        bgDecoration: 'bg-primary-50',
        gradient: 'gradient-primary',
        shadow: 'shadow-primary-500/30',
        textHover: 'group-hover:text-primary-600',
        link: 'text-primary-500'
    },
    accent: {
        bgDecoration: 'bg-accent-50',
        gradient: 'gradient-accent',
        shadow: 'shadow-accent-500/30',
        textHover: 'group-hover:text-accent-600',
        link: 'text-accent-500'
    },
    success: {
        bgDecoration: 'bg-success-50',
        gradient: 'bg-gradient-to-br from-success-500 to-success-600',
        shadow: 'shadow-success-500/30',
        textHover: 'group-hover:text-success-600',
        link: 'text-success-500'
    },
    warning: {
        bgDecoration: 'bg-warning-50',
        gradient: 'bg-gradient-to-br from-warning-500 to-warning-600',
        shadow: 'shadow-warning-500/30',
        textHover: 'group-hover:text-warning-600',
        link: 'text-warning-500'
    }
}

export function QuickAccessCard({
    title,
    description,
    path,
    icon: Icon,
    colorScheme
}: QuickAccessCardProps) {
    const colors = colorConfig[colorScheme]

    return (
        <Link to={path} className="group h-full">
            <div className={`
                relative overflow-hidden bg-white rounded-2xl p-6 
                border border-slate-100 shadow-sm 
                hover:shadow-xl hover:${colors.shadow.replace('shadow-', 'shadow-')}/10 
                transition-all duration-300 hover:-translate-y-1 h-full
            `}>
                {/* Decoración */}
                <div className={`
                    absolute top-0 right-0 w-32 h-32 ${colors.bgDecoration} 
                    rounded-full -translate-y-1/2 translate-x-1/2 
                    group-hover:scale-150 transition-transform duration-500
                `} />

                <div className="relative z-10 flex items-start gap-4">
                    <div className={`
                        w-14 h-14 rounded-2xl ${colors.gradient} 
                        flex items-center justify-center 
                        shadow-lg ${colors.shadow}
                        group-hover:scale-110 transition-transform duration-300
                    `}>
                        <Icon size={26} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className={`
                            font-bold text-lg text-slate-800 mb-1 
                            ${colors.textHover} transition-colors
                        `}>
                            {title}
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">
                            {description}
                        </p>
                        <span className={`
                            inline-flex items-center gap-2 text-sm font-semibold 
                            ${colors.link} group-hover:gap-3 transition-all
                        `}>
                            Ir al módulo
                            <ArrowRight size={16} />
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    )
}
