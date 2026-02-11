/**
 * Configuración del cliente Supabase
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * VERSIÓN 3.0 - FETCH INTERCEPTOR PASIVO
 * - El interceptor NUNCA llama métodos de supabase.auth (refreshSession/setSession)
 *   porque esos métodos disparan eventos SIGNED_OUT que cascadean con AuthContext.
 * - En 401: solo reintenta con el access_token del backup de localStorage.
 * - AuthContext es el ÚNICO responsable de restaurar sesiones (vía SIGNED_OUT handler).
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

/**
 * Verifica localmente si un JWT no ha expirado.
 * Requiere al menos 30s de validez restante.
 */
function isJwtValid(token: string): boolean {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        return typeof payload.exp === 'number' && payload.exp > Date.now() / 1000 + 30
    } catch {
        return false
    }
}

/**
 * Fetch interceptor PASIVO: reintenta 401 usando el token del backup.
 *
 * IMPORTANTE: NO llama refreshSession()/setSession()/getSession().
 * Esos métodos modifican el estado interno de supabase-js y disparan
 * eventos SIGNED_OUT que cascadean con el handler de AuthContext,
 * causando loops infinitos y cierre de sesión involuntario.
 *
 * Solo lee el backup de localStorage y usa el access_token directamente
 * como header HTTP. Si el token del backup es válido, el retry funciona.
 * Si no, devuelve el 401 original y deja que el flujo normal lo maneje.
 */
const authRetryFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, init)

    // Solo interceptar 401 en endpoints que NO sean auth
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (response.status !== 401 || url.includes('/auth/v1/')) {
        return response
    }

    // Reintento pasivo: usar token del backup sin tocar supabase.auth
    try {
        const backup = localStorage.getItem(SESSION_BACKUP_KEY)
        if (backup) {
            const { access_token } = JSON.parse(backup)
            if (access_token && isJwtValid(access_token)) {
                const retryHeaders = new Headers(init?.headers)
                retryHeaders.set('Authorization', `Bearer ${access_token}`)
                retryHeaders.set('apikey', supabaseAnonKey)
                return fetch(input, { ...init, headers: retryHeaders })
            }
        }
    } catch { /* silenciar - devolver 401 original */ }

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
