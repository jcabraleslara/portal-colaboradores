/**
 * Componente LoadingSpinner
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { clsx } from 'clsx'

// ========================================
// TIPOS
// ========================================

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl'
    color?: 'primary' | 'white' | 'gray'
    className?: string
    label?: string
    fullScreen?: boolean
}

// ========================================
// ESTILOS
// ========================================

const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
}

const colorStyles = {
    primary: 'text-[var(--color-primary)]',
    white: 'text-white',
    gray: 'text-gray-400',
}

// ========================================
// COMPONENTE
// ========================================

export function LoadingSpinner({
    size = 'md',
    color = 'primary',
    className,
    label,
    fullScreen = false,
}: LoadingSpinnerProps) {
    const spinner = (
        <div className={clsx('flex flex-col items-center gap-3', className)}>
            <svg
                className={clsx('animate-spin', sizeStyles[size], colorStyles[color])}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                />
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
            </svg>
            {label && (
                <span className={clsx('text-sm', colorStyles[color])}>
                    {label}
                </span>
            )}
        </div>
    )

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                {spinner}
            </div>
        )
    }

    return spinner
}

/**
 * Overlay de carga para secciones
 */
export function LoadingOverlay({
    isLoading,
    children,
    label = 'Cargando...',
}: {
    isLoading: boolean
    children: React.ReactNode
    label?: string
}) {
    return (
        <div className="relative">
            {children}
            {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[2px] rounded-lg">
                    <LoadingSpinner size="lg" label={label} />
                </div>
            )}
        </div>
    )
}

export default LoadingSpinner
