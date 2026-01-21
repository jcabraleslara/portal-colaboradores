/**
 * Types para Demanda Inducida
 */

export interface DemandaInducida {
    id: number
    pacienteTipoId: string
    pacienteId: string
    fechaGestion: string // ISO date
    celular: string | null
    horaLlamada: string | null
    clasificacion: 'Efectivo' | 'No Efectivo'
    quienRecibeLlamada: string | null
    relacionUsuario: string | null
    textoLlamada: string | null
    actividadesRealizadas: string | null
    condicionUsuario: string | null
    soportesRecuperados: string | null
    fechaAsignacionCita: string | null
    departamento: string | null
    municipio: string | null
    telefonoActualizado: string | null
    resultadoLlamada: string | null
    colaborador: string
    programaDireccionado: string | null
    createdAt: string
    updatedAt: string
}

export interface DemandaInducidaFormData {
    // Datos del paciente
    tipoId: string
    identificacion: string

    // Datos de gestión
    fechaGestion: string
    celular?: string
    horaLlamada?: string
    clasificacion: 'Efectivo' | 'No Efectivo'

    // Condicionales (si Efectivo)
    quienRecibeLlamada?: string
    relacionUsuario?: string
    textoLlamada?: string
    actividadesRealizadas?: string
    condicionUsuario?: string
    soportesRecuperados?: string
    fechaAsignacionCita?: string

    // Ubicación
    departamento?: string
    municipio?: string

    // Contacto
    telefonoActualizado?: string

    // Resultado
    resultadoLlamada?: string
    programaDireccionado?: string
}

export interface DemandaFilters {
    fechaInicio?: string
    fechaFin?: string
    colaborador?: string
    programa?: string
    clasificacion?: 'Efectivo' | 'No Efectivo'
    page?: number
    pageSize?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    busqueda?: string
}

export interface PaginatedResponse<T> {
    data: T[]
    count: number
}

export interface DemandaMetrics {
    topColaborador: {
        nombre: string
        totalCasos: number
        efectividad: number
    } | null
    casosEfectivos: number
    casosNoEfectivos: number
    casosMesActual: number
    porcentajeEfectividad: number
    porcentajeNoEfectividad: number
}

// Opciones para los selectsdel formulario
export const TIPOS_ID = ['CC', 'TI', 'RC', 'CE', 'PA', 'MS', 'AS'] as const

export const RELACIONES_USUARIO = [
    'Usuario',
    'Madre',
    'Padre',
    'Hijo(a)',
    'Pareja',
    'Amigo',
    'Tío',
    'Otro',
] as const

export const ACTIVIDADES_REALIZADAS = [
    'Educación en salud',
    'Canalización a programas',
    'Gestión de citas exámenes o autorizaciones',
] as const

export const CONDICIONES_USUARIO = ['Vivo', 'Fallecido'] as const

export const RESULTADOS_LLAMADA = [
    'Sistema correo de voz',
    'Usuario no acepta la llamada',
    'Número no existe',
    'Usuario no desea ser contactado',
    'Usuario no se encuentra',
    'Número equivocado',
    'Otro',
] as const

export const PROGRAMAS_DIRECCIONADOS = [
    'Salud Oral',
    'Primera Infancia',
    'Infancia',
    'Adultez',
    'Juventud',
    'Planificación familiar',
    'Ruta Materno perinatal',
    'DT cancer cuello uterino',
    'Precursoras',
    'Acceso a servicios de Salud',
] as const
