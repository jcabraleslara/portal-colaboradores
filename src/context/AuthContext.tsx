/**
 * Contexto de Autenticación con Supabase Auth
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Usa el sistema nativo de sesiones de Supabase
 * con auto-refresh y persistencia automática.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { supabase } from '@/config/supabase.config'
import { AuthUser } from '@/types'

// Clave para caché del perfil en sessionStorage
const PROFILE_CACHE_KEY = 'gestar-user-profile'

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

    /**
     * Guardar perfil en caché (sessionStorage)
     */
    const cacheProfile = useCallback((profile: AuthUser) => {
        try {
            sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
                ...profile,
                ultimoLogin: profile.ultimoLogin?.toISOString() || null,
                cachedAt: Date.now()
            }))
        } catch (e) {
            console.warn('No se pudo guardar perfil en caché:', e)
        }
    }, [])

    /**
     * Obtener perfil desde caché si es válido (menos de 5 min)
     */
    const getCachedProfile = useCallback((): AuthUser | null => {
        try {
            const cached = sessionStorage.getItem(PROFILE_CACHE_KEY)
            if (!cached) return null

            const parsed = JSON.parse(cached)
            const cacheAge = Date.now() - (parsed.cachedAt || 0)
            const MAX_CACHE_AGE = 5 * 60 * 1000 // 5 minutos

            if (cacheAge > MAX_CACHE_AGE) {
                sessionStorage.removeItem(PROFILE_CACHE_KEY)
                return null
            }

            return {
                ...parsed,
                ultimoLogin: parsed.ultimoLogin ? new Date(parsed.ultimoLogin) : null,
            }
        } catch {
            return null
        }
    }, [])

    /**
     * Limpiar caché del perfil
     */
    const clearProfileCache = useCallback(() => {
        sessionStorage.removeItem(PROFILE_CACHE_KEY)
    }, [])

    /**
     * Obtener perfil del usuario desde contactos (con caché)
     */
    const fetchUserProfile = useCallback(async (_authUserId: string, email: string) => {
        // 1. Intentar obtener desde caché
        const cachedProfile = getCachedProfile()
        if (cachedProfile && cachedProfile.email === email) {
            console.info('📦 Perfil obtenido desde caché')
            return cachedProfile
        }

        console.info('🔎 Buscando perfil en tabla usuarios_portal para:', email)
        try {
            // Timeout específico de 15s para no bloquear
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT_USUARIOS_PORTAL')), 15000)
            )

            const queryPromise = supabase
                .from('usuarios_portal')
                .select('identificacion, nombre_completo, email_institucional, rol, activo, last_sign_in_at')
                .eq('email_institucional', email)
                .single()

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: usuarioPortal } = await Promise.race([queryPromise, timeoutPromise]) as any

            // Si no hay usuario o está inactivo, generar un perfil básico
            if (!usuarioPortal) {
                console.warn('⚠️ No se encontró registro en "usuarios_portal" o timeout. Usando perfil básico.')
                const fallbackUser: AuthUser = {
                    identificacion: 'N/A',
                    nombreCompleto: email.split('@')[0],
                    email: email,
                    rol: 'operativo',
                    primerLogin: true,
                    ultimoLogin: null,
                }
                return fallbackUser
            }

            // Verificar si está activo
            if (!usuarioPortal.activo) {
                console.warn('⚠️ Usuario encontrado pero desactivado')
                return null // Forzar logout
            }

            console.info('✅ Perfil encontrado:', usuarioPortal.nombre_completo)

            // Usar la fecha recuperada de la BD (sesión anterior)
            const ultimoLogin = usuarioPortal.last_sign_in_at
                ? new Date(usuarioPortal.last_sign_in_at)
                : null

            const userProfile: AuthUser = {
                identificacion: usuarioPortal.identificacion,
                nombreCompleto: usuarioPortal.nombre_completo,
                email: usuarioPortal.email_institucional,
                rol: (usuarioPortal.rol || 'operativo') as any,
                primerLogin: true,
                ultimoLogin,
            }

            // Actualizar last_sign_in_at al tiempo actual (fire-and-forget)
            // Esto marca el inicio de la sesión ACTUAL, para que en la próxima sea la "anterior"
            supabase
                .from('usuarios_portal')
                .update({ last_sign_in_at: new Date().toISOString() })
                .eq('email_institucional', email)
                .then(({ error }) => {
                    if (error) {
                        // Ignorar error 403/42501 (permisos) para no ensuciar la consola, es secundario
                        if (error.code !== '42501') {
                            console.warn('⚠️ No se pudo actualizar last_sign_in_at:', error.message)
                        }
                    }
                })

            // Guardar en caché
            cacheProfile(userProfile)

            return userProfile
        } catch (err: any) {
            console.error('Error obteniendo perfil:', err)
            return null
        }
    }, [getCachedProfile, cacheProfile])

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

    // Escuchar cambios de autenticación de Supabase
    useEffect(() => {
        let mounted = true

        // Verificar sesión inicial
        const initSession = async () => {
            console.log('--- Iniciando verificación de sesión ---')

            // Failsafe: Si después de 20 segundos no responde, limpiar sesión y desbloquear
            const timeoutId = setTimeout(() => {
                if (mounted) {
                    console.error('⏰ TIMEOUT: Carga inicial excedida (20s). Posible sesión corrupta.')
                    console.warn('🧹 Limpiando almacenamiento local y forzando logout...')

                    // 1. Limpieza de emergencia del almacenamiento local
                    try {
                        localStorage.removeItem('gestar-auth-token')
                        // Intentar desconexión de Supabase (sin await para no bloquear)
                        supabase.auth.signOut().catch(err => console.error('Error en signOut forzado', err))
                    } catch (e) {
                        console.error('Error limpiando localStorage', e)
                    }

                    // 2. Desbloquear UI
                    setUser(null)
                    setIsLoading(false)
                }
            }, 20000)

            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession()

                if (sessionError) {
                    console.error('❌ Error al obtener sesión:', sessionError)
                    // Si hay error de sesión, asumimos logout
                    if (mounted) setUser(null)
                    return
                }

                if (session?.user) {
                    console.log('👤 Usuario autenticado detectado:', session.user.email)
                    const profile = await fetchUserProfile(
                        session.user.id,
                        session.user.email || ''
                    )

                    if (mounted) {
                        if (profile) {
                            setUser(profile)
                        } else {
                            // Fallback de emergencia
                            console.error('🆘 Error crítico: No se pudo obtener ni el perfil básico.')
                            setUser({
                                identificacion: 'Error',
                                nombreCompleto: session.user.email || 'Usuario',
                                email: session.user.email || '',
                                rol: 'operativo',
                                primerLogin: false,
                                ultimoLogin: new Date()
                            })
                        }
                    }
                } else {
                    console.log('ℹ️ No hay sesión activa')
                    if (mounted) setUser(null)
                }
            } catch (err) {
                console.error('💥 Error crítico inicializando sesión:', err)
            } finally {
                clearTimeout(timeoutId)
                if (mounted) {
                    console.log('🏁 Carga inicial finalizada')
                    setIsLoading(false)
                }
            }
        }

        initSession()

        // Suscribirse a cambios de auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return
                console.info('Auth state change:', event)

                if (event === 'SIGNED_IN' && session?.user) {
                    const profile = await fetchUserProfile(
                        session.user.id,
                        session.user.email || ''
                    )
                    if (mounted && profile) {
                        setUser(profile)
                    }
                } else if (event === 'SIGNED_OUT') {
                    console.info('🔒 Usuario desconectado')
                    clearProfileCache()
                    if (mounted) setUser(null)
                } else if (event === 'TOKEN_REFRESHED') {
                    console.info('🔄 Token de sesión renovado')
                } else if (event === 'USER_UPDATED') {
                    // Actualización de metadatos del usuario
                    console.info('👤 Datos de usuario actualizados')
                    if (session?.user && mounted) {
                        const profile = await fetchUserProfile(
                            session.user.id,
                            session.user.email || ''
                        )
                        if (profile) setUser(profile)
                    }
                } else if (event === 'INITIAL_SESSION') {
                    console.info('🚀 Sesión inicial cargada')
                }

                // IMPORTANTE: Cualquier cambio de estado debe desbloquear la pantalla de carga
                if (mounted) setIsLoading(false)
            }
        )

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [fetchUserProfile, clearProfileCache])

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



