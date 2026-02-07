/**
 * Índice de servicios de importación
 * Mapea cada fuente a su función procesadora
 */

import type { ImportSourceId, ImportProcessorFn, CloudImportProcessorFn } from '../types/import.types'
import { processCitasFile } from './citasImportService'
import { processCirugiasFile } from './cirugiasImportService'
import { processIncapacidadesFile } from './incapacidadesImportService'
import { processOrdenamientosFile } from './ordenamientosImportService'
import { processImagenesFile } from './imagenesImportService'
import { processBdSaludTotalFile } from './bdSaludTotalImportService'
import { processBdSigiresSTFile } from './bdSigiresSTimportService'
import { processSigiresNepsFile } from './sigiresNepsImportService'
import { processBdNepsCloud } from './bdNepsCloudImportService'

// Re-export para compatibilidad con código existente
export { processCitasFile } from './citasImportService'
export { processCirugiasFile } from './cirugiasImportService'
export { processIncapacidadesFile } from './incapacidadesImportService'
export { processOrdenamientosFile } from './ordenamientosImportService'
export { processImagenesFile } from './imagenesImportService'
export { processBdSaludTotalFile } from './bdSaludTotalImportService'
export { processBdSigiresSTFile } from './bdSigiresSTimportService'
export { processSigiresNepsFile } from './sigiresNepsImportService'
export { processBdNepsCloud } from './bdNepsCloudImportService'

/**
 * Registro de procesadores por fuente (modo archivo)
 * Agregar nuevos procesadores aquí conforme se implementen
 */
const IMPORT_PROCESSORS: Partial<Record<ImportSourceId, ImportProcessorFn>> = {
    'citas': processCitasFile,
    'cirugias': processCirugiasFile,
    'incapacidades': processIncapacidadesFile,
    'ordenamientos': processOrdenamientosFile,
    'imagenes': processImagenesFile,
    'bd-salud-total': processBdSaludTotalFile,
    'bd-sigires-st': processBdSigiresSTFile,
    'bd-sigires-neps': processSigiresNepsFile,
}

/**
 * Registro de procesadores cloud (sin archivo, descarga desde la nube)
 */
const CLOUD_IMPORT_PROCESSORS: Partial<Record<ImportSourceId, CloudImportProcessorFn>> = {
    'bd-neps': processBdNepsCloud,
}

/**
 * Obtiene el procesador de archivos para una fuente específica
 * Retorna undefined si la fuente no está implementada
 */
export function getImportProcessor(sourceId: ImportSourceId): ImportProcessorFn | undefined {
    return IMPORT_PROCESSORS[sourceId]
}

/**
 * Obtiene el procesador cloud para una fuente específica
 * Retorna undefined si la fuente no tiene procesador cloud
 */
export function getCloudImportProcessor(sourceId: ImportSourceId): CloudImportProcessorFn | undefined {
    return CLOUD_IMPORT_PROCESSORS[sourceId]
}

/**
 * Verifica si una fuente tiene procesador implementado (archivo o cloud)
 */
export function isSourceImplemented(sourceId: ImportSourceId): boolean {
    return sourceId in IMPORT_PROCESSORS || sourceId in CLOUD_IMPORT_PROCESSORS
}
