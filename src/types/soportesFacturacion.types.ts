/**
 * Tipos para el módulo de Soportes de Facturación
 * Portal de Colaboradores GESTAR SALUD IPS
 */

// EPS disponibles para facturación
export type EpsFacturacion =
    | 'NUEVA EPS'
    | 'SALUD TOTAL'
    | 'FAMILIAR'

// Régimen del afiliado
export type RegimenFacturacion =
    | 'CONTRIBUTIVO'
    | 'SUBSIDIADO'

// Servicios prestados (según JotForm)
export type ServicioPrestado =
    | 'Consulta Ambulatoria'
    | 'Procedimientos Menores'
    | 'Imágenes Diagnósticas'
    | 'Cirugía ambulatoria'
    | 'Terapias'
    | 'Aplicación de medicamentos'
    | 'Laboratorio clínico'

// Estados del radicado
export type EstadoSoporteFacturacion =
    | 'Pendiente'
    | 'En Revisión'
    | 'Aprobado'
    | 'Devuelto'
    | 'Facturado'

// Estado de sincronización OneDrive
export type OneDriveSyncStatus =
    | 'pending'
    | 'syncing'
    | 'synced'
    | 'error'
    | 'failed'

// Categorías de archivos
export type CategoriaArchivo =
    | 'validacion_derechos'
    | 'autorizacion'
    | 'soporte_clinico'
    | 'comprobante_recibo'
    | 'orden_medica'
    | 'descripcion_quirurgica'
    | 'registro_anestesia'
    | 'hoja_medicamentos'
    | 'notas_enfermeria'

// Interfaz principal del registro (camelCase para frontend)
export interface SoporteFacturacion {
    id: string
    radicado: string
    fechaRadicacion: Date
    radicadorEmail: string
    radicadorNombre: string | null

    // Datos del servicio
    eps: EpsFacturacion
    regimen: RegimenFacturacion
    servicioPrestado: ServicioPrestado
    fechaAtencion: Date

    // Datos del paciente
    tipoId: string | null
    identificacion: string | null
    nombresCompletos: string | null
    bdId: string | null

    // Estado
    estado: EstadoSoporteFacturacion
    observacionesFacturacion: string | null

    // URLs de archivos
    urlsValidacionDerechos: string[]
    urlsAutorizacion: string[]
    urlsSoporteClinico: string[]
    urlsComprobanteRecibo: string[]
    urlsOrdenMedica: string[]
    urlsDescripcionQuirurgica: string[]
    urlsRegistroAnestesia: string[]
    urlsHojaMedicamentos: string[]
    urlsNotasEnfermeria: string[]

    // Identificaciones extraídas de archivos
    identificacionesArchivos: string[]

    // OneDrive
    onedriveFolderId: string | null
    onedriveFolderUrl: string | null
    onedriveSyncStatus: OneDriveSyncStatus
    onedriveSyncAt: Date | null

    // Auditoría
    createdAt: Date
    updatedAt: Date
}

// Interfaz raw de Supabase (snake_case)
export interface SoporteFacturacionRaw {
    id: string
    radicado: string
    fecha_radicacion: string
    radicador_email: string
    radicador_nombre: string | null
    eps: string
    regimen: string
    servicio_prestado: string
    fecha_atencion: string
    tipo_id: string | null
    identificacion: string | null
    nombres_completos: string | null
    bd_id: string | null
    estado: string
    observaciones_facturacion: string | null
    urls_validacion_derechos: string[]
    urls_autorizacion: string[]
    urls_soporte_clinico: string[]
    urls_comprobante_recibo: string[]
    urls_orden_medica: string[]
    urls_descripcion_quirurgica: string[]
    urls_registro_anestesia: string[]
    urls_hoja_medicamentos: string[]
    urls_notas_enfermeria: string[]
    identificaciones_archivos: string[]
    onedrive_folder_id: string | null
    onedrive_folder_url: string | null
    onedrive_sync_status: string
    onedrive_sync_at: string | null
    created_at: string
    updated_at: string
}

// Datos para crear nueva radicación
export interface CrearSoporteFacturacionData {
    radicadorEmail: string
    radicadorNombre?: string
    eps: EpsFacturacion
    regimen: RegimenFacturacion
    servicioPrestado: ServicioPrestado
    fechaAtencion: string // YYYY-MM-DD
    tipoId?: string
    identificacion?: string
    nombresCompletos?: string
    observaciones?: string
    archivos: {
        categoria: CategoriaArchivo
        files: File[]
    }[]
}

