/**
 * Badge Toggle para Salud Oral
 * Badge clicable que cambia de estado inactivo (rojo suave) a activo (verde)
 * Tamaños consistentes para evitar disonancia visual
 */

import { Check } from 'lucide-react'

interface ToggleBadgeProps {
    label: string
    active: boolean
    onChange: (active: boolean) => void
    disabled?: boolean
    size?: 'sm' | 'md' | 'lg'
}

export function ToggleBadge({
    label,
    active,
    onChange,
    disabled = false,
    size = 'md',
}: ToggleBadgeProps) {
    const handleClick = () => {
        if (!disabled) {
            onChange(!active)
        }
    }

    const sizeClasses = {
        sm: 'px-2.5 py-1 text-xs gap-1 min-w-[60px]',
        md: 'px-3 py-1.5 text-sm gap-1.5 min-w-[70px]',
        lg: 'px-4 py-2 text-base gap-2 min-w-[80px]',
    }

    const iconSizes = {
        sm: 10,
        md: 12,
        lg: 14,
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            className={`
                inline-flex items-center justify-center rounded-full font-medium
                transition-all duration-200 ease-out whitespace-nowrap
                ${sizeClasses[size]}
                ${disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer hover:scale-105 active:scale-95'
                }
                ${active
                    ? 'bg-green-100 text-green-700 border border-green-300 shadow-sm shadow-green-100'
                    : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 hover:text-slate-600'
                }
            `}
        >
            {active && <Check size={iconSizes[size]} className="flex-shrink-0" />}
            <span>{label}</span>
        </button>
    )
}

export default ToggleBadge
