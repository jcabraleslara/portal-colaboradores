/**
 * Tipos para Módulo Salud Oral (Odontología)
 * Portal de Colaboradores GESTAR SALUD IPS
 */

// ========================================
// CONSTANTES Y ENUMS
// ========================================

export const SEDES = ['Montería', 'Cereté', 'Ciénaga de Oro'] as const
export type Sede = typeof SEDES[number]

export const TIPOS_CONSULTA = ['primera_vez', 'control', 'urgencias'] as const
export type TipoConsulta = typeof TIPOS_CONSULTA[number]

export const TERAPIA_CONDUCTO_TIPOS = ['temporal', 'permanente'] as const
export type TerapiaConductoTipo = typeof TERAPIA_CONDUCTO_TIPOS[number]

export const TERAPIA_CONDUCTO_RAICES = ['uni', 'bi', 'multi'] as const
export type TerapiaConductoRaices = typeof TERAPIA_CONDUCTO_RAICES[number]

export const EXODONCIA_TIPOS = ['temporal', 'permanente'] as const
export type ExodonciaTipo = typeof EXODONCIA_TIPOS[number]

export const EXODONCIA_RAICES = ['uni', 'multi'] as const
export type ExodonciaRaices = typeof EXODONCIA_RAICES[number]

// ========================================
// INTERFACES PRINCIPALES
// ========================================

/**
 * Registro completo de Salud Oral (tabla od)
 */
export interface OdRegistro {
    id: string
    pacienteId: string
    fechaRegistro: string
    colaboradorEmail: string
    sede: Sede

    // Poblaciones Especiales
    gestante: boolean
    cronicosHta: boolean
    cronicosDm: boolean
    cronicosErc: boolean
    discapacidad: boolean
    hemofilia: boolean
    vih: boolean
    cancer: boolean
    menor5Anios: boolean

    // Índice COP
    copCariesNoCavitacional: number
    copCariesCavitacional: number
    copObturados: number
    copPerdidos: number
    copSanos: number

    // PyM (Promoción y Mantenimiento)
    pymControlPlaca: boolean
    pymSellantes: boolean
    pymSellantesCantidad: number
    pymFluorBarniz: boolean
    pymDetartraje: boolean
    pymProfilaxis: boolean
    pymEducacion: boolean

    // Procedimientos
    tipoConsulta: TipoConsulta | null
    remisionEspecialidades: boolean

    resina1sup: number
    resina2sup: number
    resina3sup: number

    ionomero1sup: number
    ionomero2sup: number
    ionomero3sup: number

    obturacionTemporal: number
    pulpectomia: number
    pulpotomia: number

    terapiaConductoTipo: TerapiaConductoTipo | null
    terapiaConductoRaices: TerapiaConductoRaices | null
    terapiaConductoCantidad: number

    exodonciaTipo: ExodonciaTipo | null
    exodonciaRaices: ExodonciaRaices | null
    exodonciaIncluido: boolean
    exodonciaCantidad: number

    controlPostquirurgico: boolean

    tratamientoFinalizado: boolean

    createdAt: string
    updatedAt: string
}

/**
 * Datos para crear un nuevo registro (sin campos autogenerados)
 */
export interface OdRegistroCreate extends Omit<OdRegistro, 'id' | 'createdAt' | 'updatedAt'> { }

/**
 * Datos para actualizar un registro
 */
export interface OdRegistroUpdate extends Partial<OdRegistroCreate> { }

/**
 * Valores del Índice COP
 */
export interface CopValues {
    copCariesNoCavitacional: number
    copCariesCavitacional: number
    copObturados: number
    copPerdidos: number
    copSanos: number
}

/**
 * Filtros para búsqueda de registros
 */
export interface OdFilters {
    fechaInicio?: string
    fechaFin?: string
    colaboradorEmail?: string
    sede?: Sede
    pacienteId?: string
    tratamientoFinalizado?: boolean
    actividad?: string // Nuevo filtro discriminado por actividad
    page?: number
    pageSize?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
}

/**
 * Métricas PyM del mes actual
 */
export interface OdPymMetricsMes {
    fluor: number
    sellantes: number
    detartraje: number
    controlPlaca: number
}

/**
 * Métricas del módulo
 */
export interface OdMetrics {
    totalRegistros: number
    registrosMesActual: number
    tratamientosFinalizados: number
    porcentajeFinalizados: number
    pymMesActual: OdPymMetricsMes
    porSede: Record<Sede, number>
    topColaborador: {
        email: string
        nombre: string
        total: number
    } | null
}

/**
 * Respuesta paginada
 */
export interface PaginatedResponse<T> {
    data: T[]
    count: number
}

// ========================================
// MAPEO CUPS PARA EXPORTACIÓN
// ========================================

export interface CupsItem {
    cups: string
    descripcion: string
}

