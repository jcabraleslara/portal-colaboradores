/**
 * Tipos para el módulo de Importación de Fuentes
 * Sistema de importación masiva multi-fuente
 */

import { LucideIcon } from 'lucide-react'

/** Identificadores únicos de cada fuente de importación */
export type ImportSourceId =
    | 'autorizaciones-sisma'
    | 'autorizaciones-st'
    | 'bd-neps'
    | 'bd-salud-total'
    | 'bd-sigires-neps'
    | 'bd-sigires-st'
    | 'cervix'
    | 'cirugias'
    | 'citas'
    | 'gestantes'
    | 'imagenes'
    | 'incapacidades'
    | 'laboratorios'
    | 'ordenamientos'
    | 'recetas'

/** Categorías para agrupar fuentes relacionadas */
export type ImportSourceCategory =
    | 'autorizaciones'
    | 'bases-datos'
    | 'clinico'
    | 'programas'

/** Estado de implementación de cada fuente */
export type ImportSourceStatus = 'active' | 'coming-soon' | 'maintenance'

/** Modo de importación */
export type ImportMode = 'file' | 'cloud'

/** Configuración de una fuente de importación */
export interface ImportSourceConfig {
    id: ImportSourceId
    name: string
    description: string
    icon: LucideIcon
    category: ImportSourceCategory
    status: ImportSourceStatus
    /** Color del gradiente (tailwind classes) */
    gradient: {
        from: string
        to: string
        iconBg: string
        iconText: string
    }
    /** Modo de importación: 'file' (upload manual) o 'cloud' (desde la nube) */
    importMode?: ImportMode
    /** Nombre del archivo esperado (para el label del dropzone) */
    expectedFileName?: string
    /** Tipos de archivo aceptados */
    acceptedFileTypes?: Record<string, string[]>
    /** Tamaño máximo en bytes */
    maxFileSize?: number
    /** Tabla destino en Supabase */
    targetTable?: string
}

/** Resultado de una importación */
export interface ImportResult {
    success: number
    errors: number
    duplicates: number
    totalProcessed: number
    duration: string
    /** Reporte CSV de errores específicos */
    errorReport?: string
    /** Reporte CSV informativo (siempre disponible, no solo con errores) */
    infoReport?: string
    /** Mensaje descriptivo del error */
    errorMessage?: string
}

/** Registro en el historial de importaciones */
export interface ImportHistoryRecord {
    id: string
    fecha_importacion: string
    usuario: string
    archivo_nombre: string
    tipo_fuente: ImportSourceId
    total_registros: number
    exitosos: number
    fallidos: number
    duplicados: number
    duracion: string
    detalles?: Record<string, unknown>
}

/** Props para el callback de progreso */
export type ImportProgressCallback = (
    status: string,
    percentage?: number
) => void

/** Función procesadora de archivos (cada fuente implementa la suya) */
export type ImportProcessorFn = (
    file: File,
    onProgress: ImportProgressCallback
) => Promise<ImportResult>

/** Función procesadora cloud (sin archivo, descarga desde la nube) */
export type CloudImportProcessorFn = (
    onProgress: ImportProgressCallback
) => Promise<ImportResult>
