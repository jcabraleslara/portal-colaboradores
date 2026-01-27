/**
 * Hook para obtener métricas del dashboard de forma optimizada
 * Carga async con cache local para evitar latencia
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/config/supabase.config'

interface DashboardMetrics {
    casosPendientes: number
    soportesPorRevisar: number
    llamadasHoy: number
}

interface UseDashboardMetricsReturn {
    metrics: DashboardMetrics
    isLoading: boolean
    error: string | null
    refetch: () => Promise<void>
}

const CACHE_KEY = 'dashboard_metrics_cache'
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutos

const DEFAULT_METRICS: DashboardMetrics = {
    casosPendientes: 0,
    soportesPorRevisar: 0,
    llamadasHoy: 0
}

/**
 * Obtiene métricas cacheadas del sessionStorage
 */
function getCachedMetrics(): DashboardMetrics | null {
    try {
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (!cached) return null

        const { data, timestamp } = JSON.parse(cached)
        const isExpired = Date.now() - timestamp > CACHE_DURATION_MS

        return isExpired ? null : data
    } catch {
        return null
    }
}

/**
 * Guarda métricas en sessionStorage
 */
function setCachedMetrics(data: DashboardMetrics): void {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            data,
            timestamp: Date.now()
        }))
    } catch {
        // sessionStorage lleno, ignorar
    }
}

export function useDashboardMetrics(): UseDashboardMetricsReturn {
    // Intentar cargar desde cache inmediatamente
    const cachedData = getCachedMetrics()

    const [metrics, setMetrics] = useState<DashboardMetrics>(cachedData || DEFAULT_METRICS)
    const [isLoading, setIsLoading] = useState(!cachedData)
    const [error, setError] = useState<string | null>(null)

    const fetchMetrics = useCallback(async () => {
        try {
            setError(null)

            const { data, error: rpcError } = await supabase
                .rpc('get_dashboard_metrics')

            if (rpcError) throw rpcError

            const metricsData: DashboardMetrics = {
                casosPendientes: data?.casos_pendientes ?? 0,
                soportesPorRevisar: data?.soportes_por_revisar ?? 0,
                llamadasHoy: data?.llamadas_hoy ?? 0
            }

            setMetrics(metricsData)
            setCachedMetrics(metricsData)
        } catch (err) {
            console.error('Error cargando métricas:', err)
            setError('Error al cargar métricas')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        // Si hay cache, primero mostramos esos datos
        // y luego actualizamos en background (stale-while-revalidate)
        fetchMetrics()
    }, [fetchMetrics])

    return {
        metrics,
        isLoading,
        error,
        refetch: fetchMetrics
    }
}