// Filtros de búsqueda
export interface FiltrosSoportesFacturacion {
    busqueda?: string
    eps?: EpsFacturacion | null
    estado?: EstadoSoporteFacturacion | 'Todos'
    radicadorEmail?: string | null
    radicadorNombre?: string | null
    servicioPrestado?: ServicioPrestado | null
    fechaInicio?: string
    fechaFin?: string
    fechaAtencionInicio?: string
    fechaAtencionFin?: string
    sortBy?: 'fechaRadicacion' | 'fechaAtencion' | 'radicado' | 'estado' | 'servicioPrestado' | 'eps' | 'radicadorEmail'
    sortOrder?: 'asc' | 'desc'
}

// Interfaz para radicador único
export interface RadicadorUnico {
    nombre: string
    email: string
}

// Configuración de categorías de archivos
export interface CategoriaArchivoConfig {
    id: CategoriaArchivo
    label: string
    descripcion: string
    requerido: boolean
    maxArchivos: number
}

// Lista de EPS
export const EPS_FACTURACION_LISTA: EpsFacturacion[] = [
    'NUEVA EPS',
    'SALUD TOTAL',
    'FAMILIAR',
]

// Lista de Regímenes
export const REGIMEN_FACTURACION_LISTA: { value: RegimenFacturacion; label: string }[] = [
    { value: 'CONTRIBUTIVO', label: 'Contributivo' },
    { value: 'SUBSIDIADO', label: 'Subsidiado' },
]

// Lista de Servicios (según JotForm)
export const SERVICIOS_PRESTADOS_LISTA: ServicioPrestado[] = [
    'Consulta Ambulatoria',
    'Procedimientos Menores',
    'Imágenes Diagnósticas',
    'Cirugía ambulatoria',
    'Terapias',
    'Aplicación de medicamentos',
    'Laboratorio clínico',
]

// Lista de Estados
export const ESTADOS_SOPORTE_LISTA: (EstadoSoporteFacturacion | 'Todos')[] = [
    'Pendiente',
    'En Revisión',
    'Aprobado',
    'Devuelto',
    'Facturado',
    'Todos',
]

// Configuración de categorías de archivos con prefijos por EPS
export const CATEGORIAS_ARCHIVOS: Omit<CategoriaArchivoConfig, 'prefijos'>[] = [
    {
        id: 'validacion_derechos',
        label: 'Validación de Derechos',
        descripcion: 'Documento de validación de derechos del afiliado',
        requerido: true,
        maxArchivos: Infinity,
    },
    {
        id: 'autorizacion',
        label: 'Autorización',
        descripcion: 'Autorización del servicio',
        requerido: true,
        maxArchivos: Infinity,
    },
    {
        id: 'soporte_clinico',
        label: 'Soporte Clínico / Historia Clínica',
        descripcion: 'Historia clínica o evolución del paciente',
        requerido: true,
        maxArchivos: Infinity,
    },
    {
        id: 'comprobante_recibo',
        label: 'Comprobante de Recibo',
        descripcion: 'Comprobante de recepción del servicio',
        requerido: false,
        maxArchivos: Infinity,
    },
    {
        id: 'orden_medica',
        label: 'Orden Médica',
        descripcion: 'Orden médica del procedimiento',
        requerido: false,
        maxArchivos: Infinity,
    },
    {
        id: 'descripcion_quirurgica',
        label: 'Descripción Quirúrgica',
        descripcion: 'Descripción del procedimiento quirúrgico',
        requerido: false,
        maxArchivos: Infinity,
    },
    {
        id: 'registro_anestesia',
        label: 'Registro de Anestesia',
        descripcion: 'Registro del procedimiento anestésico',
        requerido: false,
        maxArchivos: Infinity,
    },
    {
        id: 'hoja_medicamentos',
        label: 'Hoja de Medicamentos',
        descripcion: 'Registro de medicamentos administrados',
        requerido: false,
        maxArchivos: Infinity,
    },
    {
        id: 'notas_enfermeria',
        label: 'Notas de Enfermería',
        descripcion: 'Registro de notas de enfermería',
        requerido: false,
        maxArchivos: Infinity,
    },
]

// Colores para estados
export const ESTADO_COLORES: Record<EstadoSoporteFacturacion, { bg: string; text: string; border: string }> = {
    'Pendiente': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
    'En Revisión': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
    'Aprobado': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
    'Devuelto': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
    'Facturado': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
}
