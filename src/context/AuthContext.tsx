/**
 * Contexto de Autenticación con Supabase Auth
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * VERSIÓN 6.0 - SESIÓN PERMANENTE (ESTRATEGIA "NO TOCAR, NO RECARGAR")
 * - JWT de 1 semana + refresh proactivo cada 2 horas
 * - Fetch interceptor PASIVO: reintenta 401 con token backup (supabase.config.ts)
 * - SIGNED_OUT espurios: se IGNORAN si el backup tiene JWT válido (check local)
 *   → NO se llama setSession() (causa MÁS SIGNED_OUT con tokens rotados)
 *   → NO se hace reload (causa pérdida de estado React)
 *   → El fetch interceptor ya mantiene los datos fluyendo con el token backup
 * - Backup se guarda SIEMPRE en SIGNED_IN y TOKEN_REFRESHED
 * - INITIAL_SESSION sin sesión: intenta backup antes de dar null
 * - Visibilitychange handler para refrescar al volver a la pestaña
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { supabase, isJwtValid } from '@/config/supabase.config'
import { AuthUser } from '@/types'

// ========================================
// CONSTANTES - SESIÓN PERSISTENTE
// ========================================
const PROFILE_CACHE_KEY = 'gestar-user-profile'
const SESSION_BACKUP_KEY = 'gestar-auth-backup' // Backup de tokens que supabase-js no toca
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000 // 24 horas de validez del caché
const GLOBAL_TIMEOUT_MS = 15000 // 15 segundos para consultas (conexiones lentas)
const FAILSAFE_TIMEOUT_MS = 10000 // 10 segundos timeout de seguridad
const PROACTIVE_REFRESH_MS = 2 * 60 * 60 * 1000 // 2 horas: refrescar token proactivamente
const BACKUP_MAX_AGE_MS = 6 * 24 * 60 * 60 * 1000 // 6 días (refresh_token dura 1 semana)

// Solo logs de advertencia/error en producción (los importantes para diagnóstico)
const log = {
    debug: (...args: unknown[]) => import.meta.env.DEV && console.info('[Auth]', ...args),
    warn: (...args: unknown[]) => console.warn('[Auth]', ...args),
    error: (...args: unknown[]) => console.error('[Auth]', ...args),
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
    const backgroundFetchDone = useRef(false)
    const intentionalLogout = useRef(false)
    const signedOutProcessing = useRef(false)

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

    const forceCleanSession = useCallback((reason: string = 'desconocido') => {
        log.warn(`Limpieza de sesión - Razón: ${reason}`)
        clearProfileCache()
        try { localStorage.removeItem(SESSION_BACKUP_KEY) } catch { /* silenciar */ }
        // NO llamar supabase.auth.signOut() aquí: si llegamos desde un SIGNED_OUT,
        // volver a llamar signOut dispara otro SIGNED_OUT → loop infinito.
        // Solo limpiamos estado local; Supabase ya sabe que la sesión terminó.
        setUser(null)
        setIsLoading(false)
        processingAuth.current = false
        initializationComplete.current = true
    }, [clearProfileCache])

    // ========================================
    // VERIFICACIÓN LOCAL DE BACKUP JWT
    // ========================================

    /**
     * Verifica localmente si el backup de localStorage tiene un JWT no-expirado.
     * NO hace ninguna llamada al servidor. NO llama setSession().
     * Usado por el handler SIGNED_OUT para decidir si ignorar el evento.
     */
    const isBackupJwtValid = useCallback((): boolean => {
        try {
            const backup = localStorage.getItem(SESSION_BACKUP_KEY)
            if (!backup) return false

            const { access_token, saved_at } = JSON.parse(backup)
            if (!access_token) return false

            // Backup demasiado viejo → descartar
            if (saved_at && Date.now() - saved_at > BACKUP_MAX_AGE_MS) {
                log.warn('Backup de tokens expirado (>6 días), descartando')
                localStorage.removeItem(SESSION_BACKUP_KEY)
                return false
            }

            return isJwtValid(access_token)
        } catch {
            return false
        }
    }, [])

    /**
     * Restaura sesión desde backup llamando setSession().
     * SOLO se usa en INITIAL_SESSION (carga inicial), NUNCA en SIGNED_OUT.
     */
    const tryRestoreFromBackup = useCallback(async (): Promise<{ access_token: string; refresh_token: string; user: { email?: string } } | null> => {
        try {
            const backup = localStorage.getItem(SESSION_BACKUP_KEY)
            if (!backup) return null

            const { access_token, refresh_token, saved_at } = JSON.parse(backup)
            if (!access_token || !refresh_token) return null

            if (saved_at && Date.now() - saved_at > BACKUP_MAX_AGE_MS) {
                log.warn('Backup de tokens expirado (>6 días), descartando')
                localStorage.removeItem(SESSION_BACKUP_KEY)
                return null
            }

            const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
            if (data?.session && !error) {
                try {
                    localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify({
                        access_token: data.session.access_token,
                        refresh_token: data.session.refresh_token,
                        saved_at: Date.now()
                    }))
                } catch { /* silenciar */ }
                return data.session
            }
        } catch { /* continuar */ }
        return null
    }, [])

    // ========================================
    // OBTENCIÓN DE PERFIL (FAIL-FAST)
    // ========================================

    const fetchProfileFast = useCallback(async (email: string): Promise<AuthUser | null> => {
        const startTime = performance.now()
        log.debug('Obteniendo perfil para:', email)

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
                        log.debug('RPC respondió primero')
                    }
                    return userData
                })

            const queryPromise = supabase
                .from('usuarios_portal')
                .select('identificacion, nombre_completo, email_institucional, rol, activo, last_sign_in_at')
                .ilike('email_institucional', email)
                .single()
                .then(({ data, error }) => {
                    if (error) throw error
                    if (!data) throw new Error('QUERY_NO_DATA')
                    if (!resolved) {
                        resolved = true
                        log.debug('Query directa respondió primero')
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

            log.debug(`Perfil obtenido en ${duration.toFixed(0)}ms`)
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
        log.warn('Cerrando sesión intencionalmente')
        intentionalLogout.current = true
        clearProfileCache()
        try { localStorage.removeItem(SESSION_BACKUP_KEY) } catch { /* silenciar */ }
        setUser(null)
        setIsLoading(false)
        initializationComplete.current = false
        processingAuth.current = false
        backgroundFetchDone.current = false
        try {
            await supabase.auth.signOut()
        } catch {
            // Ignorar errores de signOut - el estado local ya está limpio
        }
        // Forzar navegación completa (no SPA) para que el navegador descargue
        // el index.html más reciente desde el servidor, con los chunks actualizados.
        // Esto resuelve el problema de caché en móvil tras nuevos deployments.
        window.location.href = '/login'
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
                log.warn(`SAFETY TIMEOUT activado después de ${FAILSAFE_TIMEOUT_MS}ms - isLoading aún true`)
                const fallbackProfile = getCachedProfile()
                if (fallbackProfile) {
                    log.debug('Timeout alcanzado - usando caché de respaldo')
                    setUser(fallbackProfile)
                    setIsLoading(false)
                    initializationComplete.current = true
                    processingAuth.current = false
                } else {
                    forceCleanSession('SAFETY_TIMEOUT sin caché')
                }
            }
        }, FAILSAFE_TIMEOUT_MS)

        const handleAuthSession = async (session: { user?: { email?: string } } | null, eventType: string) => {
            if (!mounted) return

            // Evitar procesamiento concurrente
            if (processingAuth.current) {
                log.debug(`[${eventType}] Procesamiento en curso, omitiendo...`)
                return
            }

            processingAuth.current = true
            const email = session?.user?.email

            try {
                // ===== CASO 1: Hay sesión válida =====
                if (session?.user && email) {
                    log.debug(`[${eventType}] Sesión detectada: ${email}`)

                    // Intentar caché primero (instantáneo)
                    const cachedProfile = getCachedProfile(email)
                    if (cachedProfile) {
                        log.debug('Usando perfil cacheado')
                        setUser(cachedProfile)
                        userRef.current = cachedProfile
                        setIsLoading(false)
                        initializationComplete.current = true
                        processingAuth.current = false

                        // Actualizar en background UNA SOLA VEZ
                        if (!backgroundFetchDone.current) {
                            backgroundFetchDone.current = true
                            fetchProfileFast(email).then(freshProfile => {
                                if (mounted && freshProfile) {
                                    setUser(freshProfile)
                                    userRef.current = freshProfile
                                    cacheProfile(freshProfile)
                                    log.debug('Perfil actualizado en background')
                                }
                            }).catch(() => {
                                // Silencioso - mantener caché
                            })
                        }

                        return
                    }

                    // Sin caché: obtener perfil
                    log.debug('Sin caché, obteniendo perfil...')
                    const profile = await fetchProfileFast(email)

                    if (!mounted) return

                    if (profile) {
                        log.debug('Autenticación exitosa:', profile.nombreCompleto)
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
                    log.debug(`[${eventType}] Sin sesión activa`)
                    setUser(null)
                    userRef.current = null
                    setIsLoading(false)
                    initializationComplete.current = true
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error)
                log.error('Error en handleAuthSession:', errorMsg)
                forceCleanSession(`ERROR en handleAuthSession: ${errorMsg}`)
            } finally {
                processingAuth.current = false
            }
        }

        // Suscribirse a cambios de auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return

                log.debug(`Auth event: ${event}`)
                clearTimeout(safetyTimeout)

                switch (event) {
                    case 'INITIAL_SESSION':
                    case 'SIGNED_IN':
                        // SIEMPRE guardar backup de tokens cuando disponibles.
                        // IMPORTANTE: esto va ANTES del check initializationComplete porque
                        // SIGNED_IN del login ocurre DESPUÉS de INITIAL_SESSION (que ya puso
                        // initializationComplete=true). Sin este fix, el backup nunca se guardaba
                        // y la primera sesión post-login no tenía respaldo.
                        if (session?.access_token && session?.refresh_token) {
                            try {
                                localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify({
                                    access_token: session.access_token,
                                    refresh_token: session.refresh_token,
                                    saved_at: Date.now()
                                }))
                            } catch { /* silenciar */ }
                        }

                        // Solo procesar perfil UNA VEZ - el primero que llegue gana
                        if (initializationComplete.current) {
                            log.debug(`${event} ignorado - ya inicializado (backup actualizado)`)
                            return
                        }

                        // Si no hay sesión en INITIAL_SESSION, intentar restaurar desde backup
                        // (puede pasar tras reload post-SIGNED_OUT si supabase-js perdió el storage)
                        if (!session && event === 'INITIAL_SESSION') {
                            log.debug('INITIAL_SESSION sin sesión - intentando backup...')
                            const restoredSession = await tryRestoreFromBackup()
                            if (restoredSession) {
                                log.debug('Sesión restaurada desde backup en INITIAL_SESSION')
                                await handleAuthSession(restoredSession, 'INITIAL_SESSION_RESTORED')
                                break
                            }
                            log.debug('Sin backup válido - continuando sin sesión')
                        }

                        await handleAuthSession(session, event)
                        break

                    case 'SIGNED_OUT': {
                        // Si el logout fue intencional (desde logout()), ignorar
                        if (intentionalLogout.current) {
                            intentionalLogout.current = false
                            log.debug('SIGNED_OUT intencional - estado limpio')
                            break
                        }

                        // Guard: ignorar SIGNED_OUT duplicados/en cascada.
                        // NO resetear a false: una vez procesado, cualquier SIGNED_OUT
                        // posterior del mismo ciclo se ignora.
                        if (signedOutProcessing.current) break
                        signedOutProcessing.current = true

                        if (isBackupJwtValid()) {
                            log.debug('SIGNED_OUT ignorado - backup JWT válido')
                        } else {
                            log.debug('SIGNED_OUT - sesión expirada, limpiando estado local')
                            forceCleanSession('sesión expirada')
                        }

                        // Resetear guard después de un delay para ignorar
                        // SIGNED_OUT en cascada que lleguen via BroadcastChannel
                        setTimeout(() => { signedOutProcessing.current = false }, 2000)
                        break
                    }

                    case 'TOKEN_REFRESHED':
                        // Guardar backup actualizado de tokens
                        if (session?.access_token && session?.refresh_token) {
                            try {
                                localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify({
                                    access_token: session.access_token,
                                    refresh_token: session.refresh_token,
                                    saved_at: Date.now()
                                }))
                            } catch { /* silenciar */ }
                        }
                        // Extender el caché del perfil cuando el token se renueva
                        if (userRef.current) {
                            cacheProfile(userRef.current)
                            log.debug('Token renovado - caché extendido')
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

    // ========================================
    // REFRESH PROACTIVO DE TOKEN
    // ========================================
    // Refresca el token cada 2 horas para que NUNCA expire.
    // También refresca al volver a la pestaña si han pasado más de 2 horas.

    useEffect(() => {
        if (!user) return

        let lastRefresh = Date.now()

        const doRefresh = async () => {
            try {
                const { data, error } = await supabase.auth.refreshSession()
                if (error) {
                    // El refresh falló pero NO es crítico: el JWT dura 1 semana
                    // y el fetch interceptor usa el backup. No hacer nada drástico.
                    log.debug('Refresh proactivo falló (no crítico):', error.message)
                    return
                }
                if (data?.session) {
                    try {
                        localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify({
                            access_token: data.session.access_token,
                            refresh_token: data.session.refresh_token,
                            saved_at: Date.now()
                        }))
                    } catch { /* silenciar */ }
                    lastRefresh = Date.now()
                    log.debug('Token refrescado proactivamente')
                }
            } catch {
                // Error de red u otro - no crítico
                log.debug('Refresh proactivo: error de red (no crítico)')
            }
        }

        // Timer regular cada 2 horas
        const intervalId = setInterval(doRefresh, PROACTIVE_REFRESH_MS)

        // Al volver a la pestaña, refrescar si pasaron más de 2 horas
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && Date.now() - lastRefresh > PROACTIVE_REFRESH_MS) {
                doRefresh()
            }
        }
        document.addEventListener('visibilitychange', handleVisibility)

        return () => {
            clearInterval(intervalId)
            document.removeEventListener('visibilitychange', handleVisibility)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [!!user]) // Solo reaccionar a cambios autenticado/no-autenticado

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
