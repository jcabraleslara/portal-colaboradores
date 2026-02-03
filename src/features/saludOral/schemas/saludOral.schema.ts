/**
 * Schemas de validación para Salud Oral
 * Utiliza Zod para validación con inferencia de tipos
 */

import { z } from 'zod'
import { SEDES, TIPOS_CONSULTA, TERAPIA_CONDUCTO_TIPOS, TERAPIA_CONDUCTO_RAICES, EXODONCIA_TIPOS, EXODONCIA_RAICES } from '@/types/saludOral.types'

// ========================================
// SCHEMAS BASE
// ========================================

export const sedeSchema = z.enum(SEDES)
export const tipoConsultaSchema = z.enum(TIPOS_CONSULTA)
export const terapiaConductoTipoSchema = z.enum(TERAPIA_CONDUCTO_TIPOS)
export const terapiaConductoRaicesSchema = z.enum(TERAPIA_CONDUCTO_RAICES)
export const exodonciaTipoSchema = z.enum(EXODONCIA_TIPOS)
export const exodonciaRaicesSchema = z.enum(EXODONCIA_RAICES)

// ========================================
// SCHEMA DE ÍNDICE COP
// ========================================

/**
 * Validación del Índice COP
 * Los valores deben estar entre 0 y el máximo según edad
 * < 5 años: máximo 22 (dentición temporal)
 * >= 5 años: máximo 32 (dentición permanente)
 */
export const copSchema = z.object({
    copCariesNoCavitacional: z.number().min(0).max(32),
    copCariesCavitacional: z.number().min(0).max(32),
    copObturados: z.number().min(0).max(32),
    copPerdidos: z.number().min(0).max(32),
    copSanos: z.number().min(0).max(32),
})

// ========================================
// SCHEMA PRINCIPAL
// ========================================

export const odRegistroSchema = z.object({
    // Datos básicos
    pacienteId: z.string().min(1, 'La identificación del paciente es requerida'),
    fechaRegistro: z.string().min(1, 'La fecha es requerida'),
    colaboradorEmail: z.string().email('Email inválido'),
    sede: sedeSchema,

    // Poblaciones Especiales
    gestante: z.boolean().default(false),
    cronicosHta: z.boolean().default(false),
    cronicosDm: z.boolean().default(false),
    cronicosErc: z.boolean().default(false),
    discapacidad: z.boolean().default(false),
    hemofilia: z.boolean().default(false),
    vih: z.boolean().default(false),
    cancer: z.boolean().default(false),
    menor5Anios: z.boolean().default(false),

    // Índice COP
    copCariesNoCavitacional: z.number().min(0).max(32).default(0),
    copCariesCavitacional: z.number().min(0).max(32).default(0),
    copObturados: z.number().min(0).max(32).default(0),
    copPerdidos: z.number().min(0).max(32).default(0),
    copSanos: z.number().min(0).max(32).default(0),

    // PyM
    pymControlPlaca: z.boolean().default(false),
    pymSellantes: z.boolean().default(false),
    pymSellantesCantidad: z.number().min(2).max(4).default(2),
    pymFluorBarniz: z.boolean().default(false),
    pymDetartraje: z.boolean().default(false),
    pymProfilaxis: z.boolean().default(false),
    pymEducacion: z.boolean().default(false),

    // Procedimientos
    tipoConsulta: tipoConsultaSchema.nullable().default(null),
    remisionEspecialidades: z.boolean().default(false),

    resina1sup: z.number().min(0).max(32).default(0),
    resina2sup: z.number().min(0).max(32).default(0),
    resina3sup: z.number().min(0).max(32).default(0),

    ionomero1sup: z.number().min(0).max(32).default(0),
    ionomero2sup: z.number().min(0).max(32).default(0),
    ionomero3sup: z.number().min(0).max(32).default(0),

    obturacionTemporal: z.number().min(0).max(32).default(0),
    pulpectomia: z.number().min(0).max(32).default(0),
    pulpotomia: z.number().min(0).max(32).default(0),

    terapiaConductoTipo: terapiaConductoTipoSchema.nullable().default(null),
    terapiaConductoRaices: terapiaConductoRaicesSchema.nullable().default(null),
    terapiaConductoCantidad: z.number().min(0).max(32).default(0),

    exodonciaTipo: exodonciaTipoSchema.nullable().default(null),
    exodonciaRaices: exodonciaRaicesSchema.nullable().default(null),
    exodonciaIncluido: z.boolean().default(false),
    exodonciaCantidad: z.number().min(0).max(32).default(0),

    controlPostquirurgico: z.boolean().default(false),

    rxSuperiores: z.boolean().default(false),
    rxInferiores: z.boolean().default(false),
    rxMolares: z.boolean().default(false),
    rxPremolares: z.boolean().default(false),
    rxCaninos: z.boolean().default(false),

    tratamientoFinalizado: z.boolean().default(false),
})

