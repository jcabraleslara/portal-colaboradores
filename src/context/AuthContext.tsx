/**
 * Contexto de Autenticación con Supabase Auth
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Usa el sistema nativo de sesiones de Supabase
 * con auto-refresh y persistencia automática.
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
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
            // Timeout específico de 30s para no bloquear
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT_USUARIOS_PORTAL')), 30000)
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
            // Actualizar last_sign_in_at usando RPC seguro (bypassea RLS estricto)
            supabase
                .rpc('update_last_login', { user_email: email })
                .then(({ error }) => {
                    if (error) console.warn('⚠️ Error actualizando fecha de acceso:', error.message)
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

    // Ref para evitar bucles y re-ejecuciones innecesarias
    const lastProcessedEmail = useRef<string | null>(null)

    // Escuchar cambios de autenticación de Supabase
    useEffect(() => {
        let mounted = true

        // Failsafe: Si después de 30 segundos no hay respuesta del listener de auth
        const timeoutId = setTimeout(() => {
            if (mounted) {
                setIsLoading(false)
            }
        }, 30000)

        // Suscribirse a cambios de auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return
                console.info('Auth state change:', event)

                const currentEmail = session?.user?.email || null

                // IMPORTANTE: Manejar sesión inicial y login
                if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {

                    // Si ya procesamos este email, no hacer nada (evita bucles por re-renders del context)
                    if (lastProcessedEmail.current === currentEmail) {
                        setIsLoading(false)
                        return
                    }

                    console.log('👤 Usuario detectado (Event:', event, '):', currentEmail)
                    lastProcessedEmail.current = currentEmail

                    const profile = await fetchUserProfile(
                        session.user.id,
                        currentEmail || ''
                    )

                    if (mounted) {
                        if (profile) {
                            setUser(profile)
                        } else {
                            // Fallback básico si falla la búsqueda pero hay sesión
                            setUser({
                                identificacion: 'N/A',
                                nombreCompleto: currentEmail?.split('@')[0] || 'Usuario',
                                email: currentEmail || '',
                                rol: 'operativo',
                                primerLogin: true,
                                ultimoLogin: null
                            })
                        }
                    }
                } else if (event === 'SIGNED_OUT') {
                    console.info('🔒 Usuario desconectado')
                    lastProcessedEmail.current = null
                    clearProfileCache()
                    if (mounted) setUser(null)
                } else if (event === 'TOKEN_REFRESHED') {
                    console.info('🔄 Token de sesión renovado')
                } else if (event === 'USER_UPDATED') {
                    console.info('👤 Datos de usuario actualizados')
                    if (session?.user && mounted) {
                        const profile = await fetchUserProfile(
                            session.user.id,
                            currentEmail || ''
                        )
                        if (profile) setUser(profile)
                    }
                }

                // Finalizar carga inicial una vez procesado el evento de sesión
                if (mounted && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT')) {
                    clearTimeout(timeoutId)
                    setIsLoading(false)
                }
            }
        )

        return () => {
            mounted = false
            clearTimeout(timeoutId)
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



