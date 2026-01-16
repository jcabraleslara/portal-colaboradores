/**
 * Tipos globales para el Portal de Colaboradores
 * GESTAR SALUD IPS
 */

// Tipo de rol definido localmente para evitar problemas con isolatedModules
export type UserRole = 'administrador' | 'asistencial' | 'operativo' | 'externo'

// ========================================
// TIPOS DE AUTENTICACIÓN
// ========================================

/**
 * Usuario autenticado en el portal
 */
export interface AuthUser {
    identificacion: string
    nombreCompleto: string
    email: string | null
    rol: UserRole
    primerLogin: boolean
    ultimoLogin: Date | null
}

/**
 * Sesión almacenada en localStorage
 */
export interface StoredSession {
    user: AuthUser
    expiresAt: number // Timestamp
    createdAt: number
}

/**
 * Respuesta del servicio de login
 */
export interface LoginResult {
    success: boolean
    user?: AuthUser
    requiresPasswordChange?: boolean
    error?: string
    remainingAttempts?: number
    lockedUntil?: Date
}

/**
 * Credenciales de login
 */
export interface LoginCredentials {
    identificacion: string
    password: string
}

/**
 * Datos para cambio de contraseña
 */
export interface ChangePasswordData {
    currentPassword: string
    newPassword: string
    confirmPassword: string
}

// ========================================
// TIPOS DE AFILIADOS
// ========================================

/**
 * Afiliado de la BD - todos los 22 campos
 */
export interface Afiliado {
    tipoId: string | null
    id: string | null
    apellido1: string | null
    apellido2: string | null
    nombres: string | null
    sexo: string | null
    direccion: string | null
    telefono: string | null
    fechaNacimiento: Date | null
    estado: string | null
    municipio: string | null
    observaciones: string | null
    ipsPrimaria: string | null
    tipoCotizante: string | null
    departamento: string | null
    rango: string | null
    email: string | null
    regimen: string | null
    edad: number | null
    eps: string | null
    fuente: string | null
    busquedaTexto: string | null
}

/**
 * Respuesta de la API de DB para afiliados (snake_case)
 */
export interface AfiliadoRaw {
    tipo_id: string | null
    id: string | null
    apellido1: string | null
    apellido2: string | null
    nombres: string | null
    sexo: string | null
    direccion: string | null
    telefono: string | null
    fecha_nacimiento: string | null
    estado: string | null
    municipio: string | null
    observaciones: string | null
    ips_primaria: string | null
    tipo_cotizante: string | null
    departamento: string | null
    rango: string | null
    email: string | null
    regimen: string | null
    edad: number | null
    eps: string | null
    fuente: string | null
    busqueda_texto: string | null
}

// ========================================
// TIPOS DE RADICACIÓN
// ========================================

/**
 * Datos para radicar un caso en Airtable
 */
export interface RadicacionData {
    // Datos del afiliado (read-only)
    documentoAfiliado: string
    nombreAfiliado: string
    eps: string | null
    regimen: string | null

    // Datos de la radicación (editable)
    tipoSolicitud: TipoSolicitud
    descripcion: string
    prioridad: Prioridad
    fechaSolicitud: Date
    observaciones?: string

    // Metadata
    radicadoPor: string
}

export type TipoSolicitud =
    | 'autorizacion'
    | 'referencia'
    | 'queja'
    | 'peticion'
    | 'reclamo'
    | 'otro'

export type Prioridad = 'baja' | 'media' | 'alta' | 'urgente'

// ========================================
// TIPOS DE RESPUESTA API
// ========================================

export interface ApiResponse<T> {
    success: boolean
    data?: T
    error?: string
    message?: string
}

// ========================================
// TIPOS DE UI
// ========================================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface AlertState {
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
    visible: boolean
}

// Re-export tipos del módulo Back
export * from './back.types'