export const CUPS_MAPPING: Record<string, CupsItem> = {
    // Tipo de consulta
    primera_vez: { cups: '8902030000', descripcion: 'CONSULTA DE PRIMERA VEZ POR ODONTOLOGIA GENERAL' },
    control: { cups: '8903030000', descripcion: 'CONSULTA DE CONTROL POR ODONTOLOGIA GENERAL' },
    urgencias: { cups: '8907030000', descripcion: 'CONSULTA DE URGENCIAS POR ODONTOLOGIA GENERAL' },

    // Remisión
    remision_especialidades: { cups: '8902040000', descripcion: 'CONSULTA DE PRIMERA VEZ POR ESPECIALISTA EN ODONTOLOGIA' },

    // PyM
    pym_control_placa: { cups: '9970020000', descripcion: 'CONTROL DE PLACA DENTAL' },
    pym_sellantes: { cups: '9971070000', descripcion: 'APLICACION DE SELLANTES' },
    pym_fluor_barniz: { cups: '9971060000', descripcion: 'TOPICACION DE FLUOR EN BARNIZ' },
    pym_detartraje: { cups: '9973010100', descripcion: 'DETARTRAJE SUPRAGINGIVAL' },
    pym_profilaxis: { cups: '9970010000', descripcion: 'PROFILAXIS DENTAL O PULIDO CORONAL' },
    pym_educacion: { cups: '9902120000', descripcion: 'EDUCACION INDIVIDUAL EN SALUD. POR HIGIENE ORAL' },

    // Resinas
    resina_1sup: { cups: '2321020700', descripcion: 'OBTURACION DENTAL CON RESINA DE FOTOCURADO ( UNA SUPERFICIE)' },
    resina_2sup: { cups: '2321020800', descripcion: 'OBTURACION DENTAL CON RESINA DE FOTOCURADO (DOS SUPERFICIES)' },
    resina_3sup: { cups: '2321020900', descripcion: 'OBTURACION DENTAL CON RESINA DE FOTOCURADO ( 3 SUPERFICIES)' },

    // Ionómeros
    ionomero_1sup: { cups: '2321030000', descripcion: 'OBTURACION DENTAL CON IONOMERO DE VIDRIO (UNA SUPERFICIE)' },
    ionomero_2sup: { cups: '2321030100', descripcion: 'OBTURACION DENTAL CON IONOMERO DE VIDRIO (DOS SUPERFICIES )' },
    ionomero_3sup: { cups: '2321030200', descripcion: 'OBTURACION DENTAL CON IONOMERO DE VIDRIO ( TRES SUPERFICIES)' },

    // Obturación temporal
    obturacion_temporal: { cups: '2322010000', descripcion: 'OBTURACION TEMPORAL POR DIENTE' },

    // Pulpa
    pulpectomia: { cups: '2371030000', descripcion: 'PULPECTOMIA' },
    pulpotomia: { cups: '2371020000', descripcion: 'PULPOTOMIA' },

    // Terapia de conducto (temporales: solo uni y multi)
    terapia_conducto_temporal_uni: { cups: '2373040000', descripcion: 'TERAPIA DE CONDUCTO RADICULAR EN DIENTE TEMPORAL UNIRRADICULAR' },
    terapia_conducto_temporal_multi: { cups: '2373050000', descripcion: 'TERAPIA DE CONDUCTO RADICULAR EN DIENTE TEMPORAL MULTIRRADICULAR' },

    // Terapia de conducto (permanentes: uni, bi, multi)
    terapia_conducto_permanente_uni: { cups: '2373010000', descripcion: 'TERAPIA DE CONDUCTO RADICULAR EN DIENTE UNIRRADICULAR' },
    terapia_conducto_permanente_bi: { cups: '2373020000', descripcion: 'TERAPIA DE CONDUCTO RADICULAR EN DIENTE BIRRADICULAR' },
    terapia_conducto_permanente_multi: { cups: '2373030000', descripcion: 'TERAPIA DE CONDUCTO RADICULAR EN DIENTE MULTIRRADICULAR' },

    // Exodoncias
    exodoncia_temporal_uni: { cups: '2302010000', descripcion: 'EXODONCIA DE DIENTE TEMPORAL UNIRRADICULAR' },
    exodoncia_temporal_multi: { cups: '2302020000', descripcion: 'EXODONCIA DE DIENTE TEMPORAL MULTIRRADICULAR' },
    exodoncia_permanente_uni: { cups: '2301010000', descripcion: 'EXODONCIA DE DIENTE PERMANENTE UNIRRADICULAR' },
    exodoncia_permanente_multi: { cups: '2301020000', descripcion: 'EXODONCIA DE DIENTE PERMANENTE MULTIRRADICULAR' },
    exodoncia_incluido: { cups: '2313010000', descripcion: 'EXODONCIA DE INCLUIDO EN POSICION ECTOPICA CON ABORDAJE INTRAORAL' },

    // Control post-quirúrgico
    control_postquirurgico: { cups: '8903040100', descripcion: 'CONSULTA CONTROL POSQUIRURGICO ODONTOLOGIA' },
}

/**
 * Etiquetas legibles para tipos de consulta
 */
export const TIPO_CONSULTA_LABELS: Record<TipoConsulta, string> = {
    primera_vez: 'Primera Vez',
    control: 'Control',
    urgencias: 'Urgencias',
}

/**
 * Etiquetas para terapia de conducto
 */
export const TERAPIA_CONDUCTO_TIPO_LABELS: Record<TerapiaConductoTipo, string> = {
    temporal: 'Temporal',
    permanente: 'Permanente',
}

export const TERAPIA_CONDUCTO_RAICES_LABELS: Record<TerapiaConductoRaices, string> = {
    uni: 'Unirradicular',
    bi: 'Birradicular',
    multi: 'Multirradicular',
}

/**
 * Etiquetas para exodoncia
 */
export const EXODONCIA_TIPO_LABELS: Record<ExodonciaTipo, string> = {
    temporal: 'Temporal',
    permanente: 'Permanente',
}

export const EXODONCIA_RAICES_LABELS: Record<ExodonciaRaices, string> = {
    uni: 'Unirradicular',
    multi: 'Multirradicular',
}
