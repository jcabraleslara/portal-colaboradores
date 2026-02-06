/**
 * Configuración centralizada de todas las fuentes de importación
 * Ordenadas alfabéticamente para consistencia en la UI
 */

import {
    ClipboardCheck,
    FileCheck,
    Database,
    HardDrive,
    Server,
    ServerCog,
    Heart,
    Scissors,
    Calendar,
    Baby,
    Image,
    BedDouble,
    FlaskConical,
    ClipboardList,
    Pill,
} from 'lucide-react'
import type { ImportSourceConfig, ImportSourceCategory } from '../types/import.types'

/** Paletas de colores predefinidas para las cards */
const COLOR_PALETTES = {
    blue: {
        from: 'from-blue-500',
        to: 'to-cyan-400',
        iconBg: 'bg-blue-50',
        iconText: 'text-blue-600',
    },
    indigo: {
        from: 'from-indigo-500',
        to: 'to-purple-400',
        iconBg: 'bg-indigo-50',
        iconText: 'text-indigo-600',
    },
    violet: {
        from: 'from-violet-500',
        to: 'to-fuchsia-400',
        iconBg: 'bg-violet-50',
        iconText: 'text-violet-600',
    },
    pink: {
        from: 'from-pink-500',
        to: 'to-rose-400',
        iconBg: 'bg-pink-50',
        iconText: 'text-pink-600',
    },
    emerald: {
        from: 'from-emerald-500',
        to: 'to-teal-400',
        iconBg: 'bg-emerald-50',
        iconText: 'text-emerald-600',
    },
    amber: {
        from: 'from-amber-500',
        to: 'to-orange-400',
        iconBg: 'bg-amber-50',
        iconText: 'text-amber-600',
    },
    cyan: {
        from: 'from-cyan-500',
        to: 'to-sky-400',
        iconBg: 'bg-cyan-50',
        iconText: 'text-cyan-600',
    },
    slate: {
        from: 'from-slate-600',
        to: 'to-slate-400',
        iconBg: 'bg-slate-100',
        iconText: 'text-slate-600',
    },
} as const

