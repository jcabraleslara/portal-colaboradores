/**
 * Contexto de Autenticación con Supabase Auth
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * VERSIÓN 3.0 - FAIL-FAST
 * - Timeout agresivo: máximo 8 segundos para toda la operación
 * - Sin reintentos: si falla, va directo al login
 * - Limpieza automática de sesiones corruptas
 * - Lógica simplificada para evitar race conditions
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { supabase } from '@/config/supabase.config'
import { AuthUser } from '@/types'

// ========================================
// CONSTANTES - FAIL-FAST APPROACH
// ========================================
const PROFILE_CACHE_KEY = 'gestar-user-profile'
const MAX_CACHE_AGE_MS = 30 * 60 * 1000 // 30 minutos de validez
const GLOBAL_TIMEOUT_MS = 4000 // 4 segundos MÁXIMO para todo el proceso
const FAILSAFE_TIMEOUT_MS = 6000 // 6 segundos timeout de seguridad absoluto

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

    // ========================================
    // LIMPIEZA DE SESIÓN CORRUPTA
    // ========================================

    const forceCleanSession = useCallback(async () => {
        console.info('🧹 Forzando limpieza de sesión...')
        clearProfileCache()
        try {
            await supabase.auth.signOut({ scope: 'local' })
        } catch {
            // Ignorar errores de signOut
        }
        setUser(null)
        setIsLoading(false)
        processingAuth.current = false
    }, [clearProfileCache])

    // ========================================
    // OBTENCIÓN DE PERFIL (FAIL-FAST)
    // ========================================

    const fetchProfileFast = useCallback(async (email: string): Promise<AuthUser | null> => {
        const startTime = performance.now()
        console.info('🔎 Obteniendo perfil para:', email)

        // Una sola operación con timeout global
        try {
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT')), GLOBAL_TIMEOUT_MS)
            )

            // Intentar RPC primero (más rápida, bypassa RLS)
            const rpcPromise = supabase
                .rpc('get_user_profile_by_email', { user_email: email })
                .then(({ data, error }) => {
                    if (error) throw error
                    const userData = Array.isArray(data) && data.length > 0 ? data[0] : data
                    return userData
                })

            const userData = await Promise.race([rpcPromise, timeoutPromise])

            const duration = performance.now() - startTime
            console.info(`✅ Perfil obtenido en ${duration.toFixed(0)}ms`)

            if (!userData) return null

            // Validar usuario activo
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
        } catch (error: any) {
            const duration = performance.now() - startTime
            const isTimeout = error.message === 'TIMEOUT'

            console.warn(`❌ Fetch fallido en ${duration.toFixed(0)}ms: ${isTimeout ? 'TIMEOUT' : error.message}`)

            // Intentar query directa como fallback rápido (solo si no fue timeout)
            if (!isTimeout) {
                try {
                    const { data, error: queryError } = await Promise.race([
                        supabase
                            .from('usuarios_portal')
                            .select('identificacion, nombre_completo, email_institucional, rol, activo, last_sign_in_at')
                            .eq('email_institucional', email)
                            .single(),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error('QUERY_TIMEOUT')), 2000) // 2s fallback
                        )
                    ])

                    if (!queryError && data && data.activo !== false) {
                        console.info('✅ Fallback query exitoso')
                        return {
                            identificacion: data.identificacion || 'N/A',
                            nombreCompleto: data.nombre_completo || email.split('@')[0],
                            email: data.email_institucional || email,
                            rol: (data.rol || 'operativo') as any,
                            primerLogin: !data.last_sign_in_at,
                            ultimoLogin: data.last_sign_in_at ? new Date(data.last_sign_in_at) : null,
                        }
                    }
                } catch {
                    // Query fallback también falló
                }
            }

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

        // Timeout de seguridad: Máximo 6 segundos para inicialización completa
        const safetyTimeout = setTimeout(() => {
            if (mounted && isLoading) {
                console.warn('⚠️ Timeout de seguridad activado - redirigiendo a login')
                forceCleanSession()
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

            try {
                // ===== CASO 1: Hay sesión válida =====
                if (session?.user && email) {
                    console.info(`🔐 [${eventType}] Sesión detectada: ${email}`)

                    // Intentar caché primero (instantáneo)
                    const cachedProfile = getCachedProfile(email)
                    if (cachedProfile) {
                        console.info('📦 Usando perfil cacheado')
                        setUser(cachedProfile)
                        setIsLoading(false)
                        initializationComplete.current = true

                        // Actualizar en background sin bloquear
                        fetchProfileFast(email).then(freshProfile => {
                            if (mounted && freshProfile) {
                                setUser(freshProfile)
                                cacheProfile(freshProfile)
                            }
                        }).catch(() => {
                            // Silenciosamente ignorar errores de background
                        }).finally(() => {
                            processingAuth.current = false
                        })

                        return
                    }

                    // Sin caché: obtener perfil (máximo GLOBAL_TIMEOUT_MS)
                    console.info('🔍 Sin caché, obteniendo perfil...')
                    const profile = await fetchProfileFast(email)

                    if (!mounted) return

                    if (profile) {
                        console.info('✅ Autenticación exitosa:', profile.nombreCompleto)
                        setUser(profile)
                        cacheProfile(profile)
                    } else {
                        // No se pudo obtener perfil: sesión corrupta o usuario desactivado
                        console.warn('⚠️ No se pudo obtener perfil válido - limpiando sesión')
                        await forceCleanSession()
                        return
                    }

                    setIsLoading(false)
                    initializationComplete.current = true
                }
                // ===== CASO 2: No hay sesión =====
                else {
                    // Solo redirigir a login si no tenemos usuario ya cargado
                    // O si es el evento inicial (INITIAL_SESSION)
                    if (!user || eventType === 'INITIAL_SESSION') {
                        console.info(`🔓 [${eventType}] Sin sesión activa`)
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
                        console.info('🔄 Token renovado')
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
