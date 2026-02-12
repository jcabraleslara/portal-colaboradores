/**
 * Configuración del cliente Supabase
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * VERSIÓN 4.0 - FETCH INTERCEPTOR PROACTIVO + REACTIVO
 * - PROACTIVO: Antes de cada request, si supabase-js perdió la sesión (usa anon key
 *   como bearer), inyecta el JWT del backup de localStorage. Esto evita que PostgREST
 *   devuelva datos vacíos por RLS (200 + array vacío, no 401).
 * - REACTIVO: Si aún así llega un 401, reintenta con el token del backup.
 * - NUNCA llama refreshSession()/setSession()/getSession() para evitar cascadas SIGNED_OUT.
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

/**
 * Lock no-op: bypassa navigator.locks completamente.
 * navigator.locks causa deadlock (AbortError) que bloquea initialize() de supabase-js.
 * La coordinación cross-tab de tokens no es necesaria para este portal de uso individual.
 */
async function noOpLock<R>(
    _name: string,
    _acquireTimeout: number,
    fn: () => Promise<R>
): Promise<R> {
    return await fn()
}

// Singleton
let supabaseInstance: SupabaseClient | null = null

/**
 * Verifica localmente si un JWT no ha expirado.
 * Requiere al menos 30s de validez restante.
 */
export function isJwtValid(token: string): boolean {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        return typeof payload.exp === 'number' && payload.exp > Date.now() / 1000 + 30
    } catch {
        return false
    }
}

/**
 * Obtiene el access_token del backup si es válido.
 */
function getBackupAccessToken(): string | null {
    try {
        const backup = localStorage.getItem(SESSION_BACKUP_KEY)
        if (!backup) return null
        const { access_token } = JSON.parse(backup)
        if (access_token && isJwtValid(access_token)) return access_token
    } catch { /* silenciar */ }
    return null
}

/**
 * Fetch interceptor PROACTIVO + REACTIVO.
 *
 * CAPA 1 - PROACTIVA (antes del request):
 *   Cuando supabase-js pierde la sesión (SIGNED_OUT espurio), usa la anon key
 *   como Authorization bearer. PostgREST la acepta (es JWT válido) pero aplica
 *   RLS para rol `anon` → devuelve 200 + arrays vacíos (NO 401).
 *   El interceptor detecta esto (Authorization === Bearer <anonKey>) y reemplaza
 *   con el JWT del backup ANTES de enviar el request. Así los datos fluyen.
 *
 * CAPA 2 - REACTIVA (después del request):
 *   Si aún así llega un 401 (token expirado entre check y request), reintenta
 *   con el token del backup.
 *
 * NUNCA llama refreshSession()/setSession()/getSession() para evitar cascadas.
 */
const authRetryFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const isAuthEndpoint = url.includes('/auth/v1/')

    // ── CAPA 1: PROACTIVA ──
    // Si supabase-js cayó a anon key (perdió sesión), inyectar JWT del backup
    if (!isAuthEndpoint) {
        try {
            const headers = new Headers(init?.headers)
            const currentAuth = headers.get('Authorization')

            // Detectar si supabase-js está usando la anon key como bearer
            if (currentAuth === `Bearer ${supabaseAnonKey}`) {
                const backupToken = getBackupAccessToken()
                if (backupToken) {
                    headers.set('Authorization', `Bearer ${backupToken}`)
                    init = { ...init, headers }
                }
            }
        } catch { /* silenciar - continuar con headers originales */ }
    }

    const response = await fetch(input, init)

    // ── CAPA 2: REACTIVA ──
    // Si llega 401 en endpoints no-auth, reintentar con backup
    if (response.status === 401 && !isAuthEndpoint) {
        try {
            const backupToken = getBackupAccessToken()
            if (backupToken) {
                const retryHeaders = new Headers(init?.headers)
                retryHeaders.set('Authorization', `Bearer ${backupToken}`)
                retryHeaders.set('apikey', supabaseAnonKey)
                return fetch(input, { ...init, headers: retryHeaders })
            }
        } catch { /* silenciar - devolver 401 original */ }
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
                lock: noOpLock,
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
