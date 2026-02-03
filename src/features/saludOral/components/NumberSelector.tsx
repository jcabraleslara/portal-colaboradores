/**
 * Selector Numérico para Salud Oral
 * Componente con input editable y botones +/- para incrementar/decrementar
 */

import { Minus, Plus } from 'lucide-react'

interface NumberSelectorProps {
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
    label?: string
    disabled?: boolean
    size?: 'sm' | 'md'
}

export function NumberSelector({
    value,
    onChange,
    min = 0,
    max = 32,
    label,
    disabled = false,
    size = 'md',
}: NumberSelectorProps) {
    const handleDecrement = () => {
        if (value > min && !disabled) {
            onChange(value - 1)
        }
    }

    const handleIncrement = () => {
        if (value < max && !disabled) {
            onChange(value + 1)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value, 10)
        if (!isNaN(newValue)) {
            const clampedValue = Math.min(max, Math.max(min, newValue))
            onChange(clampedValue)
        } else if (e.target.value === '') {
            onChange(min)
        }
    }

    const handleBlur = () => {
        // Asegurar que el valor esté dentro del rango al perder el foco
        if (value < min) onChange(min)
        if (value > max) onChange(max)
    }

    const sizeClasses = {
        sm: {
            container: 'gap-1',
            button: 'w-6 h-6',
            icon: 12,
            input: 'w-8 h-6 text-xs',
        },
        md: {
            container: 'gap-1.5',
            button: 'w-8 h-8',
            icon: 14,
            input: 'w-10 h-8 text-sm',
        },
    }

    const styles = sizeClasses[size]

    return (
        <div className="flex flex-col items-center">
            {label && (
                <span className="text-xs text-slate-500 mb-1 font-medium">{label}</span>
            )}
            <div className={`flex items-center ${styles.container}`}>
                <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={disabled || value <= min}
                    className={`
                        ${styles.button} rounded-lg flex items-center justify-center
                        transition-all duration-150 border
                        ${disabled || value <= min
                            ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                            : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100 hover:text-red-600 active:scale-95'
                        }
                    `}
                    aria-label="Decrementar"
                >
                    <Minus size={styles.icon} strokeWidth={2.5} />
                </button>

                <input
                    type="number"
                    value={value}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    disabled={disabled}
                    min={min}
                    max={max}
                    className={`
                        ${styles.input} text-center font-bold rounded-lg border
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                        ${disabled
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : value > 0
                                ? 'bg-white text-primary-600 border-primary-300'
                                : 'bg-white text-slate-500 border-slate-300'
                        }
                        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                    `}
                />

                <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={disabled || value >= max}
                    className={`
                        ${styles.button} rounded-lg flex items-center justify-center
                        transition-all duration-150 border
                        ${disabled || value >= max
                            ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                            : 'bg-green-50 text-green-500 border-green-200 hover:bg-green-100 hover:text-green-600 active:scale-95'
                        }
                    `}
                    aria-label="Incrementar"
                >
                    <Plus size={styles.icon} strokeWidth={2.5} />
                </button>
            </div>
        </div>
    )
}

export default NumberSelector
