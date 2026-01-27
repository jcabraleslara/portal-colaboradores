/**
 * Contexto de Autenticación con Supabase Auth
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * SOLUCIÓN DEFINITIVA - Versión 2.0
 * - Caché dual (localStorage + sessionStorage) con 30 min de validez
 * - Triple fallback: RPC → Query directa → Perfil básico
 * - Retry automático con exponential backoff
 * - Optimistic load para UX instantánea
 * - Eliminación de race conditions entre eventos
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { supabase } from '@/config/supabase.config'
import { AuthUser } from '@/types'

// Constantes de configuración
const PROFILE_CACHE_KEY = 'gestar-user-profile'
const MAX_CACHE_AGE_MS = 30 * 60 * 1000 // 30 minutos
const FETCH_TIMEOUT_MS = 30000 // 30 segundos
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000

// ========================================
// TIPOS DEL CONTEXTO
// ========================================

interface AuthContextType {
    user: AuthUser | null
    isAuthenticated: boolean
    isLoading: boolean
    login: (user: AuthUser) => void
    logout: () => Promise<void>
    updateUser: (updates: Partial<AuthUser>) => void
    checkSession: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ========================================
// PROVIDER
// ========================================

interface AuthProviderProps {
    children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // ========================================
    // UTILIDADES DE PERFORMANCE
    // ========================================

    /**
     * Medir performance de operaciones críticas
     */
    const measurePerformance = useCallback((operationName: string, durationMs: number) => {
        console.info(`⏱️ ${operationName}: ${durationMs.toFixed(0)}ms`)

        // Alertar si la operación es muy lenta
        if (durationMs > 5000) {
            console.warn(`🐢 Operación lenta detectada: ${operationName} (${durationMs.toFixed(0)}ms)`)
        }

        return durationMs
    }, [])

    // ========================================
    // GESTIÓN DE CACHÉ DUAL
    // ========================================

    /**
     * Interfaz de perfil cacheado
     */
    interface CachedProfile {
        identificacion: string
        nombreCompleto: string
        email: string | null
        rol: string
        primerLogin: boolean
        ultimoLogin: string | null
        cachedAt: number
    }

    /**
     * Guardar perfil en caché dual (localStorage + sessionStorage)
     * localStorage: Persistente entre sesiones del navegador
     * sessionStorage: Solo durante la sesión actual
     */
    const cacheProfile = useCallback((profile: AuthUser) => {
        const cached: CachedProfile = {
            ...profile,
            ultimoLogin: profile.ultimoLogin?.toISOString() || null,
            cachedAt: Date.now()
        }

        try {
            const serialized = JSON.stringify(cached)
            sessionStorage.setItem(PROFILE_CACHE_KEY, serialized)
            localStorage.setItem(PROFILE_CACHE_KEY, serialized)
        } catch (e) {
            console.warn('⚠️ Error guardando perfil en caché:', e)
        }
    }, [])

    /**
     * Obtener perfil desde caché (intenta sessionStorage primero, luego localStorage)
     * Validez: 30 minutos
     */
    const getCachedProfile = useCallback((email?: string): AuthUser | null => {
        // Intentar ambos storages en orden de prioridad
        for (const storage of [sessionStorage, localStorage]) {
            try {
                const cached = storage.getItem(PROFILE_CACHE_KEY)
                if (!cached) continue

                const parsed: CachedProfile = JSON.parse(cached)
                const cacheAge = Date.now() - (parsed.cachedAt || 0)

                // Validar edad del caché
                if (cacheAge > MAX_CACHE_AGE_MS) {
                    continue // Caché expirada, probar siguiente storage
                }

                // Validar que el email coincida (si se proporciona)
                if (email && parsed.email !== email) {
                    continue
                }

                // Caché válida encontrada
                return {
                    ...parsed,
                    ultimoLogin: parsed.ultimoLogin ? new Date(parsed.ultimoLogin) : null,
                } as AuthUser
            } catch (error) {
                console.warn(`⚠️ Error leyendo caché de ${storage === sessionStorage ? 'session' : 'local'}Storage:`, error)
            }
        }

        return null
    }, [])

    /**
     * Limpiar caché del perfil en ambos storages
     */
    const clearProfileCache = useCallback(() => {
        try {
            sessionStorage.removeItem(PROFILE_CACHE_KEY)
            localStorage.removeItem(PROFILE_CACHE_KEY)
        } catch (e) {
            console.warn('⚠️ Error limpiando caché:', e)
        }
    }, [])

    // ========================================
    // TRIPLE FALLBACK: RPC → Query → Básico
    // ========================================

    /**
     * Transformar datos de BD a AuthUser
     */
    const transformToAuthUser = useCallback((data: any, email: string): AuthUser | null => {
        if (!data) return null

        // Validar que el usuario esté activo
        if (data.activo === false) {
            console.warn('⚠️ Usuario desactivado:', email)
            return null
        }

        return {
            identificacion: data.identificacion || 'N/A',
            nombreCompleto: data.nombre_completo || email.split('@')[0],
            email: data.email_institucional || email,
            rol: (data.rol || 'operativo') as any,
            primerLogin: !data.last_sign_in_at,
            ultimoLogin: data.last_sign_in_at ? new Date(data.last_sign_in_at) : null,
        }
    }, [])

