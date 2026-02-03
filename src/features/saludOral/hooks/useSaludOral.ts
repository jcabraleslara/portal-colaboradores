/**
 * Hooks personalizados para Salud Oral
 * Manejo de estado con useState/useEffect
 */

import { useState, useCallback } from 'react'
import { saludOralService } from '../services/saludOral.service'
import type {
    OdRegistro,
    OdRegistroCreate,
    OdRegistroUpdate,
    OdFilters,
    OdMetrics,
    PaginatedResponse,
} from '@/types/saludOral.types'

// ========================================
// HOOK PARA LISTAR REGISTROS
// ========================================

interface UseSaludOralListReturn {
    data: PaginatedResponse<OdRegistro> | null
    isLoading: boolean
    error: Error | null
    refetch: () => Promise<void>
}

export function useSaludOralList(filters: OdFilters = {}): UseSaludOralListReturn {
    const [data, setData] = useState<PaginatedResponse<OdRegistro> | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const refetch = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await saludOralService.getAll(filters)
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Error desconocido'))
        } finally {
            setIsLoading(false)
        }
    }, [JSON.stringify(filters)])

    // Cargar datos inicialmente
    useState(() => {
        refetch()
    })

    return { data, isLoading, error, refetch }
}

// ========================================
// HOOK PARA DETALLE DE REGISTRO
// ========================================

interface UseSaludOralDetailReturn {
    data: OdRegistro | null
    isLoading: boolean
    error: Error | null
    refetch: () => Promise<void>
}

export function useSaludOralDetail(id: string | null): UseSaludOralDetailReturn {
    const [data, setData] = useState<OdRegistro | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const refetch = useCallback(async () => {
        if (!id) return
        setIsLoading(true)
        setError(null)
        try {
            const result = await saludOralService.getById(id)
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Error desconocido'))
        } finally {
            setIsLoading(false)
        }
    }, [id])

    return { data, isLoading, error, refetch }
}

// ========================================
// HOOK PARA MÉTRICAS
// ========================================

interface UseSaludOralMetricsReturn {
    data: OdMetrics | null
    isLoading: boolean
    error: Error | null
    refetch: () => Promise<void>
}

export function useSaludOralMetrics(filters?: OdFilters): UseSaludOralMetricsReturn {
    const [data, setData] = useState<OdMetrics | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const refetch = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await saludOralService.getMetrics(filters)
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Error desconocido'))
        } finally {
            setIsLoading(false)
        }
    }, [JSON.stringify(filters)])

    useState(() => {
        refetch()
    })

    return { data, isLoading, error, refetch }
}

// ========================================
// HOOK PARA COLABORADORES
// ========================================

interface UseSaludOralColaboradoresReturn {
    data: string[] | null
    isLoading: boolean
    error: Error | null
}

export function useSaludOralColaboradores(): UseSaludOralColaboradoresReturn {
    const [data, setData] = useState<string[] | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useState(() => {
        const load = async () => {
            try {
                const result = await saludOralService.getColaboradores()
                setData(result)
            } catch (err) {
                setError(err instanceof Error ? err : new Error('Error desconocido'))
            } finally {
                setIsLoading(false)
            }
        }
        load()
    })

    return { data, isLoading, error }
}

// ========================================
// HOOK PARA REGISTROS POR PACIENTE
// ========================================

interface UseSaludOralByPacienteReturn {
    data: OdRegistro[] | null
    isLoading: boolean
    error: Error | null
    refetch: () => Promise<void>
}

export function useSaludOralByPaciente(pacienteId: string | null): UseSaludOralByPacienteReturn {
    const [data, setData] = useState<OdRegistro[] | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const refetch = useCallback(async () => {
        if (!pacienteId) return
        setIsLoading(true)
        setError(null)
        try {
            const result = await saludOralService.getByPaciente(pacienteId)
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Error desconocido'))
        } finally {
            setIsLoading(false)
        }
    }, [pacienteId])

    return { data, isLoading, error, refetch }
}

// ========================================
// HOOK PARA CREAR REGISTRO
// ========================================

interface UseCrearSaludOralReturn {
    mutateAsync: (data: OdRegistroCreate) => Promise<OdRegistro>
    isPending: boolean
    error: Error | null
}

export function useCrearSaludOral(): UseCrearSaludOralReturn {
    const [isPending, setIsPending] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const mutateAsync = useCallback(async (data: OdRegistroCreate): Promise<OdRegistro> => {
        setIsPending(true)
        setError(null)
        try {
            const result = await saludOralService.create(data)
            return result
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Error desconocido')
            setError(error)
            throw error
        } finally {
            setIsPending(false)
        }
    }, [])

    return { mutateAsync, isPending, error }
}

// ========================================
// HOOK PARA ACTUALIZAR REGISTRO
// ========================================

interface UseActualizarSaludOralReturn {
    mutateAsync: (params: { id: string; data: OdRegistroUpdate }) => Promise<OdRegistro>
    isPending: boolean
    error: Error | null
}

export function useActualizarSaludOral(): UseActualizarSaludOralReturn {
    const [isPending, setIsPending] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const mutateAsync = useCallback(async ({ id, data }: { id: string; data: OdRegistroUpdate }): Promise<OdRegistro> => {
        setIsPending(true)
        setError(null)
        try {
            const result = await saludOralService.update(id, data)
            return result
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Error desconocido')
            setError(error)
            throw error
        } finally {
            setIsPending(false)
        }
    }, [])

    return { mutateAsync, isPending, error }
}

// ========================================
// HOOK PARA ELIMINAR REGISTRO
// ========================================

interface UseEliminarSaludOralReturn {
    mutateAsync: (id: string) => Promise<void>
    isPending: boolean
    error: Error | null
}

export function useEliminarSaludOral(): UseEliminarSaludOralReturn {
    const [isPending, setIsPending] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const mutateAsync = useCallback(async (id: string): Promise<void> => {
        setIsPending(true)
        setError(null)
        try {
            await saludOralService.delete(id)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Error desconocido')
            setError(error)
            throw error
        } finally {
            setIsPending(false)
        }
    }, [])

    return { mutateAsync, isPending, error }
}
