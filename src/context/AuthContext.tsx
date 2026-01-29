/**
 * Contexto de Autenticación con Supabase Auth
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * VERSIÓN 4.0 - SESIÓN PERSISTENTE
 * - Sesión de larga duración: caché válido por 24 horas
 * - Renovación automática del token sin interrumpir al usuario
 * - Tolerancia a fallos: múltiples reintentos antes de forzar logout
 * - Prioriza mantener la sesión activa sobre validaciones estrictas
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { supabase } from '@/config/supabase.config'
import { AuthUser } from '@/types'

// ========================================
// CONSTANTES - SESIÓN PERSISTENTE
// ========================================
const PROFILE_CACHE_KEY = 'gestar-user-profile'
const FAILED_ATTEMPTS_KEY = 'gestar-auth-failed-attempts'
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000 // 24 horas de validez del caché
const GLOBAL_TIMEOUT_MS = 15000 // 15 segundos para consultas (conexiones lentas)
const FAILSAFE_TIMEOUT_MS = 30000 // 30 segundos timeout de seguridad
const MAX_FAILED_ATTEMPTS = 10 // 10 intentos antes de forzar login (muy tolerante)

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
            console.warn('⚠️ Error guardando caché:', e)
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
            console.warn('⚠️ Error limpiando caché:', e)
        }
    }, [])

    // Control de intentos fallidos para evitar loops infinitos
    const getFailedAttempts = useCallback((): number => {
        try {
            return parseInt(sessionStorage.getItem(FAILED_ATTEMPTS_KEY) || '0', 10)
        } catch {
            return 0
        }
    }, [])

    const incrementFailedAttempts = useCallback((): number => {
        try {
            const current = getFailedAttempts() + 1
            sessionStorage.setItem(FAILED_ATTEMPTS_KEY, current.toString())
            console.warn(`⚠️ Intento fallido #${current}`)
            return current
        } catch {
            return 1
        }
    }, [getFailedAttempts])

    const clearFailedAttempts = useCallback(() => {
        try {
            sessionStorage.removeItem(FAILED_ATTEMPTS_KEY)
        } catch {
            // Ignorar
        }
    }, [])

    // ========================================
    // LIMPIEZA DE SESIÓN CORRUPTA
    // ========================================

    const forceCleanSession = useCallback(async () => {
        console.info('🧹 Forzando limpieza de sesión...')
        clearProfileCache()
        clearFailedAttempts()
        try {
            await supabase.auth.signOut({ scope: 'local' })
        } catch {
            // Ignorar errores de signOut
        }
        setUser(null)
        setIsLoading(false)
        processingAuth.current = false
        initializationComplete.current = true // Marcar como completo para evitar loops
    }, [clearProfileCache, clearFailedAttempts])

    // ========================================
    // OBTENCIÓN DE PERFIL (FAIL-FAST)
    // ========================================

    const fetchProfileFast = useCallback(async (email: string): Promise<AuthUser | null> => {
        const startTime = performance.now()
        console.info('🔎 Obteniendo perfil para:', email)

        // Función helper para transformar datos del usuario
        const transformUserData = (userData: any): AuthUser | null => {
            if (!userData) return null
            if (userData.activo === false) {
                console.warn('⚠️ Usuario desactivado')
                return null
            }
            return {
                identificacion: userData.identificacion || 'N/A',
                nombreCompleto: userData.nombre_completo || email.split('@')[0],
                email: userData.email_institucional || email,
                rol: (userData.rol || 'operativo') as any,
                primerLogin: !userData.last_sign_in_at,
                ultimoLogin: userData.last_sign_in_at ? new Date(userData.last_sign_in_at) : null,
            }
        }

        try {
            // Ejecutar RPC y query directa EN PARALELO
            // La primera que responda exitosamente gana
            const rpcPromise = supabase
                .rpc('get_user_profile_by_email', { user_email: email })
                .then(({ data, error }) => {
                    if (error) throw error
                    const userData = Array.isArray(data) && data.length > 0 ? data[0] : data
                    if (!userData) throw new Error('RPC_NO_DATA')
                    console.info('📡 RPC respondió primero')
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
                    console.info('🗄️ Query directa respondió primero')
                    return data
                })

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT')), GLOBAL_TIMEOUT_MS)
            )

            // Promise.any resuelve con la PRIMERA promesa exitosa
            // Solo rechaza si TODAS fallan
            const userData = await Promise.any([rpcPromise, queryPromise, timeoutPromise])
                .catch((aggregateError: AggregateError) => {
                    // Si Promise.any falla, todas las promesas fallaron
                    console.warn('⚠️ Todas las consultas fallaron:', aggregateError.errors?.map((e: Error) => e.message) || aggregateError.message)
                    return null
                })

            const duration = performance.now() - startTime

            if (!userData) {
                console.warn(`❌ No se pudo obtener perfil en ${duration.toFixed(0)}ms`)
                return null
            }

            console.info(`✅ Perfil obtenido en ${duration.toFixed(0)}ms`)
            return transformUserData(userData)

        } catch (error: any) {
            const duration = performance.now() - startTime
            console.warn(`❌ Error inesperado en ${duration.toFixed(0)}ms:`, error.message)
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
        console.info('🔒 Cerrando sesión...')
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

        // Timeout de seguridad: Solo actúa si NO hay caché disponible
        const safetyTimeout = setTimeout(() => {
            if (mounted && isLoading) {
                // Antes de forzar logout, intentar usar caché existente
                const fallbackProfile = getCachedProfile()
                if (fallbackProfile) {
                    console.info('⏱️ Timeout alcanzado - usando caché de respaldo')
                    setUser(fallbackProfile)
                    setIsLoading(false)
                    initializationComplete.current = true
                    processingAuth.current = false
                } else {
                    console.warn('⚠️ Timeout de seguridad - sin caché disponible, redirigiendo a login')
                    forceCleanSession()
                }
            }
        }, FAILSAFE_TIMEOUT_MS)

        const handleAuthSession = async (session: any | null, eventType: string) => {
            if (!mounted) return

            // Evitar procesamiento concurrente
            if (processingAuth.current) {
                console.info(`⏸️ [${eventType}] Procesamiento en curso, omitiendo...`)
                return
            }

            processingAuth.current = true
            const email = session?.user?.email

            // Verificar intentos fallidos - pero primero intentar caché
            const failedAttempts = getFailedAttempts()
            if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
                // Antes de forzar logout, verificar si hay caché disponible
                const fallbackProfile = getCachedProfile(email)
                if (fallbackProfile) {
                    console.info('📦 Muchos intentos fallidos pero hay caché - usando caché')
                    clearFailedAttempts()
                    setUser(fallbackProfile)
                    setIsLoading(false)
                    initializationComplete.current = true
                    processingAuth.current = false
                    return
                }
                // Solo forzar logout si realmente no hay alternativa
                console.warn(`🛑 Máximo de intentos fallidos y sin caché. Requiere re-login.`)
                clearFailedAttempts()
                clearProfileCache()
                setUser(null)
                setIsLoading(false)
                initializationComplete.current = true
                processingAuth.current = false
                return
            }

            try {
                // ===== CASO 1: Hay sesión válida =====
                if (session?.user && email) {
                    console.info(`🔐 [${eventType}] Sesión detectada: ${email}`)

                    // Intentar caché primero (instantáneo) - PRIORIDAD MÁXIMA
                    const cachedProfile = getCachedProfile(email)
                    if (cachedProfile) {
                        console.info('📦 Usando perfil cacheado - sesión persistente')
                        clearFailedAttempts() // Reset en éxito
                        setUser(cachedProfile)
                        setIsLoading(false)
                        initializationComplete.current = true
                        processingAuth.current = false

                        // Actualizar en background SIN afectar la sesión actual
                        // Si falla, simplemente mantenemos el caché - no forzamos logout
                        fetchProfileFast(email).then(freshProfile => {
                            if (mounted && freshProfile) {
                                setUser(freshProfile)
                                cacheProfile(freshProfile)
                                console.info('✅ Perfil actualizado en background')
                            }
                        }).catch((error) => {
                            // Solo log, NUNCA afectar la sesión del usuario
                            console.info('ℹ️ Actualización background omitida:', error?.message || 'sin conexión')
                        })

                        return
                    }

                    // Sin caché: obtener perfil (máximo GLOBAL_TIMEOUT_MS)
                    console.info('🔍 Sin caché, obteniendo perfil...')
                    const profile = await fetchProfileFast(email)

                    if (!mounted) return

                    if (profile) {
                        console.info('✅ Autenticación exitosa:', profile.nombreCompleto)
                        clearFailedAttempts() // Reset en éxito
                        setUser(profile)
                        cacheProfile(profile)
                        setIsLoading(false)
                        initializationComplete.current = true
                    } else {
                        // No se pudo obtener perfil - ser tolerante
                        const attempts = incrementFailedAttempts()
                        console.warn(`⚠️ No se pudo obtener perfil (intento ${attempts}/${MAX_FAILED_ATTEMPTS})`)

                        // Crear perfil mínimo basado en el email para no bloquear al usuario
                        if (attempts < MAX_FAILED_ATTEMPTS) {
                            // Reintentar en el próximo evento de auth
                            console.info('ℹ️ Se reintentará en el próximo evento de autenticación')
                            setIsLoading(false)
                            initializationComplete.current = true
                        } else {
                            // Después de muchos intentos, crear perfil básico en lugar de forzar logout
                            console.warn('⚠️ Creando perfil básico para mantener sesión')
                            const basicProfile: AuthUser = {
                                identificacion: 'PENDIENTE',
                                nombreCompleto: email.split('@')[0],
                                email: email,
                                rol: 'operativo',
                                primerLogin: true,
                                ultimoLogin: null,
                            }
                            clearFailedAttempts()
                            setUser(basicProfile)
                            cacheProfile(basicProfile)
                            setIsLoading(false)
                            initializationComplete.current = true
                        }
                    }
                }
                // ===== CASO 2: No hay sesión =====
                else {
                    // Solo redirigir a login si no tenemos usuario ya cargado
                    // O si es el evento inicial (INITIAL_SESSION)
                    if (!user || eventType === 'INITIAL_SESSION') {
                        console.info(`🔓 [${eventType}] Sin sesión activa`)
                        clearFailedAttempts() // Reset porque es estado limpio
                        setUser(null)
                        setIsLoading(false)
                        initializationComplete.current = true
                    }
                }
            } catch (error: any) {
                console.error('❌ Error en handleAuthSession:', error.message)
                await forceCleanSession()
            } finally {
                processingAuth.current = false
            }
        }

        // Suscribirse a cambios de auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return

                console.info(`🔐 Auth event: ${event}`)
                clearTimeout(safetyTimeout)

                switch (event) {
                    case 'INITIAL_SESSION':
                        // Este es el evento más importante - determina estado inicial
                        await handleAuthSession(session, event)
                        break

                    case 'SIGNED_IN':
                        // Solo procesar si no se ha inicializado (evita duplicados)
                        if (!initializationComplete.current) {
                            await handleAuthSession(session, event)
                        }
                        break

                    case 'SIGNED_OUT':
                        console.info('🔒 Usuario desconectado')
                        clearProfileCache()
                        setUser(null)
                        setIsLoading(false)
                        initializationComplete.current = false
                        processingAuth.current = false
                        break

                    case 'TOKEN_REFRESHED':
                        console.info('🔄 Token renovado - extendiendo sesión')
                        // Extender el caché del perfil cuando el token se renueva
                        if (user) {
                            cacheProfile(user) // Renueva el timestamp del caché
                            console.info('✅ Caché de perfil extendido por 24 horas más')
                        }
                        break

                    case 'USER_UPDATED':
                        console.info('👤 Usuario actualizado')
                        if (session?.user?.email) {
                            const profile = await fetchProfileFast(session.user.email)
                            if (mounted && profile) {
                                setUser(profile)
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
