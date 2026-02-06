/**
 * Índice de servicios de importación
 * Mapea cada fuente a su función procesadora
 */

import type { ImportSourceId, ImportProcessorFn } from '../types/import.types'
import { processCitasFile } from './citasImportService'

// Re-export para compatibilidad con código existente
export { processCitasFile } from './citasImportService'

/**
 * Registro de procesadores por fuente
 * Agregar nuevos procesadores aquí conforme se implementen
 */
const IMPORT_PROCESSORS: Partial<Record<ImportSourceId, ImportProcessorFn>> = {
    'citas': processCitasFile,
    // Agregar nuevos procesadores aquí:
    // 'incapacidades': processIncapacidadesFile,
    // 'cirugias': processCirugiasFile,
    // etc.
}

/**
 * Obtiene el procesador para una fuente específica
 * Retorna undefined si la fuente no está implementada
 */
export function getImportProcessor(sourceId: ImportSourceId): ImportProcessorFn | undefined {
    return IMPORT_PROCESSORS[sourceId]
}

/**
 * Verifica si una fuente tiene procesador implementado
 */
export function isSourceImplemented(sourceId: ImportSourceId): boolean {
    return sourceId in IMPORT_PROCESSORS
}
