/**
 * Componente Alert - Alertas y notificaciones
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useEffect } from 'react'

interface AlertProps {
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
    onClose?: () => void
    autoClose?: boolean
    autoCloseMs?: number
}

const ALERT_STYLES = {
    success: {
        bg: 'bg-green-50 border-green-200',
        text: 'text-green-800',
        icon: '✓'
    },
    error: {
        bg: 'bg-red-50 border-red-200',
        text: 'text-red-800',
        icon: '✕'
    },
    warning: {
        bg: 'bg-amber-50 border-amber-200',
        text: 'text-amber-800',
        icon: '⚠'
    },
    info: {
        bg: 'bg-blue-50 border-blue-200',
        text: 'text-blue-800',
        icon: 'ℹ'
    }
}

export function Alert({
    type,
    message,
    onClose,
    autoClose = true,
    autoCloseMs = 5000
}: AlertProps) {
    const styles = ALERT_STYLES[type]

    useEffect(() => {
        if (autoClose && onClose) {
            const timer = setTimeout(onClose, autoCloseMs)
            return () => clearTimeout(timer)
        }
    }, [autoClose, autoCloseMs, onClose])

    return (
        <div className={`
            flex items-center justify-between
            px-4 py-3 rounded-lg border
            ${styles.bg} ${styles.text}
            animate-fade-in
        `}>
            <div className="flex items-center gap-3">
                <span className="text-lg">{styles.icon}</span>
                <p className="text-sm font-medium">{message}</p>
            </div>

            {onClose && (
                <button
                    onClick={onClose}
                    className="text-current opacity-60 hover:opacity-100 transition-opacity ml-4"
                >
                    ✕
                </button>
            )}
        </div>
    )
}

export default Alert
