/**
 * Error Boundary - Resiliencia de la aplicación
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * Captura errores de renderizado y muestra una UI de fallback
 * en lugar de una pantalla blanca.
 *
 * Variantes:
 * - "full": Pantalla completa (app-level, envuelve todo)
 * - "section": Card dentro del layout (page-level, mantiene Header/Sidebar)
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { criticalErrorService } from '@/services/criticalError.service'

interface ErrorBoundaryProps {
    children: ReactNode
    /** "full" para app-level, "section" para page-level */
    variant?: 'full' | 'section'
    /** Nombre del feature/módulo para el reporte de errores */
    featureName?: string
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Fire-and-forget: reportar error crítico
        criticalErrorService.reportCriticalError({
            category: 'UNKNOWN',
            errorMessage: error.message,
            feature: this.props.featureName || 'ErrorBoundary',
            severity: 'HIGH',
            error,
            metadata: {
                componentStack: errorInfo.componentStack,
                variant: this.props.variant || 'section',
            },
        }).catch(() => {
            // Silenciar errores del servicio de reportes
        })
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null })
    }

    private handleReload = () => {
        window.location.reload()
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children
        }

        const variant = this.props.variant || 'section'

        if (variant === 'full') {
            return <FullScreenFallback onRetry={this.handleRetry} onReload={this.handleReload} />
        }

        return <SectionFallback onRetry={this.handleRetry} />
    }
}

// ========================================
// Fallback UIs
// ========================================

function FullScreenFallback({ onRetry, onReload }: { onRetry: () => void; onReload: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm">
            <div className="text-center max-w-md px-6">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Algo salió mal
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Ocurrió un error inesperado en la aplicación. Intenta de nuevo o recarga la página.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={onRetry}
                        className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                    >
                        Reintentar
                    </button>
                    <button
                        onClick={onReload}
                        className="px-6 py-2.5 border border-gray-300 dark:border-white/15 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                        Recargar la página
                    </button>
                </div>
            </div>
        </div>
    )
}

function SectionFallback({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
            <div className="bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-white/10 p-8 max-w-md w-full text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Error al cargar el módulo
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                    Ocurrió un error inesperado. Puedes reintentar o volver al dashboard.
                </p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={onRetry}
                        className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                    >
                        Reintentar
                    </button>
                    <a
                        href="/dashboard"
                        className="px-6 py-2.5 text-[var(--color-primary)] hover:underline text-sm font-medium"
                    >
                        Volver al Dashboard
                    </a>
                </div>
            </div>
        </div>
    )
}