/** Tipos de archivo comunes */
const EXCEL_FILE_TYPES = {
    'text/html': ['.xls'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}

// CSV_FILE_TYPES disponible para fuentes que usen CSV en el futuro
// const CSV_FILE_TYPES = {
//     'text/csv': ['.csv'],
//     'text/plain': ['.txt', '.csv'],
// }

/**
 * Lista completa de fuentes de importación
 * IMPORTANTE: Mantener ordenadas alfabéticamente por 'name'
 */
export const IMPORT_SOURCES: ImportSourceConfig[] = [
    {
        id: 'autorizaciones-sisma',
        name: 'Autorizaciones Sisma',
        description: 'Autorizaciones del sistema SISMA',
        icon: ClipboardCheck,
        category: 'autorizaciones',
        status: 'coming-soon',
        gradient: COLOR_PALETTES.indigo,
        expectedFileName: 'Autorizaciones_Sisma.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 50 * 1024 * 1024,
    },
    {
        id: 'autorizaciones-st',
        name: 'Autorizaciones ST',
        description: 'Autorizaciones de Salud Total',
        icon: FileCheck,
        category: 'autorizaciones',
        status: 'coming-soon',
        gradient: COLOR_PALETTES.violet,
        expectedFileName: 'Autorizaciones_ST.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 50 * 1024 * 1024,
    },
    {
        id: 'bd-neps',
        name: 'BD Neps',
        description: 'Base de datos Nueva EPS',
        icon: Database,
        category: 'bases-datos',
        status: 'coming-soon',
        gradient: COLOR_PALETTES.cyan,
        expectedFileName: 'BD_Neps.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 100 * 1024 * 1024,
    },
    {
        id: 'bd-salud-total',
        name: 'BD Salud Total',
        description: 'Base de datos Salud Total',
        icon: HardDrive,
        category: 'bases-datos',
        status: 'coming-soon',
        gradient: COLOR_PALETTES.blue,
        expectedFileName: 'BD_Salud_Total.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 100 * 1024 * 1024,
    },
    {
        id: 'bd-sigires-neps',
        name: 'BD Sigires NEPS',
        description: 'Sigires de Nueva EPS',
        icon: Server,
        category: 'bases-datos',
        status: 'coming-soon',
        gradient: COLOR_PALETTES.emerald,
        expectedFileName: 'Sigires_NEPS.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 100 * 1024 * 1024,
    },
    {
        id: 'bd-sigires-st',
        name: 'BD Sigires ST',
        description: 'Sigires de Salud Total',
        icon: ServerCog,
        category: 'bases-datos',
        status: 'coming-soon',
        gradient: COLOR_PALETTES.slate,
        expectedFileName: 'Sigires_ST.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 100 * 1024 * 1024,
    },
    {
        id: 'cervix',
        name: 'Cérvix',
        description: 'Programa de tamizaje cervical',
        icon: Heart,
        category: 'programas',
        status: 'coming-soon',
        gradient: COLOR_PALETTES.pink,
        expectedFileName: 'Cervix.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 50 * 1024 * 1024,
    },
    {
        id: 'cirugias',
        name: 'Cirugías',
        description: 'Procedimientos quirúrgicos',
        icon: Scissors,
        category: 'clinico',
        status: 'coming-soon',
        gradient: COLOR_PALETTES.amber,
        expectedFileName: 'Cirugias.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 50 * 1024 * 1024,
    },
    {
        id: 'citas',
        name: 'Citas',
        description: 'Agenda de citas médicas',
        icon: Calendar,
        category: 'clinico',
        status: 'active',
        gradient: COLOR_PALETTES.indigo,
        expectedFileName: 'Informe_citas.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 200 * 1024 * 1024,
        targetTable: 'citas',
    },
    {
        id: 'gestantes',
        name: 'Gestantes',
        description: 'Programa de control prenatal',
        icon: Baby,
        category: 'programas',
        status: 'coming-soon',
        gradient: COLOR_PALETTES.pink,
        expectedFileName: 'Gestantes.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 50 * 1024 * 1024,
    },
    {
        id: 'imagenes',
        name: 'Imágenes',
        description: 'Diagnóstico por imágenes',
        icon: Image,
        category: 'clinico',
        status: 'coming-soon',
        gradient: COLOR_PALETTES.cyan,
        expectedFileName: 'Imagenes.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 50 * 1024 * 1024,
    },
    {
        id: 'incapacidades',
        name: 'Incapacidades',
        description: 'Registro de incapacidades',
        icon: BedDouble,
        category: 'clinico',
        status: 'active',
        gradient: COLOR_PALETTES.amber,
        expectedFileName: 'Incapacidades.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 50 * 1024 * 1024,
        targetTable: 'incapacidades',
    },
    {
        id: 'laboratorios',
        name: 'Laboratorios',
        description: 'Resultados de laboratorio',
        icon: FlaskConical,
        category: 'clinico',
        status: 'coming-soon',
        gradient: COLOR_PALETTES.emerald,
        expectedFileName: 'Laboratorios.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 50 * 1024 * 1024,
    },
    {
        id: 'ordenamientos',
        name: 'Ordenamientos',
        description: 'Órdenes médicas emitidas',
        icon: ClipboardList,
        category: 'clinico',
        status: 'coming-soon',
        gradient: COLOR_PALETTES.blue,
        expectedFileName: 'Ordenamientos.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 50 * 1024 * 1024,
    },
    {
        id: 'recetas',
        name: 'Recetas',
        description: 'Prescripciones médicas',
        icon: Pill,
        category: 'clinico',
        status: 'coming-soon',
        gradient: COLOR_PALETTES.violet,
        expectedFileName: 'Recetas.xls',
        acceptedFileTypes: EXCEL_FILE_TYPES,
        maxFileSize: 50 * 1024 * 1024,
    },
]

/** Obtener fuente por ID */
export const getImportSourceById = (id: string): ImportSourceConfig | undefined => {
    return IMPORT_SOURCES.find(source => source.id === id)
}

/** Obtener fuentes por categoría */
export const getImportSourcesByCategory = (category: ImportSourceCategory): ImportSourceConfig[] => {
    return IMPORT_SOURCES.filter(source => source.category === category)
}

/** Obtener solo fuentes activas */
export const getActiveImportSources = (): ImportSourceConfig[] => {
    return IMPORT_SOURCES.filter(source => source.status === 'active')
}

/** Labels para las categorías */
export const CATEGORY_LABELS: Record<ImportSourceCategory, string> = {
    'autorizaciones': 'Autorizaciones',
    'bases-datos': 'Bases de Datos',
    'clinico': 'Datos Clínicos',
    'programas': 'Programas de Salud',
}
