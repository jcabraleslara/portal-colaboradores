/**
 * Barrel exports para el módulo Salud Oral
 */

// Página principal
export { default as SaludOralPage } from './SaludOralPage'

// Componentes
export { NumberSelector } from './components/NumberSelector'
export { ToggleBadge } from './components/ToggleBadge'
export { MetricCard, MetricGrid } from './components/MetricCards'
export { PacienteFrame } from './components/PacienteFrame'
export { PoblacionesEspecialesFrame } from './components/PoblacionesEspecialesFrame'
export { IndiceCopFrame } from './components/IndiceCopFrame'
export { PymFrame } from './components/PymFrame'
export { ProcedimientosFrame } from './components/ProcedimientosFrame'
export { OdDetallePanel } from './components/OdDetallePanel'
export { RegistroCasoTab } from './components/RegistroCasoTab'
export { HistoricoTab } from './components/HistoricoTab'

// Hooks
export {
    useSaludOralList,
    useSaludOralDetail,
    useSaludOralMetrics,
    useSaludOralColaboradores,
    useSaludOralByPaciente,
    useCrearSaludOral,
    useActualizarSaludOral,
    useEliminarSaludOral,
} from './hooks/useSaludOral'

// Servicio
export { saludOralService } from './services/saludOral.service'

// Schemas
export {
    odRegistroSchema,
    validarIndiceCOP,
    validarTerapiaConducto,
    validarExodoncia,
    getDefaultOdRegistro,
} from './schemas/saludOral.schema'
export type { OdRegistroFormData } from './schemas/saludOral.schema'

// Utilidades
export { exportarInformeCups, exportarInformeExcel } from './utils/cupsExport'
