/**
 * Componente Button reutilizable
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ========================================
// TIPOS
// ========================================

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'accent'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
    size?: ButtonSize
    isLoading?: boolean
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
    fullWidth?: boolean
}

// ========================================
// ESTILOS
// ========================================

const baseStyles = `
  inline-flex items-center justify-center gap-2
  font-medium rounded-lg
  transition-all duration-200 ease-in-out
  focus:outline-none focus:ring-2 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
`

const variantStyles: Record<ButtonVariant, string> = {
    primary: `
    bg-[var(--color-primary)] text-white
    hover:bg-[var(--color-primary-600)]
    focus:ring-[var(--color-primary-500)]
    active:bg-[var(--color-primary-700)]
  `,
    secondary: `
    bg-white dark:bg-black text-[var(--color-text-primary)] dark:text-slate-200
    border border-gray-300 dark:border-white/15
    hover:bg-gray-50 dark:hover:bg-white/5
    focus:ring-gray-300 dark:focus:ring-white/20
    active:bg-gray-100 dark:active:bg-white/10
  `,
    success: `
    bg-[var(--color-success)] text-white
    hover:opacity-90
    focus:ring-[var(--color-success)]
    active:opacity-80
  `,
    danger: `
    bg-[var(--color-error)] text-white
    hover:opacity-90
    focus:ring-[var(--color-error)]
    active:opacity-80
  `,
    accent: `
    gradient-accent text-white
    hover:opacity-90
    hover:shadow-glow-accent
    focus:ring-[var(--color-accent-400)]
    active:opacity-80
    border-none
  `,
    ghost: `
    bg-transparent text-[var(--color-primary)]
    hover:bg-[var(--color-primary-50)] dark:hover:bg-primary-900/30
    focus:ring-[var(--color-primary-500)]
    active:bg-[var(--color-primary-100)] dark:active:bg-primary-900/50
  `,
}

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
}

// ========================================
// COMPONENTE
// ========================================

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = 'primary',
            size = 'md',
            isLoading = false,
            leftIcon,
            rightIcon,
            fullWidth = false,
            className,
            children,
            disabled,
            ...props
        },
        ref
    ) => {
        const classes = twMerge(
            clsx(
                baseStyles,
                variantStyles[variant],
                sizeStyles[size],
                fullWidth && 'w-full',
                className
            )
        )

        return (
            <button
                ref={ref}
                className={classes}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <>
                        <LoadingSpinner size={size} />
                        <span>Cargando...</span>
                    </>
                ) : (
                    <>
                        {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
                        {children}
                        {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
                    </>
                )}
            </button>
        )
    }
)

Button.displayName = 'Button'

// ========================================
// SPINNER INTERNO
// ========================================

function LoadingSpinner({ size }: { size: ButtonSize }) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6',
    }

    return (
        <svg
            className={`animate-spin ${sizeClasses[size]}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
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
    )
}

export default Button
