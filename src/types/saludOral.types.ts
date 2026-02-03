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

    rxSuperiores: boolean
    rxInferiores: boolean
    rxMolares: boolean
    rxPremolares: boolean
    rxCaninos: boolean

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
    terminadosST: number
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
    primera_vez: { cups: '890203', descripcion: 'CONSULTA DE PRIMERA VEZ POR ODONTOLOGÍA GENERAL' },
    control: { cups: '890303', descripcion: 'CONSULTA DE CONTROL O DE SEGUIMIENTO POR ODONTOLOGÍA GENERAL' },
    urgencias: { cups: '890703', descripcion: 'CONSULTA DE URGENCIAS POR ODONTOLOGÍA GENERAL' },

    // Remisión
    remision_especialidades: { cups: '890204', descripcion: 'CONSULTA DE PRIMERA VEZ POR ESPECIALISTA EN ODONTOLOGÍA' },

    // PyM
    pym_control_placa: { cups: '997101', descripcion: 'CONTROL DE PLACA DENTAL' },
    pym_sellantes: { cups: '997300', descripcion: 'APLICACIÓN DE SELLANTES DE FOTOCURADO' },
    pym_fluor_barniz: { cups: '997106', descripcion: 'APLICACIÓN DE FLÚOR EN BARNIZ' },
    pym_detartraje: { cups: '997201', descripcion: 'DETARTRAJE SUPRAGINGIVAL' },
    pym_profilaxis: { cups: '997200', descripcion: 'PROFILAXIS DENTAL' },
    pym_educacion: { cups: '990203', descripcion: 'EDUCACIÓN INDIVIDUAL EN SALUD ORAL' },

    // Resinas
    resina_1sup: { cups: '232101', descripcion: 'OBTURACIÓN DENTAL CON RESINA DE FOTOCURADO DE 1 SUPERFICIE' },
    resina_2sup: { cups: '232102', descripcion: 'OBTURACIÓN DENTAL CON RESINA DE FOTOCURADO DE 2 SUPERFICIES' },
    resina_3sup: { cups: '232103', descripcion: 'OBTURACIÓN DENTAL CON RESINA DE FOTOCURADO DE 3 O MÁS SUPERFICIES' },

    // Ionómeros
    ionomero_1sup: { cups: '232201', descripcion: 'OBTURACIÓN DENTAL CON IONÓMERO DE VIDRIO DE 1 SUPERFICIE' },
    ionomero_2sup: { cups: '232202', descripcion: 'OBTURACIÓN DENTAL CON IONÓMERO DE VIDRIO DE 2 SUPERFICIES' },
    ionomero_3sup: { cups: '232203', descripcion: 'OBTURACIÓN DENTAL CON IONÓMERO DE VIDRIO DE 3 O MÁS SUPERFICIES' },

    // Obturación temporal
    obturacion_temporal: { cups: '232300', descripcion: 'OBTURACIÓN DENTAL CON MATERIAL TEMPORAL' },

    // Pulpa
    pulpectomia: { cups: '233201', descripcion: 'PULPECTOMÍA DIENTE TEMPORAL' },
    pulpotomia: { cups: '233101', descripcion: 'PULPOTOMÍA' },

    // Terapia de conducto
    terapia_conducto_temporal_uni: { cups: '233303', descripcion: 'TRATAMIENTO DE CONDUCTO DIENTE TEMPORAL UNIRRADICULAR' },
    terapia_conducto_temporal_bi: { cups: '233304', descripcion: 'TRATAMIENTO DE CONDUCTO DIENTE TEMPORAL BIRRADICULAR' },
    terapia_conducto_temporal_multi: { cups: '233305', descripcion: 'TRATAMIENTO DE CONDUCTO DIENTE TEMPORAL MULTIRRADICULAR' },
    terapia_conducto_permanente_uni: { cups: '233300', descripcion: 'TRATAMIENTO DE CONDUCTO DIENTE PERMANENTE UNIRRADICULAR' },
    terapia_conducto_permanente_bi: { cups: '233301', descripcion: 'TRATAMIENTO DE CONDUCTO DIENTE PERMANENTE BIRRADICULAR' },
    terapia_conducto_permanente_multi: { cups: '233302', descripcion: 'TRATAMIENTO DE CONDUCTO DIENTE PERMANENTE MULTIRRADICULAR' },

    // Exodoncias
    exodoncia_temporal_uni: { cups: '234101', descripcion: 'EXODONCIA DE DIENTE TEMPORAL UNIRRADICULAR' },
    exodoncia_temporal_multi: { cups: '234102', descripcion: 'EXODONCIA DE DIENTE TEMPORAL MULTIRRADICULAR' },
    exodoncia_permanente_uni: { cups: '234201', descripcion: 'EXODONCIA DE DIENTE PERMANENTE UNIRRADICULAR' },
    exodoncia_permanente_multi: { cups: '234202', descripcion: 'EXODONCIA DE DIENTE PERMANENTE MULTIRRADICULAR' },
    exodoncia_incluido: { cups: '234301', descripcion: 'EXODONCIA DE DIENTE INCLUIDO EN POSICIÓN HORIZONTAL' },

    // Control post-quirúrgico
    control_postquirurgico: { cups: '890601', descripcion: 'CONTROL POST-OPERATORIO DE CIRUGÍA ORAL' },

    // Radiografías
    rx_periapical: { cups: '877201', descripcion: 'RADIOGRAFÍA DENTAL PERIAPICAL' },
    rx_oclusal: { cups: '877210', descripcion: 'RADIOGRAFÍA DENTAL OCLUSAL' },
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
