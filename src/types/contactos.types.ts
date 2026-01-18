/**
 * Tipos para Directorio Institucional
 * Portal de Colaboradores GESTAR SALUD IPS
 */

// ========================================
// INTERFACE PRINCIPAL
// ========================================

export interface Contacto {
    id: string
    tratamiento: string | null
    primer_nombre: string
    segundo_nombre: string | null
    apellidos: string
    identificacion: string | null
    email_personal: string | null
    email_institucional: string | null
    empresa: string | null
    puesto: string | null
    celular_1: string | null
    celular_2: string | null
    fecha_nacimiento: string | null
    direccion: string | null
    ciudad: string
    departamento: string
    pais: string
    notas: string | null
    hoja_vida_url: string | null
    firma_url: string | null
    rol: string
    area: string | null
    google_contact_id: string | null
    outlook_contact_id: string | null
    sync_status?: 'pending' | 'synced' | 'error'
    sync_error?: string | null
    last_synced_at?: string | null
    created_at: string
    updated_at: string
    last_sign_in_at: string | null
}

// ========================================
// FILTROS DE BÚSQUEDA
// ========================================

export interface ContactoFiltros {
    busqueda?: string  // Busca en nombre, identificación, puesto, área, empresa
    empresa?: string | null
    area?: string | null
    rol?: string | null
}

// ========================================
// CONTEOS PARA CARDS
// ========================================

export interface ConteosContactos {
    total: number
    porEmpresa: { empresa: string; cantidad: number }[]
    porArea: { area: string; cantidad: number }[]
    porRol: { rol: string; cantidad: number }[]
}

// ========================================
// DATOS PARA CREAR/ACTUALIZAR
// ========================================

export interface ContactoInput {
    tratamiento?: string | null
    primer_nombre: string
    segundo_nombre?: string | null
    apellidos: string
    identificacion?: string | null
    email_personal?: string | null
    email_institucional?: string | null
    empresa?: string | null
    puesto?: string | null
    celular_1?: string | null
    celular_2?: string | null
    fecha_nacimiento?: string | null
    direccion?: string | null
    ciudad?: string
    departamento?: string
    pais?: string
    notas?: string | null
    hoja_vida_url?: string | null
    firma_url?: string | null
    rol?: string
    area?: string | null
}

export interface ContactoUpdate extends Partial<ContactoInput> {
    google_contact_id?: string | null
    outlook_contact_id?: string | null
}

// ========================================
// CONSTANTES Y COLORES
// ========================================

export const ROL_LISTA = ['superadministrador', 'administrador', 'gerencia', 'auditor', 'asistencial', 'operativo', 'externo'] as const
export type Rol = typeof ROL_LISTA[number]

export const ROL_COLORES: Record<string, { bg: string; text: string; border: string }> = {
    'superadministrador': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    'administrador': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    'gerencia': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
    'auditor': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    'asistencial': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    'operativo': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'externo': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
}

export const TRATAMIENTO_LISTA = ['', 'Dr.', 'Dra.', 'Lic.', 'Ing.', 'Enf.', 'Aux.'] as const
