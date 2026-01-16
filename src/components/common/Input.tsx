/**
 * Componente Input reutilizable
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { InputHTMLAttributes, forwardRef, useState } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Eye, EyeOff } from 'lucide-react'

// ========================================
// TIPOS
// ========================================

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string
    error?: string
    helperText?: string
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
    size?: 'sm' | 'md' | 'lg'
    fullWidth?: boolean
}

// ========================================
// ESTILOS
// ========================================

const baseInputStyles = `
  w-full rounded-lg border
  transition-all duration-200
  focus:outline-none focus:ring-2 focus:ring-offset-0
  disabled:bg-gray-100 disabled:cursor-not-allowed
  placeholder:text-gray-400
`

const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-5 py-3 text-lg',
}

const stateStyles = {
    default: `
    border-gray-300 bg-white
    focus:border-[var(--color-primary)] focus:ring-[var(--color-primary-100)]
  `,
    error: `
    border-[var(--color-error)] bg-red-50
    focus:border-[var(--color-error)] focus:ring-red-100
  `,
}

// ========================================
// COMPONENTE
// ========================================

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            label,
            error,
            helperText,
            leftIcon,
            rightIcon,
            size = 'md',
            fullWidth = true,
            type = 'text',
            className,
            id,
            ...props
        },
        ref
    ) => {
        const [showPassword, setShowPassword] = useState(false)
        const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
        const isPassword = type === 'password'
        const actualType = isPassword && showPassword ? 'text' : type

        const inputClasses = twMerge(
            clsx(
                baseInputStyles,
                sizeStyles[size],
                error ? stateStyles.error : stateStyles.default,
                leftIcon && 'pl-10',
                (rightIcon || isPassword) && 'pr-10',
                className
            )
        )

        return (
            <div className={clsx('flex flex-col gap-1', fullWidth && 'w-full')}>
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-sm font-medium text-[var(--color-text-primary)]"
                    >
                        {label}
                        {props.required && <span className="text-[var(--color-error)] ml-1">*</span>}
                    </label>
                )}

                <div className="relative">
                    {leftIcon && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            {leftIcon}
                        </span>
                    )}

                    <input
                        ref={ref}
                        id={inputId}
                        type={actualType}
                        className={inputClasses}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
                        {...props}
                    />

                    {isPassword && (
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    )}

                    {rightIcon && !isPassword && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                            {rightIcon}
                        </span>
                    )}
                </div>

                {error && (
                    <p id={`${inputId}-error`} className="text-sm text-[var(--color-error)]">
                        {error}
                    </p>
                )}

                {helperText && !error && (
                    <p id={`${inputId}-helper`} className="text-sm text-gray-500">
                        {helperText}
                    </p>
                )}
            </div>
        )
    }
)

Input.displayName = 'Input'

export default Input
