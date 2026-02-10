/**
 * Configuración del cliente Supabase
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * VERSIÓN 2.0 - SESIÓN BLINDADA
 * - Fetch interceptor: auto-retry transparente en 401 para TODAS las API calls
 * - Restaura sesión desde backup de tokens cuando supabase-js pierde el estado
 * - Promise compartida para evitar refreshes concurrentes
 * - Los endpoints /auth/v1/ están excluidos para evitar loops
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Validar variables de entorno
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Faltan variables de entorno de Supabase. ' +
        'Asegúrate de configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local'
    )
}

// Clave para backup de tokens (compartida con AuthContext)
const SESSION_BACKUP_KEY = 'gestar-auth-backup'

// Singleton
let supabaseInstance: SupabaseClient | null = null

// Promise compartida para evitar refreshes concurrentes
let refreshPromise: Promise<string | null> | null = null

/**
 * Guarda tokens de sesión como backup en localStorage
 */
function updateBackup(session: { access_token: string; refresh_token: string }) {
    try {
        localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            saved_at: Date.now()
        }))
    } catch { /* silenciar */ }
}

/**
 * Intenta refrescar la sesión. Si hay un refresh en curso, espera ese resultado.
 * Retorna el access_token fresco o null si no se pudo refrescar.
 */
async function ensureFreshSession(): Promise<string | null> {
    if (refreshPromise) return refreshPromise

    refreshPromise = (async () => {
        // Intento 1: refreshSession estándar (usa estado interno de supabase-js)
        try {
            const { data } = await supabaseInstance!.auth.refreshSession()
            if (data?.session) {
                updateBackup(data.session)
                return data.session.access_token
            }
        } catch { /* continuar */ }

        // Intento 2: restaurar desde backup (tokens guardados por AuthContext)
        try {
            const backup = localStorage.getItem(SESSION_BACKUP_KEY)
            if (backup) {
                const { access_token, refresh_token } = JSON.parse(backup)
                if (access_token && refresh_token) {
                    const { data } = await supabaseInstance!.auth.setSession({
                        access_token,
                        refresh_token
                    })
                    if (data?.session) {
                        updateBackup(data.session)
                        return data.session.access_token
                    }
                }
            }
        } catch { /* continuar */ }

        return null
    })()

    const token = await refreshPromise
    // Limpiar después de 1s para que requests cercanos compartan el resultado
    setTimeout(() => { refreshPromise = null }, 1000)
    return token
}

/**
 * Fetch interceptor: auto-retry transparente en 401.
 * Cuando cualquier API call falla por token expirado, refresca la sesión
 * y reintenta automáticamente. Endpoints de auth excluidos para evitar loops.
 */
const authRetryFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, init)

    // Solo interceptar 401 en endpoints no-auth
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (response.status !== 401 || url.includes('/auth/v1/')) {
        return response
    }

    // Intentar refrescar sesión y reintentar el request original
    const freshToken = await ensureFreshSession()
    if (freshToken) {
        const retryHeaders = new Headers(init?.headers)
        retryHeaders.set('Authorization', `Bearer ${freshToken}`)
        return fetch(input, { ...init, headers: retryHeaders })
    }

    return response
}

/**
 * Obtener instancia del cliente Supabase
 */
export function getSupabaseClient(): SupabaseClient {
    if (!supabaseInstance) {
        supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,
                storageKey: 'gestar-auth-token',
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
            global: {
                headers: { 'x-application-name': 'portal-colaboradores' },
                fetch: authRetryFetch,
            }
        })
    }
    return supabaseInstance
}

// Exportar instancia para uso directo
export const supabase = getSupabaseClient()

export default supabase
