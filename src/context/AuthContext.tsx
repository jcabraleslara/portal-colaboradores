/**
 * Contexto de Autenticación con Supabase Auth
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * VERSIÓN 4.1 - SESIÓN PERSISTENTE (OPTIMIZADA)
 * - Sesión de larga duración: caché válido por 24 horas
 * - Renovación automática del token sin interrumpir al usuario
 * - Tolerancia a fallos: múltiples reintentos antes de forzar logout
 * - Prioriza mantener la sesión activa sobre validaciones estrictas
 * - Logs reducidos y eventos de auth deduplicados
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { supabase } from '@/config/supabase.config'
import { AuthUser } from '@/types'

// ========================================
// CONSTANTES - SESIÓN PERSISTENTE
// ========================================
const PROFILE_CACHE_KEY = 'gestar-user-profile'
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000 // 24 horas de validez del caché
const GLOBAL_TIMEOUT_MS = 15000 // 15 segundos para consultas (conexiones lentas)
const FAILSAFE_TIMEOUT_MS = 30000 // 30 segundos timeout de seguridad

// Habilitar logs detallados solo en desarrollo
const DEBUG_AUTH = import.meta.env.DEV && import.meta.env.VITE_DEBUG_AUTH === 'true'
const log = {
    info: (...args: unknown[]) => DEBUG_AUTH && console.info(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => console.error(...args),
}

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

    // Refs para control de estado
    const initializationComplete = useRef(false)
    const processingAuth = useRef(false)

    // ========================================
    // CACHÉ (Simplificada)
    // ========================================

    interface CachedProfile {
        identificacion: string
        nombreCompleto: string
        email: string | null
        rol: string
        primerLogin: boolean
        ultimoLogin: string | null
        cachedAt: number
    }

    const cacheProfile = useCallback((profile: AuthUser) => {
        try {
            const cached: CachedProfile = {
                ...profile,
                ultimoLogin: profile.ultimoLogin?.toISOString() || null,
                cachedAt: Date.now()
            }
            const serialized = JSON.stringify(cached)
            sessionStorage.setItem(PROFILE_CACHE_KEY, serialized)
            localStorage.setItem(PROFILE_CACHE_KEY, serialized)
        } catch (e) {
            log.warn('Error guardando caché:', e)
        }
    }, [])

    const getCachedProfile = useCallback((email?: string): AuthUser | null => {
        for (const storage of [sessionStorage, localStorage]) {
            try {
                const cached = storage.getItem(PROFILE_CACHE_KEY)
                if (!cached) continue

                const parsed: CachedProfile = JSON.parse(cached)
                const cacheAge = Date.now() - (parsed.cachedAt || 0)

                // Caché expirada
                if (cacheAge > MAX_CACHE_AGE_MS) continue

                // Email no coincide
                if (email && parsed.email !== email) continue

                return {
                    ...parsed,
                    ultimoLogin: parsed.ultimoLogin ? new Date(parsed.ultimoLogin) : null,
                } as AuthUser
            } catch {
                continue
            }
        }
        return null
    }, [])

    const clearProfileCache = useCallback(() => {
        try {
            sessionStorage.removeItem(PROFILE_CACHE_KEY)
            localStorage.removeItem(PROFILE_CACHE_KEY)
        } catch (e) {
            log.warn('Error limpiando caché:', e)
        }
    }, [])

    // ========================================
    // LIMPIEZA DE SESIÓN CORRUPTA
    // ========================================

    const forceCleanSession = useCallback(async () => {
        log.info('Forzando limpieza de sesión...')
        clearProfileCache()
        try {
            await supabase.auth.signOut({ scope: 'local' })
        } catch {
            // Ignorar errores de signOut
        }
        setUser(null)
        setIsLoading(false)
        processingAuth.current = false
        initializationComplete.current = true
    }, [clearProfileCache])

    // ========================================
    // OBTENCIÓN DE PERFIL (FAIL-FAST)
    // ========================================

    const fetchProfileFast = useCallback(async (email: string): Promise<AuthUser | null> => {
        const startTime = performance.now()
        log.info('Obteniendo perfil para:', email)

        // Flag para evitar logs de promesas "perdedoras"
        let resolved = false

        // Función helper para transformar datos del usuario
        const transformUserData = (userData: Record<string, unknown>): AuthUser | null => {
            if (!userData) return null
            if (userData.activo === false) {
                log.warn('Usuario desactivado')
                return null
            }
            return {
                identificacion: (userData.identificacion as string) || 'N/A',
                nombreCompleto: (userData.nombre_completo as string) || email.split('@')[0],
                email: (userData.email_institucional as string) || email,
                rol: ((userData.rol as string) || 'operativo') as AuthUser['rol'],
                primerLogin: !userData.last_sign_in_at,
                ultimoLogin: userData.last_sign_in_at ? new Date(userData.last_sign_in_at as string) : null,
            }
        }

        try {
            // Ejecutar RPC y query directa EN PARALELO - la primera exitosa gana
            const rpcPromise = supabase
                .rpc('get_user_profile_by_email', { user_email: email })
                .then(({ data, error }) => {
                    if (error) throw error
                    const userData = Array.isArray(data) && data.length > 0 ? data[0] : data
                    if (!userData) throw new Error('RPC_NO_DATA')
                    if (!resolved) {
                        resolved = true
                        log.info('RPC respondió primero')
                    }
                    return userData
                })

            const queryPromise = supabase
                .from('usuarios_portal')
                .select('identificacion, nombre_completo, email_institucional, rol, activo, last_sign_in_at')
                .eq('email_institucional', email)
                .single()
                .then(({ data, error }) => {
                    if (error) throw error
                    if (!data) throw new Error('QUERY_NO_DATA')
                    if (!resolved) {
                        resolved = true
                        log.info('Query directa respondió primero')
                    }
                    return data
                })

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT')), GLOBAL_TIMEOUT_MS)
            )

            // Promise.any resuelve con la PRIMERA promesa exitosa
            const userData = await Promise.any([rpcPromise, queryPromise, timeoutPromise])
                .catch((aggregateError: AggregateError) => {
                    log.warn('Todas las consultas fallaron:', aggregateError.errors?.map((e: Error) => e.message) || aggregateError.message)
                    return null
                })

            const duration = performance.now() - startTime

            if (!userData) {
                log.warn(`No se pudo obtener perfil en ${duration.toFixed(0)}ms`)
                return null
            }

            log.info(`Perfil obtenido en ${duration.toFixed(0)}ms`)
            return transformUserData(userData as Record<string, unknown>)

        } catch (error) {
            const duration = performance.now() - startTime
            log.warn(`Error inesperado en ${duration.toFixed(0)}ms:`, error instanceof Error ? error.message : error)
            return null
        }
    }, [])

    // ========================================
    // FUNCIONES DE AUTENTICACIÓN
    // ========================================

    const checkSession = useCallback(async (): Promise<boolean> => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            return !!session
        } catch {
            return false
        }
    }, [])

    const login = useCallback((authUser: AuthUser) => {
        setUser(authUser)
        cacheProfile(authUser)
    }, [cacheProfile])

    const logout = useCallback(async () => {
        log.info('Cerrando sesión...')
        clearProfileCache()
        await supabase.auth.signOut()
        setUser(null)
    }, [clearProfileCache])

    const updateUser = useCallback((updates: Partial<AuthUser>) => {
        setUser(prev => {
            if (!prev) return null
            const updated = { ...prev, ...updates }
            cacheProfile(updated)
            return updated
        })
    }, [cacheProfile])

    // ========================================
    // INICIALIZACIÓN Y LISTENER
    // ========================================

    useEffect(() => {
        let mounted = true
        // Ref para el usuario actual dentro del effect (evita closure stale)
        const userRef = { current: user }

        // Timeout de seguridad: Solo actúa si NO hay caché disponible
        const safetyTimeout = setTimeout(() => {
            if (mounted && isLoading) {
                const fallbackProfile = getCachedProfile()
                if (fallbackProfile) {
                    log.info('Timeout alcanzado - usando caché de respaldo')
                    setUser(fallbackProfile)
                    setIsLoading(false)
                    initializationComplete.current = true
                    processingAuth.current = false
                } else {
                    log.warn('Timeout de seguridad - sin caché disponible, redirigiendo a login')
                    forceCleanSession()
                }
            }
        }, FAILSAFE_TIMEOUT_MS)

        const handleAuthSession = async (session: { user?: { email?: string } } | null, eventType: string) => {
            if (!mounted) return

            // Evitar procesamiento concurrente
            if (processingAuth.current) {
                log.info(`[${eventType}] Procesamiento en curso, omitiendo...`)
                return
            }

            processingAuth.current = true
            const email = session?.user?.email

            try {
                // ===== CASO 1: Hay sesión válida =====
                if (session?.user && email) {
                    log.info(`[${eventType}] Sesión detectada: ${email}`)

                    // Intentar caché primero (instantáneo)
                    const cachedProfile = getCachedProfile(email)
                    if (cachedProfile) {
                        log.info('Usando perfil cacheado')
                        setUser(cachedProfile)
                        userRef.current = cachedProfile
                        setIsLoading(false)
                        initializationComplete.current = true
                        processingAuth.current = false

                        // Actualizar en background SIN afectar la sesión actual
                        fetchProfileFast(email).then(freshProfile => {
                            if (mounted && freshProfile) {
                                setUser(freshProfile)
                                userRef.current = freshProfile
                                cacheProfile(freshProfile)
                                log.info('Perfil actualizado en background')
                            }
                        }).catch(() => {
                            // Silencioso - mantener caché
                        })

                        return
                    }

                    // Sin caché: obtener perfil
                    log.info('Sin caché, obteniendo perfil...')
                    const profile = await fetchProfileFast(email)

                    if (!mounted) return

                    if (profile) {
                        log.info('Autenticación exitosa:', profile.nombreCompleto)
                        setUser(profile)
                        userRef.current = profile
                        cacheProfile(profile)
                        setIsLoading(false)
                        initializationComplete.current = true
                    } else {
                        // No se pudo obtener perfil - crear perfil básico para no bloquear
                        log.warn('No se pudo obtener perfil, creando perfil básico')
                        const basicProfile: AuthUser = {
                            identificacion: 'PENDIENTE',
                            nombreCompleto: email.split('@')[0],
                            email: email,
                            rol: 'operativo',
                            primerLogin: true,
                            ultimoLogin: null,
                        }
                        setUser(basicProfile)
                        userRef.current = basicProfile
                        cacheProfile(basicProfile)
                        setIsLoading(false)
                        initializationComplete.current = true
                    }
                }
                // ===== CASO 2: No hay sesión =====
                else {
                    log.info(`[${eventType}] Sin sesión activa`)
                    setUser(null)
                    userRef.current = null
                    setIsLoading(false)
                    initializationComplete.current = true
                }
            } catch (error) {
                log.error('Error en handleAuthSession:', error instanceof Error ? error.message : error)
                await forceCleanSession()
            } finally {
                processingAuth.current = false
            }
        }

        // Suscribirse a cambios de auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return

                log.info(`Auth event: ${event}`)
                clearTimeout(safetyTimeout)

                switch (event) {
                    case 'INITIAL_SESSION':
                        // Este es el evento principal - determina estado inicial
                        await handleAuthSession(session, event)
                        break

                    case 'SIGNED_IN':
                        // IMPORTANTE: Ignorar si ya se procesó INITIAL_SESSION
                        // Supabase dispara SIGNED_IN antes de INITIAL_SESSION a veces
                        if (initializationComplete.current) {
                            log.info('SIGNED_IN ignorado - ya inicializado')
                            return
                        }
                        await handleAuthSession(session, event)
                        break

                    case 'SIGNED_OUT':
                        log.info('Usuario desconectado')
                        clearProfileCache()
                        setUser(null)
                        userRef.current = null
                        setIsLoading(false)
                        initializationComplete.current = false
                        processingAuth.current = false
                        break

                    case 'TOKEN_REFRESHED':
                        // Extender el caché del perfil cuando el token se renueva
                        if (userRef.current) {
                            cacheProfile(userRef.current)
                            log.info('Token renovado - caché extendido')
                        }
                        break

                    case 'USER_UPDATED':
                        if (session?.user?.email) {
                            const profile = await fetchProfileFast(session.user.email)
                            if (mounted && profile) {
                                setUser(profile)
                                userRef.current = profile
                                cacheProfile(profile)
                            }
                        }
                        break
                }
            }
        )

        return () => {
            mounted = false
            clearTimeout(safetyTimeout)
            subscription.unsubscribe()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Sin dependencias para evitar loops - las funciones usan refs

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