const RPC_TIMEOUT_MS = 5000 // 5 segundos max para RPC

    /**
     * FALLBACK 1: Obtener perfil usando RPC (más rápida, bypassea RLS)
     */
    const fetchProfileViaRPC = useCallback(async (email: string): Promise<AuthUser | null> => {
        try {
            const startTime = performance.now()

            // Promise Race: RPC vs Timeout
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT_RPC')), RPC_TIMEOUT_MS)
            )

            const rpcPromise = supabase
                .rpc('get_user_profile_by_email', { user_email: email })

            // @ts-ignore
            const { data, error } = await Promise.race([rpcPromise, timeoutPromise])

            const duration = performance.now() - startTime
            measurePerformance('RPC get_user_profile_by_email', duration)

            if (error) {
                console.warn('⚠️ Error en RPC:', error.message)
                return null
            }

            // RPC devuelve un array de rows, tomar el primero si existe
            const userData = Array.isArray(data) && data.length > 0 ? data[0] : data

            return transformToAuthUser(userData, email)
        } catch (error: any) {
            if (error.message === 'TIMEOUT_RPC') {
                console.warn(`🐢 RPC Timeout tras ${RPC_TIMEOUT_MS}ms - Saltando a Query Directa...`)
            } else {
                console.warn('⚠️ Excepción en RPC:', error.message)
            }
            return null
        }
    }, [transformToAuthUser, measurePerformance])

    /**
     * FALLBACK 2: Obtener perfil usando query directa (con timeout y retry)
     */
    const fetchProfileViaQuery = useCallback(async (
        email: string,
        retries = MAX_RETRIES,
        delay = INITIAL_RETRY_DELAY_MS
    ): Promise<AuthUser | null> => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const startTime = performance.now()

                // Timeout promise
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('TIMEOUT_QUERY')), FETCH_TIMEOUT_MS)
                )

                // Query promise
                const queryPromise = supabase
                    .from('usuarios_portal')
                    .select('identificacion, nombre_completo, email_institucional, rol, activo, last_sign_in_at')
                    .eq('email_institucional', email)
                    .single()

                // Race: query vs timeout
                const result = await Promise.race([queryPromise, timeoutPromise])

                const duration = performance.now() - startTime
                measurePerformance(`Query directa (intento ${attempt}/${retries})`, duration)

                if (result.error) {
                    throw new Error(result.error.message)
                }

                return transformToAuthUser(result.data, email)
            } catch (error: any) {
                const isLastAttempt = attempt === retries

                if (isLastAttempt) {
                    console.error(`❌ Query fallida después de ${retries} intentos:`, error.message)
                    return null
                }

                // Exponential backoff
                const backoffDelay = delay * Math.pow(2, attempt - 1)
                console.warn(`⚠️ Intento ${attempt} fallido, reintentando en ${backoffDelay}ms...`)
                await new Promise(resolve => setTimeout(resolve, backoffDelay))
            }
        }

        return null
    }, [transformToAuthUser, measurePerformance])

    /**
     * FALLBACK 3: Perfil básico (último recurso)
     */
    const createFallbackProfile = useCallback((email: string): AuthUser => {
        console.warn('⚠️ Usando perfil básico/fallback para:', email)
        return {
            identificacion: 'N/A',
            nombreCompleto: email.split('@')[0] || 'Usuario',
            email: email,
            rol: 'operativo',
            primerLogin: true,
            ultimoLogin: null,
        }
    }, [])

    /**
     * FUNCIÓN PRINCIPAL: Obtener perfil con triple fallback
     */
    const fetchUserProfile = useCallback(async (_authUserId: string, email: string): Promise<AuthUser | null> => {
        const startTime = performance.now()
        console.info('🔎 Buscando perfil para:', email)

        try {
            // PASO 1: Intentar RPC (más rápida, bypass RLS)
            console.info('🚀 Intentando obtener perfil via RPC...')
            const rpcProfile = await fetchProfileViaRPC(email)

            if (rpcProfile) {
                console.info('✅ Perfil obtenido via RPC:', rpcProfile.nombreCompleto)
                const totalDuration = performance.now() - startTime
                measurePerformance('Fetch total (RPC exitosa)', totalDuration)

                // Actualizar last_sign_in_at en background
                supabase.rpc('update_last_login', { user_email: email })
                    .then(({ error }) => {
                        if (error) console.warn('⚠️ Error actualizando last_login:', error.message)
                    })

                return rpcProfile
            }

            // PASO 2: Fallback a query directa con retry
            console.info('🔄 RPC falló, intentando query directa con retry...')
            const queryProfile = await fetchProfileViaQuery(email)

            if (queryProfile) {
                console.info('✅ Perfil obtenido via query:', queryProfile.nombreCompleto)
                const totalDuration = performance.now() - startTime
                measurePerformance('Fetch total (Query exitosa)', totalDuration)

                // Actualizar last_sign_in_at en background
                supabase.rpc('update_last_login', { user_email: email })
                    .then(({ error }) => {
                        if (error) console.warn('⚠️ Error actualizando last_login:', error.message)
                    })

                return queryProfile
            }

            // PASO 3: Si todo falla, crear perfil básico (pero NO null)
            // Esto permite que el usuario use la app mientras se resuelve el problema
            const fallbackProfile = createFallbackProfile(email)
            const totalDuration = performance.now() - startTime
            measurePerformance('Fetch total (Fallback)', totalDuration)

            return fallbackProfile

        } catch (error: any) {
            console.error('❌ Error crítico obteniendo perfil:', error)

            // Aún en caso de error crítico, devolver perfil básico
            return createFallbackProfile(email)
        }
    }, [fetchProfileViaRPC, fetchProfileViaQuery, createFallbackProfile, measurePerformance])

    /**
     * Verificar sesión actual
     */
    const checkSession = useCallback(async (): Promise<boolean> => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            return !!session
        } catch {
            return false
        }
    }, [])

    /**
     * Login: se llama después de autenticación exitosa
     */
    const login = useCallback((authUser: AuthUser) => {
        setUser(authUser)
    }, [])

    /**
     * Logout
     */
    const logout = useCallback(async () => {
        console.info('🔒 Cerrando sesión...')
        clearProfileCache()
        await supabase.auth.signOut()
        setUser(null)
    }, [clearProfileCache])

    /**
     * Actualizar datos del usuario
     */
    const updateUser = useCallback((updates: Partial<AuthUser>) => {
        setUser(prev => {
            if (!prev) return null
            return { ...prev, ...updates }
        })
    }, [])

    // Ref para tracking del último email procesado exitosamente
    const lastSuccessfulEmail = useRef<string | null>(null)
    // Ref para evitar procesamiento en paralelo del mismo email
    const isProcessing = useRef<boolean>(false)

    /**
     * Listener de eventos de autenticación
     */
    useEffect(() => {
        let mounted = true

        // Failsafe: Si después de 30 segundos no hay respuesta
        const failsafeTimeout = setTimeout(() => {
            if (mounted && isLoading) {
                console.warn('⚠️ Failsafe activado: forzando fin de loading')
                setIsLoading(false)
            }
        }, 30000)

        // Suscribirse a cambios de auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return

                console.info(`🔐 Auth event: ${event}`)

                // Limpiar failsafe timeout inmediatamente al recibir un evento crítico
                // Esto evita que el timeout se dispare si hay un 'return' temprano (ej: caché)
                if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                    clearTimeout(failsafeTimeout)
                }

                const currentEmail = session?.user?.email || null

                // ================================================
                // MANEJO DE LOGIN/INITIAL_SESSION
                // ================================================
                if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user && currentEmail) {

                    // Prevenir procesamiento duplicado/concurrente
                    if (isProcessing.current) {
                        console.info('⏸️ Ya hay un proceso de autenticación en curso, omitiendo...')
                        return
                    }

                    // Prevenir procesamiento si ya se procesó exitosamente este email
                    if (lastSuccessfulEmail.current === currentEmail) {
                        console.info(`📦 Email ya autenticado: ${currentEmail}, omitiendo evento ${event}`)
                        setIsLoading(false)
                        return
                    }

                    isProcessing.current = true
                    console.info(`👤 Procesando autenticación para: ${currentEmail} (evento: ${event})`)

                    try {
                        // ESTRATEGIA OPTIMISTIC LOAD:
                        // 1. Cargar desde caché inmediatamente (UX instantánea)
                        const cachedProfile = getCachedProfile(currentEmail)

                        if (cachedProfile) {
                            console.info('📦 Perfil encontrado en caché, cargando instantáneamente...')
                            setUser(cachedProfile)
                            setIsLoading(false)
                            lastSuccessfulEmail.current = currentEmail // ✅ Marcar como procesado

                            // 2. Actualizar perfil en background (sin bloquear UI)
                            console.info('🔄 Actualizando perfil en background...')
                            fetchUserProfile(session.user.id, currentEmail)
                                .then(freshProfile => {
                                    if (!mounted) return

                                    if (freshProfile) {
                                        setUser(freshProfile)
                                        cacheProfile(freshProfile)
                                        console.info('✅ Perfil actualizado en background')
                                    }
                                })
                                .catch((error: any) => {
                                    console.warn('⚠️ Error actualizando perfil en background:', error.message)
                                    // No hacer nada, el usuario ya está usando su caché
                                })
                                .finally(() => {
                                    isProcessing.current = false
                                })

                            return // Salir temprano con caché
                        }

                        // 3. Sin caché: fetch normal (bloquea hasta obtener perfil)
                        console.info('🔍 No hay caché disponible, obteniendo perfil desde BD...')
                        const freshProfile = await fetchUserProfile(session.user.id, currentEmail)

                        if (!mounted) return

                        if (freshProfile) {
                            setUser(freshProfile)
                            cacheProfile(freshProfile)
                            lastSuccessfulEmail.current = currentEmail
                            console.info('✅ Autenticación exitosa:', freshProfile.nombreCompleto)
                        } else {
                            // Si fetchUserProfile devuelve null (usuario desactivado)
                            console.error('❌ No se pudo obtener perfil válido, cerrando sesión...')
                            await supabase.auth.signOut()
                            setUser(null)
                        }

                    } catch (error: any) {
                        console.error('❌ Error crítico en autenticación:', error)
                        // En caso de error crítico, intentar usar caché sin validar email
                        const anyCachedProfile = getCachedProfile()
                        if (anyCachedProfile) {
                            console.warn('⚠️ Usando última caché disponible por error crítico')
                            setUser(anyCachedProfile)
                        }
                    } finally {
                        if (mounted) {
                            setIsLoading(false)
                            isProcessing.current = false
                        }
                    }
                }

                // ================================================
                // MANEJO DE INITIAL_SESSION SIN USUARIO (No logueado/Sesión expirada)
                // ================================================
                else if (event === 'INITIAL_SESSION' && !session?.user) {
                    console.info('🔓 No hay sesión activa, redirigiendo a login...')
                    if (mounted) {
                        setUser(null)
                        setIsLoading(false)
                        lastSuccessfulEmail.current = null
                        isProcessing.current = false
                    }
                }

                // ================================================
                // MANEJO DE LOGOUT
                // ================================================
                else if (event === 'SIGNED_OUT') {
                    console.info('🔒 Usuario desconectado')
                    lastSuccessfulEmail.current = null
                    isProcessing.current = false
                    clearProfileCache()
                    if (mounted) {
                        setUser(null)
                        setIsLoading(false)
                    }
                }

                // ================================================
                // OTROS EVENTOS
                // ================================================
                else if (event === 'TOKEN_REFRESHED') {
                    console.info('🔄 Token de sesión renovado automáticamente')
                }
                else if (event === 'USER_UPDATED') {
                    console.info('👤 Datos de usuario actualizados')
                    // Refrescar perfil en background
                    if (session?.user && currentEmail) {
                        fetchUserProfile(session.user.id, currentEmail)
                            .then(profile => {
                                if (mounted && profile) {
                                    setUser(profile)
                                    cacheProfile(profile)
                                }
                            })
                            .catch((error: any) => {
                                console.warn('⚠️ Error actualizando perfil:', error)
                            })
                    }
                }

                // Limpiar failsafe timeout una vez procesado evento crítico
                // (Timeout ya fue limpiado al inicio del callback)
            }
        )

        return () => {
            mounted = false
            clearTimeout(failsafeTimeout)
            subscription.unsubscribe()
        }
    }, [fetchUserProfile, getCachedProfile, cacheProfile, clearProfileCache])

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateUser,
        checkSession,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

// ========================================
// HOOK
// ========================================

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth debe usarse dentro de un AuthProvider')
    }
    return context
}



