/**
 * Tipos para el módulo de Gestión de Recobros
 * Portal de Colaboradores GESTAR SALUD IPS
 */

// Estados posibles de un recobro
export type EstadoRecobro = 'Pendiente' | 'En gestión' | 'Aprobado' | 'Devuelto'

// Lista de estados para filtros y selección
export const ESTADOS_RECOBRO_LISTA: (EstadoRecobro | 'Todos')[] = [
    'Todos',
    'Pendiente',
    'En gestión',
    'Aprobado',
    'Devuelto',
]

// Colores por estado para UI
export const ESTADO_RECOBRO_COLORES: Record<EstadoRecobro, {
    bg: string
    text: string
    border: string
    icon: string
}> = {
    'Pendiente': {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        border: 'border-yellow-300',
        icon: 'Clock'
    },
    'En gestión': {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-300',
        icon: 'FileSearch'
    },
    'Aprobado': {
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        border: 'border-emerald-300',
        icon: 'CheckCircle'
    },
    'Devuelto': {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
        icon: 'Undo2'
    },
}

// Estructura de un CUPS seleccionado
export interface CupsSeleccionado {
    cups: string
    descripcion: string
    cantidad: number
    es_principal: boolean
}

// Interfaz principal del Recobro (camelCase para uso en frontend)
export interface Recobro {
    id: string
    consecutivo: string
    pacienteId: string
    pacienteTipoId: string | null
    pacienteNombres: string | null
    cupsData: CupsSeleccionado[]
    justificacion: string | null
    soportesUrls: string[]
    estado: EstadoRecobro
    respuestaAuditor: string | null
    radicadorEmail: string
    radicadorNombre: string | null
    pdfAprobacionUrl: string | null
    createdAt: Date
    updatedAt: Date
}

// Interfaz raw de la base de datos (snake_case)
export interface RecobroRaw {
    id: string
    consecutivo: string
    paciente_id: string
    paciente_tipo_id: string | null
    paciente_nombres: string | null
    cups_data: CupsSeleccionado[]
    justificacion: string | null
    soportes_urls: string[]
    estado: EstadoRecobro
    respuesta_auditor: string | null
    radicador_email: string
    radicador_nombre: string | null
    pdf_aprobacion_url: string | null
    created_at: string
    updated_at: string
}

// Datos para crear un nuevo recobro
export interface CrearRecobroData {
    pacienteId: string
    pacienteTipoId?: string
    pacienteNombres?: string
    cupsData: CupsSeleccionado[]
    justificacion?: string
    soportes: File[]
    radicadorEmail: string
    radicadorNombre?: string
}

// Filtros para listar recobros
export interface FiltrosRecobros {
    estado?: EstadoRecobro | 'Todos'
    busqueda?: string
    radicadorEmail?: string
    fechaInicio?: string
    fechaFin?: string
    sortBy?: 'consecutivo' | 'createdAt' | 'estado' | 'pacienteNombres'
    sortOrder?: 'asc' | 'desc'
}

// Datos para actualizar un recobro
export interface ActualizarRecobroData {
    estado?: EstadoRecobro
    respuestaAuditor?: string
    pdfAprobacionUrl?: string
}
