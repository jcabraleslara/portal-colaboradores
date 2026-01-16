/**
 * Configuración del cliente Supabase
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Cliente singleton para conexión a Supabase con Auth habilitado.
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

// Cliente singleton
let supabaseInstance: SupabaseClient | null = null

/**
 * Obtener instancia del cliente Supabase
 */
export function getSupabaseClient(): SupabaseClient {
    if (!supabaseInstance) {
        supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                // Habilitar persistencia automática de sesión
                persistSession: true,
                // Almacenar en localStorage
                storageKey: 'gestar-auth-token',
                // Auto-refresh de tokens
                autoRefreshToken: true,
                // Detectar sesión en otras pestañas
                detectSessionInUrl: true,
            },
            global: {
                headers: { 'x-application-name': 'portal-colaboradores' }
            }
        })
    }
    return supabaseInstance
}

// Exportar instancia para uso directo
export const supabase = getSupabaseClient()

export default supabase
