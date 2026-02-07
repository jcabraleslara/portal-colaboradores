/**
 * Hook para detectar inactividad del usuario y cerrar sesión automáticamente
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Monitorea eventos de interacción del usuario y cierra sesión
 * después del tiempo definido en SECURITY.SESSION_TIMEOUT_MS
 */

import { useEffect, useCallback, useRef } from 'react'
import { SECURITY } from '@/config/constants'
import { useAuth } from '@/context/AuthContext'

// Eventos que reinician el temporizador de inactividad
const ACTIVITY_EVENTS = [
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click',
    'focus',
] as const

interface UseInactivityTimeoutOptions {
    /** Si está habilitado el timeout (útil para desactivar en desarrollo) */
    enabled?: boolean
    /** Callback opcional antes de cerrar sesión */
    onBeforeLogout?: () => void
    /** Tiempo de advertencia antes del logout (ms) - muestra alerta */
    warningTimeMs?: number
}

/**
 * Hook que cierra sesión automáticamente tras inactividad
 * 
 * @example
 * // Uso básico
 * useInactivityTimeout()
 * 
 * // Con advertencia 2 minutos antes
 * useInactivityTimeout({ warningTimeMs: 120000 })
 */
export function useInactivityTimeout(options: UseInactivityTimeoutOptions = {}) {
    const {
        enabled = true,
        onBeforeLogout,
        warningTimeMs = 60000, // 1 minuto de advertencia por defecto
    } = options

    const { logout, isAuthenticated } = useAuth()
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isWarningShownRef = useRef(false)

    /**
     * Limpiar todos los temporizadores
     */
    const clearTimers = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }
        if (warningTimeoutRef.current) {
            clearTimeout(warningTimeoutRef.current)
            warningTimeoutRef.current = null
        }
        isWarningShownRef.current = false
    }, [])

    /**
     * Mostrar advertencia de cierre de sesión inminente
     */
    const showWarning = useCallback(() => {
        if (isWarningShownRef.current) return
        isWarningShownRef.current = true

        // Usar alert nativo por simplicidad - se puede mejorar con un modal
        const minutesLeft = Math.ceil(warningTimeMs / 60000)
        console.warn(`⚠️ Sesión expirará en ${minutesLeft} minuto(s) por inactividad`)
        
        // En producción, mostrar toast o modal
        // Por ahora usamos el DOM directamente para no depender de librerías
        const existingWarning = document.getElementById('inactivity-warning')
        if (existingWarning) existingWarning.remove()

        const warningDiv = document.createElement('div')
        warningDiv.id = 'inactivity-warning'
        warningDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: system-ui, sans-serif;
            animation: slideIn 0.3s ease-out;
        `
        warningDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">⏰</span>
                <div>
                    <strong style="display: block; margin-bottom: 4px;">Sesión por expirar</strong>
                    <span style="font-size: 14px; opacity: 0.9;">Tu sesión se cerrará en ${minutesLeft} minuto(s) por inactividad</span>
                </div>
            </div>
        `
        document.body.appendChild(warningDiv)

        // Agregar estilos de animación si no existen
        if (!document.getElementById('inactivity-styles')) {
            const style = document.createElement('style')
            style.id = 'inactivity-styles'
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `
            document.head.appendChild(style)
        }
    }, [warningTimeMs])

    /**
     * Ocultar advertencia
     */
    const hideWarning = useCallback(() => {
        const existingWarning = document.getElementById('inactivity-warning')
        if (existingWarning) existingWarning.remove()
        isWarningShownRef.current = false
    }, [])

    /**
     * Cerrar sesión por inactividad
     */
    const handleInactivityLogout = useCallback(async () => {
        console.info('🔒 Cerrando sesión por inactividad')
        hideWarning()
        onBeforeLogout?.()
        await logout()
    }, [logout, onBeforeLogout, hideWarning])

    /**
     * Reiniciar el temporizador de inactividad
     */
    const resetTimer = useCallback(() => {
        if (!enabled || !isAuthenticated) return

        // Ocultar advertencia si el usuario interactúa
        hideWarning()
        clearTimers()

        const timeoutDuration = SECURITY.SESSION_TIMEOUT_MS

        // Advertencia antes del logout
        if (warningTimeMs > 0 && warningTimeMs < timeoutDuration) {
            warningTimeoutRef.current = setTimeout(showWarning, timeoutDuration - warningTimeMs)
        }

        // Timeout principal
        timeoutRef.current = setTimeout(handleInactivityLogout, timeoutDuration)
    }, [enabled, isAuthenticated, clearTimers, showWarning, handleInactivityLogout, hideWarning, warningTimeMs])

    /**
     * Configurar listeners de actividad
     */
    useEffect(() => {
        if (!enabled || !isAuthenticated) {
            clearTimers()
            return
        }

        // Configurar listeners
        ACTIVITY_EVENTS.forEach(event => {
            window.addEventListener(event, resetTimer, { passive: true })
        })

        // Iniciar temporizador
        resetTimer()

        // Cleanup
        return () => {
            ACTIVITY_EVENTS.forEach(event => {
                window.removeEventListener(event, resetTimer)
            })
            clearTimers()
            hideWarning()
        }
    }, [enabled, isAuthenticated, resetTimer, clearTimers, hideWarning])

    /**
     * Exponer método para reiniciar manualmente (útil después de acciones importantes)
     */
    return {
        resetTimer,
        clearTimers,
    }
}

export default useInactivityTimeout
