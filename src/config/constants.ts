/**
 * Constantes globales del Portal de Colaboradores
 * GESTAR SALUD IPS
 */

// ========================================
// RUTAS DE NAVEGACIÓN
// ========================================
export const ROUTES = {
    LOGIN: '/login',
    DASHBOARD: '/',
    VALIDACION_DERECHOS: '/validacion-derechos',
    RADICACION_CASOS: '/radicacion-casos',
    GESTION_BACK: '/gestion-back',
    DIRECTORIO_INSTITUCIONAL: '/directorio-institucional',
    // Módulos futuros (placeholders)
    SOPORTES_FACTURACION: '/soportes-facturacion',
    ANEXO_8: '/anexo-8',
    TRIANGULACIONES: '/triangulaciones',
    RUTAS: '/rutas',
    DEMANDA_INDUCIDA: '/demanda-inducida',
} as const

// ========================================
// CONFIGURACIÓN DE SEGURIDAD
// ========================================
export const SECURITY = {
    // Máximo de intentos de login antes de bloqueo
    MAX_LOGIN_ATTEMPTS: Number(import.meta.env.VITE_MAX_LOGIN_ATTEMPTS) || 5,
    // Duración del bloqueo en milisegundos (15 minutos por defecto)
    LOCKOUT_DURATION_MS: Number(import.meta.env.VITE_LOCKOUT_DURATION_MS) || 900000,
    // Timeout de sesión por inactividad (30 minutos)
    SESSION_TIMEOUT_MS: Number(import.meta.env.VITE_SESSION_TIMEOUT_MS) || 3600000,
    // Clave para localStorage (debe coincidir con supabase.config.ts storageKey)
    AUTH_STORAGE_KEY: 'gestar-auth-token',
    // Requisitos de contraseña
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_REQUIRES_UPPERCASE: true,
    PASSWORD_REQUIRES_NUMBER: true,
} as const

// ========================================
// CONFIGURACIÓN DE UI
// ========================================
export const UI = {
    // Debounce para búsquedas (ms)
    SEARCH_DEBOUNCE_MS: 300,
    // Máximo de resultados por página
    PAGE_SIZE: 50,
    // Duración de animaciones (ms)
    ANIMATION_DURATION_MS: 200,
    // Toast notification duration
    TOAST_DURATION_MS: 5000,
} as const

// ========================================
// MENSAJES DE ERROR
// ========================================
export const ERROR_MESSAGES = {
    INVALID_CREDENTIALS: 'Identificación o contraseña incorrectas',
    ACCOUNT_LOCKED: 'Cuenta bloqueada temporalmente por múltiples intentos fallidos',
    ACCOUNT_INACTIVE: 'Tu cuenta está desactivada. Contacta al administrador',
    SESSION_EXPIRED: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente',
    NETWORK_ERROR: 'Error de conexión. Verifica tu conexión a internet',
    SERVER_ERROR: 'Error del servidor. Intenta más tarde',
    AFILIADO_NOT_FOUND: 'No se encontró ningún afiliado con ese documento',
    REQUIRED_FIELD: 'Este campo es requerido',
    INVALID_DOCUMENT: 'Documento inválido. Ingresa solo números',
    PASSWORD_TOO_SHORT: `La contraseña debe tener al menos ${8} caracteres`,
    PASSWORD_NEEDS_UPPERCASE: 'La contraseña debe contener al menos una mayúscula',
    PASSWORD_NEEDS_NUMBER: 'La contraseña debe contener al menos un número',
    PASSWORDS_DONT_MATCH: 'Las contraseñas no coinciden',
} as const

// ========================================
// CONFIGURACIÓN AIRTABLE
// ========================================
export const AIRTABLE = {
    API_KEY: import.meta.env.VITE_AIRTABLE_API_KEY || '',
    BASE_ID: import.meta.env.VITE_AIRTABLE_BASE_ID || '',
    TABLE_NAME: import.meta.env.VITE_AIRTABLE_TABLE_NAME || 'Solicitudes',
    API_URL: 'https://api.airtable.com/v0',
} as const

// ========================================
// ROLES DE USUARIO
// ========================================
export const USER_ROLES = {
    ADMINISTRADOR: 'administrador',
    ASISTENCIAL: 'asistencial',
    OPERATIVO: 'operativo',
    EXTERNO: 'externo',
} as const

// ========================================
// MÓDULOS DEL PORTAL
// ========================================
export interface ModuleConfig {
    id: string
    name: string
    path: string
    icon: string
    enabled: boolean
    description?: string
}

export const PORTAL_MODULES: ModuleConfig[] = [
    {
        id: 'validacion-derechos',
        name: 'Validación de Derechos',
        path: ROUTES.VALIDACION_DERECHOS,
        icon: 'Search',
        enabled: true,
        description: 'Consultar estado y datos de afiliados',
    },
    {
        id: 'radicacion-casos',
        name: 'Radicación de Casos',
        path: ROUTES.RADICACION_CASOS,
        icon: 'ClipboardList',
        enabled: true,
        description: 'Radicar casos y solicitudes',
    },
    {
        id: 'gestion-back',
        name: 'Gestión Back y Auditoría',
        path: ROUTES.GESTION_BACK,
        icon: 'ClipboardCheck',
        enabled: true,
        description: 'Gestionar casos del Back Office',
    },
    {
        id: 'directorio-institucional',
        name: 'Directorio Institucional',
        path: ROUTES.DIRECTORIO_INSTITUCIONAL,
        icon: 'Contact',
        enabled: true,
        description: 'Contactos institucionales',
    },
    {
        id: 'soportes-facturacion',
        name: 'Soportes de Facturación',
        path: ROUTES.SOPORTES_FACTURACION,
        icon: 'FileText',
        enabled: false,
        description: 'En planeación',
    },
    {
        id: 'anexo-8',
        name: 'Generar Anexo 8',
        path: ROUTES.ANEXO_8,
        icon: 'FileSpreadsheet',
        enabled: false,
        description: 'En planeación',
    },
    {
        id: 'triangulaciones',
        name: 'Gestión de Triangulaciones',
        path: ROUTES.TRIANGULACIONES,
        icon: 'RefreshCw',
        enabled: false,
        description: 'En planeación',
    },
    {
        id: 'rutas',
        name: 'Gestión de Rutas',
        path: ROUTES.RUTAS,
        icon: 'Car',
        enabled: false,
        description: 'En planeación',
    },
    {
        id: 'demanda-inducida',
        name: 'Demanda Inducida',
        path: ROUTES.DEMANDA_INDUCIDA,
        icon: 'BarChart3',
        enabled: false,
        description: 'En planeación',
    },
]
