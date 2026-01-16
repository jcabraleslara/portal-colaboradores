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

        console.info('🔎 Buscando perfil en tabla contactos para:', email)
        try {
            // Timeout específico de 5s para no bloquear
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT_CONTACTOS')), 5000)
            )

            const queryPromise = supabase
                .from('contactos')
                .select('identificacion, primer_nombre, segundo_nombre, apellidos, email, rol, last_sign_in_at')
                .eq('email', email)
                .single()

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: contacto } = await Promise.race([queryPromise, timeoutPromise]) as any

            // Si no hay contacto, generar un perfil básico
            if (!contacto) {
                console.warn('⚠️ No se encontró registro en "contactos" o timeout. Usando perfil básico.')
                const fallbackUser: AuthUser = {
                    identificacion: 'N/A',
                    nombreCompleto: email.split('@')[0],
                    email: email,
                    rol: 'operativo',
                    primerLogin: true,
                    ultimoLogin: null, // No tenemos history
                }
                return fallbackUser
            }

            console.info('✅ Perfil encontrado:', contacto.primer_nombre)

            const nombreCompleto = [
                contacto.primer_nombre,
                contacto.segundo_nombre,
                contacto.apellidos,
            ].filter(Boolean).join(' ')

            // Usar la fecha recuperada de la BD (sesión anterior)
            const ultimoLogin = contacto.last_sign_in_at
                ? new Date(contacto.last_sign_in_at)
                : null

            const userProfile: AuthUser = {
                identificacion: contacto.identificacion,
                nombreCompleto,
                email: contacto.email,
                rol: (contacto.rol || 'operativo') as any,
                primerLogin: true,
                ultimoLogin,
            }

            // Actualizar last_sign_in_at al tiempo actual (fire-and-forget)
            // Esto marca el inicio de la sesión ACTUAL, para que en la próxima sea la "anterior"
            supabase
                .from('contactos')
                .update({ last_sign_in_at: new Date().toISOString() })
                .eq('email', email)
                .then(({ error }) => {
                    if (error) console.error('Error actualizando last_sign_in_at:', error)
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

            // Failsafe: Si después de 8 segundos no responde, limpiar sesión y desbloquear
            const timeoutId = setTimeout(() => {
                if (mounted) {
                    console.error('⏰ TIMEOUT: Carga inicial excedida. Posible sesión corrupta.')
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
            }, 8000)

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



