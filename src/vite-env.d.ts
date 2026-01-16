/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_AIRTABLE_API_KEY: string
    readonly VITE_AIRTABLE_BASE_ID: string
    readonly VITE_AIRTABLE_TABLE_NAME: string
    readonly VITE_LOCKOUT_DURATION_MS: string
    readonly VITE_MAX_LOGIN_ATTEMPTS: string
    readonly VITE_SESSION_TIMEOUT_MS: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