export type OdRegistroFormData = z.infer<typeof odRegistroSchema>

// ========================================
// HELPERS DE VALIDACIÓN
// ========================================

/**
 * Valida el Índice COP según la edad del paciente
 * @param edadAnios Edad del paciente en años (puede ser null si no se conoce)
 * @param valores Valores del índice COP
 * @returns Mensaje de error o null si es válido
 */
export function validarIndiceCOP(
    edadAnios: number | null,
    valores: { copCariesNoCavitacional: number; copCariesCavitacional: number; copObturados: number; copPerdidos: number; copSanos: number }
): string | null {
    // Si no hay edad, usamos el máximo posible
    const max = edadAnios !== null && edadAnios < 5 ? 22 : 32

    const total = valores.copCariesNoCavitacional + valores.copCariesCavitacional +
                  valores.copObturados + valores.copPerdidos + valores.copSanos

    if (total > max) {
        return `El total del índice COP (${total}) excede el máximo de ${max} dientes`
    }

    for (const [campo, valor] of Object.entries(valores)) {
        if (valor < 0) {
            return `${campo}: el valor no puede ser negativo`
        }
        if (valor > max) {
            return `${campo}: valor máximo permitido es ${max}`
        }
    }

    return null
}

/**
 * Valida que si hay cantidad de terapia de conducto, también haya tipo y raíces
 */
export function validarTerapiaConducto(
    cantidad: number,
    tipo: string | null,
    raices: string | null
): string | null {
    if (cantidad > 0 && (!tipo || !raices)) {
        return 'Debe especificar tipo y raíces para terapia de conducto'
    }
    if ((tipo || raices) && cantidad === 0) {
        return 'Debe especificar cantidad si selecciona tipo/raíces de terapia de conducto'
    }
    return null
}

/**
 * Valida que si hay cantidad de exodoncia, también haya tipo y raíces
 */
export function validarExodoncia(
    cantidad: number,
    tipo: string | null,
    raices: string | null,
    incluido: boolean
): string | null {
    if (cantidad > 0 && !tipo && !incluido) {
        return 'Debe especificar tipo de exodoncia o marcar como incluido'
    }
    if (tipo && !incluido && !raices) {
        return 'Debe especificar las raíces para exodoncia'
    }
    if ((tipo || raices) && cantidad === 0 && !incluido) {
        return 'Debe especificar cantidad si selecciona tipo/raíces de exodoncia'
    }
    return null
}

/**
 * Obtiene valores por defecto para un nuevo registro
 */
export function getDefaultOdRegistro(colaboradorEmail: string, sede: string = 'Montería'): OdRegistroFormData {
    return {
        pacienteId: '',
        fechaRegistro: new Date().toISOString().split('T')[0],
        colaboradorEmail,
        sede: sede as any,

        // Poblaciones especiales
        gestante: false,
        cronicosHta: false,
        cronicosDm: false,
        cronicosErc: false,
        discapacidad: false,
        hemofilia: false,
        vih: false,
        cancer: false,
        menor5Anios: false,

        // COP
        copCariesNoCavitacional: 0,
        copCariesCavitacional: 0,
        copObturados: 0,
        copPerdidos: 0,
        copSanos: 0,

        // PyM
        pymControlPlaca: false,
        pymSellantes: false,
        pymSellantesCantidad: 2,
        pymFluorBarniz: false,
        pymDetartraje: false,
        pymProfilaxis: false,
        pymEducacion: false,

        // Procedimientos
        tipoConsulta: null,
        remisionEspecialidades: false,
        resina1sup: 0,
        resina2sup: 0,
        resina3sup: 0,
        ionomero1sup: 0,
        ionomero2sup: 0,
        ionomero3sup: 0,
        obturacionTemporal: 0,
        pulpectomia: 0,
        pulpotomia: 0,
        terapiaConductoTipo: null,
        terapiaConductoRaices: null,
        terapiaConductoCantidad: 0,
        exodonciaTipo: null,
        exodonciaRaices: null,
        exodonciaIncluido: false,
        exodonciaCantidad: 0,
        controlPostquirurgico: false,
        rxSuperiores: false,
        rxInferiores: false,
        rxMolares: false,
        rxPremolares: false,
        rxCaninos: false,
        tratamientoFinalizado: false,
    }
}
