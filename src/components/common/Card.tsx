/**
 * Componente Card reutilizable
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { ReactNode } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ========================================
// TIPOS
// ========================================

interface CardProps {
    children: ReactNode
    className?: string
    padding?: 'none' | 'sm' | 'md' | 'lg'
    shadow?: 'none' | 'sm' | 'md' | 'lg'
    hover?: boolean
    onClick?: () => void
}

interface CardHeaderProps {
    children: ReactNode
    className?: string
    action?: ReactNode
}

interface CardBodyProps {
    children: ReactNode
    className?: string
}

interface CardFooterProps {
    children: ReactNode
    className?: string
}

// ========================================
// ESTILOS
// ========================================

const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
}

const shadowStyles = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
}

// ========================================
// COMPONENTES
// ========================================

export function Card({
    children,
    className,
    padding = 'md',
    shadow = 'sm',
    hover = false,
    onClick,
}: CardProps) {
    const classes = twMerge(
        clsx(
            'bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-white/10 transition-colors',
            paddingStyles[padding],
            shadowStyles[shadow],
            hover && 'transition-shadow hover:shadow-md cursor-pointer',
            onClick && 'cursor-pointer'
        ),
        className
    )

    return (
        <div className={classes} onClick={onClick} role={onClick ? 'button' : undefined}>
            {children}
        </div>
    )
}

export function CardHeader({ children, className, action }: CardHeaderProps) {
    return (
        <div className={twMerge('flex items-center justify-between mb-4', className)}>
            <div className="font-semibold text-lg text-[var(--color-text-primary)] dark:text-slate-100">
                {children}
            </div>
            {action && <div>{action}</div>}
        </div>
    )
}

export function CardBody({ children, className }: CardBodyProps) {
    return (
        <div className={twMerge('text-[var(--color-text-secondary)] dark:text-slate-300', className)}>
            {children}
        </div>
    )
}

export function CardFooter({ children, className }: CardFooterProps) {
    return (
        <div
            className={twMerge(
                'mt-4 pt-4 border-t border-gray-100 dark:border-white/10 flex items-center gap-3',
                className
            )}
        >
            {children}
        </div>
    )
}

// Export compuesto
Card.Header = CardHeader
Card.Body = CardBody
Card.Footer = CardFooter

export default Card
