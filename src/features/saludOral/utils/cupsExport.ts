/**
 * Utilidad de Exportación CUPS para Salud Oral
 * Genera informes con mapeo de códigos CUPS
 */

import * as XLSX from 'xlsx'
import { saludOralService } from '../services/saludOral.service'
import type { OdRegistro, OdFilters } from '@/types/saludOral.types'

// Re-importar el mapeo CUPS del archivo de tipos
const CUPS_MAP: Record<string, { cups: string; descripcion: string }> = {
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
}

interface CupsExportRow {
    fecha: string
    identificacion: string
    cups: string
    descripcion: string
    cantidad: number
    sede: string
    colaborador: string
}

/**
 * Genera filas de exportación CUPS a partir de un registro
 */
function generarFilasCups(registro: OdRegistro): CupsExportRow[] {
    const rows: CupsExportRow[] = []
    const baseRow = {
        fecha: registro.fechaRegistro,
        identificacion: registro.pacienteId,
        sede: registro.sede,
        colaborador: registro.colaboradorEmail.split('@')[0],
    }

    // Tipo de consulta
    if (registro.tipoConsulta) {
        const map = CUPS_MAP[registro.tipoConsulta]
        if (map) {
            rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: 1 })
        }
    }

    // Remisión
    if (registro.remisionEspecialidades) {
        const map = CUPS_MAP.remision_especialidades
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: 1 })
    }

    // PyM
    if (registro.pymControlPlaca) {
        const map = CUPS_MAP.pym_control_placa
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: 1 })
    }
    if (registro.pymSellantes) {
        const map = CUPS_MAP.pym_sellantes
        // Usar la cantidad registrada, o 1 si no está definida (aunque debería estarlo por defecto 2)
        const cantidad = (registro.pymSellantesCantidad && registro.pymSellantesCantidad > 0)
            ? registro.pymSellantesCantidad
            : 1
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad })
    }
    if (registro.pymFluorBarniz) {
        const map = CUPS_MAP.pym_fluor_barniz
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: 1 })
    }
    if (registro.pymDetartraje) {
        const map = CUPS_MAP.pym_detartraje
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: 1 })
    }
    if (registro.pymProfilaxis) {
        const map = CUPS_MAP.pym_profilaxis
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: 1 })
    }
    if (registro.pymEducacion) {
        const map = CUPS_MAP.pym_educacion
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: 1 })
    }

    // Resinas
    if (registro.resina1sup > 0) {
        const map = CUPS_MAP.resina_1sup
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: registro.resina1sup })
    }
    if (registro.resina2sup > 0) {
        const map = CUPS_MAP.resina_2sup
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: registro.resina2sup })
    }
    if (registro.resina3sup > 0) {
        const map = CUPS_MAP.resina_3sup
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: registro.resina3sup })
    }

    // Ionómeros
    if (registro.ionomero1sup > 0) {
        const map = CUPS_MAP.ionomero_1sup
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: registro.ionomero1sup })
    }
    if (registro.ionomero2sup > 0) {
        const map = CUPS_MAP.ionomero_2sup
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: registro.ionomero2sup })
    }
    if (registro.ionomero3sup > 0) {
        const map = CUPS_MAP.ionomero_3sup
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: registro.ionomero3sup })
    }

    // Obturación temporal
    if (registro.obturacionTemporal > 0) {
        const map = CUPS_MAP.obturacion_temporal
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: registro.obturacionTemporal })
    }

    // Pulpa
    if (registro.pulpectomia > 0) {
        const map = CUPS_MAP.pulpectomia
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: registro.pulpectomia })
    }
    if (registro.pulpotomia > 0) {
        const map = CUPS_MAP.pulpotomia
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: registro.pulpotomia })
    }

    // Terapia de conducto
    if (registro.terapiaConductoCantidad > 0 && registro.terapiaConductoTipo && registro.terapiaConductoRaices) {
        const key = `terapia_conducto_${registro.terapiaConductoTipo}_${registro.terapiaConductoRaices}`
        const map = CUPS_MAP[key]
        if (map) {
            rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: registro.terapiaConductoCantidad })
        }
    }

    // Exodoncias
    if (registro.exodonciaCantidad > 0) {
        if (registro.exodonciaIncluido) {
            const map = CUPS_MAP.exodoncia_incluido
            rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: registro.exodonciaCantidad })
        } else if (registro.exodonciaTipo && registro.exodonciaRaices) {
            const key = `exodoncia_${registro.exodonciaTipo}_${registro.exodonciaRaices}`
            const map = CUPS_MAP[key]
            if (map) {
                rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: registro.exodonciaCantidad })
            }
        }
    }

    // Control post-quirúrgico
    if (registro.controlPostquirurgico) {
        const map = CUPS_MAP.control_postquirurgico
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: 1 })
    }

    // Radiografías (todas van al mismo código para simplificar)
    const rxCount = [
        registro.rxSuperiores,
        registro.rxInferiores,
        registro.rxMolares,
        registro.rxPremolares,
        registro.rxCaninos,
    ].filter(Boolean).length

    if (rxCount > 0) {
        const map = CUPS_MAP.rx_periapical
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: rxCount })
    }

    return rows
}

/**
 * Exporta informe CUPS en formato CSV
 */
export async function exportarInformeCups(filters?: OdFilters): Promise<void> {
    // Obtener todos los registros con los filtros aplicados
    const { data: registros } = await saludOralService.getAll({
        ...filters,
        page: 1,
        pageSize: 100000, // Obtener todos
    })

    if (registros.length === 0) {
        throw new Error('No hay datos para exportar')
    }

    // Generar filas CUPS
    const allRows: CupsExportRow[] = []
    for (const registro of registros) {
        const rows = generarFilasCups(registro)
        allRows.push(...rows)
    }

    if (allRows.length === 0) {
        throw new Error('No hay procedimientos para exportar')
    }

    // Crear Excel/CSV
    const exportData = allRows.map((row) => ({
        'Fecha': row.fecha,
        'Identificación': row.identificacion,
        'CUPS': row.cups,
        'Descripción': row.descripcion,
        'Cantidad': row.cantidad,
        'Sede': row.sede,
        'Colaborador': row.colaborador,
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const csv = XLSX.utils.sheet_to_csv(ws)

    // Descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `salud_oral_cups_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
}

/**
 * Exporta informe completo en Excel
 */
export async function exportarInformeExcel(filters?: OdFilters): Promise<void> {
    // Obtener todos los registros
    const { data: registros } = await saludOralService.getAll({
        ...filters,
        page: 1,
        pageSize: 100000,
    })

    if (registros.length === 0) {
        throw new Error('No hay datos para exportar')
    }

    // Formatear datos completos
    const exportData = registros.map((reg) => ({
        'ID': reg.id,
        'Fecha Registro': reg.fechaRegistro,
        'Identificación Paciente': reg.pacienteId,
        'Sede': reg.sede,
        'Colaborador': reg.colaboradorEmail,

        // Poblaciones
        'Gestante': reg.gestante ? 'Sí' : 'No',
        'HTA': reg.cronicosHta ? 'Sí' : 'No',
        'Diabetes': reg.cronicosDm ? 'Sí' : 'No',
        'ERC': reg.cronicosErc ? 'Sí' : 'No',
        'Discapacidad': reg.discapacidad ? 'Sí' : 'No',
        'Hemofilia': reg.hemofilia ? 'Sí' : 'No',
        'VIH': reg.vih ? 'Sí' : 'No',
        'Cáncer': reg.cancer ? 'Sí' : 'No',
        'Menor 5 años': reg.menor5Anios ? 'Sí' : 'No',

        // COP
        'COP Caries No Cav': reg.copCariesNoCavitacional,
        'COP Caries Cav': reg.copCariesCavitacional,
        'COP Obturados': reg.copObturados,
        'COP Perdidos': reg.copPerdidos,
        'COP Sanos': reg.copSanos,
        'COP-D Total': reg.copCariesCavitacional + reg.copObturados + reg.copPerdidos,

        // PyM
        'Control Placa': reg.pymControlPlaca ? 'Sí' : 'No',
        'Sellantes': reg.pymSellantes ? 'Sí' : 'No',
        'Sellantes Cantidad': reg.pymSellantes ? reg.pymSellantesCantidad : 0,
        'Flúor Barniz': reg.pymFluorBarniz ? 'Sí' : 'No',
        'Detartraje': reg.pymDetartraje ? 'Sí' : 'No',
        'Profilaxis': reg.pymProfilaxis ? 'Sí' : 'No',
        'Educación': reg.pymEducacion ? 'Sí' : 'No',

        // Procedimientos
        'Tipo Consulta': reg.tipoConsulta || '',
        'Remisión Especialidades': reg.remisionEspecialidades ? 'Sí' : 'No',
        'Resina 1 Sup': reg.resina1sup,
        'Resina 2 Sup': reg.resina2sup,
        'Resina 3+ Sup': reg.resina3sup,
        'Ionómero 1 Sup': reg.ionomero1sup,
        'Ionómero 2 Sup': reg.ionomero2sup,
        'Ionómero 3+ Sup': reg.ionomero3sup,
        'Obturación Temporal': reg.obturacionTemporal,
        'Pulpectomía': reg.pulpectomia,
        'Pulpotomía': reg.pulpotomia,
        'Terapia Conducto Tipo': reg.terapiaConductoTipo || '',
        'Terapia Conducto Raíces': reg.terapiaConductoRaices || '',
        'Terapia Conducto Cantidad': reg.terapiaConductoCantidad,
        'Exodoncia Tipo': reg.exodonciaTipo || '',
        'Exodoncia Raíces': reg.exodonciaRaices || '',
        'Exodoncia Incluido': reg.exodonciaIncluido ? 'Sí' : 'No',
        'Exodoncia Cantidad': reg.exodonciaCantidad,
        'Control Post-Quirúrgico': reg.controlPostquirurgico ? 'Sí' : 'No',

        // RX
        'RX Superiores': reg.rxSuperiores ? 'Sí' : 'No',
        'RX Inferiores': reg.rxInferiores ? 'Sí' : 'No',
        'RX Molares': reg.rxMolares ? 'Sí' : 'No',
        'RX Premolares': reg.rxPremolares ? 'Sí' : 'No',
        'RX Caninos': reg.rxCaninos ? 'Sí' : 'No',

        'Tratamiento Finalizado': reg.tratamientoFinalizado ? 'Sí' : 'No',
        'Fecha Creación': reg.createdAt,
        'Última Actualización': reg.updatedAt,
    }))

    // Crear libro Excel
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Salud Oral')

    // También agregar hoja de CUPS
    const cupsRows: CupsExportRow[] = []
    for (const registro of registros) {
        cupsRows.push(...generarFilasCups(registro))
    }

    if (cupsRows.length > 0) {
        const cupsData = cupsRows.map((row) => ({
            'Fecha': row.fecha,
            'Identificación': row.identificacion,
            'CUPS': row.cups,
            'Descripción': row.descripcion,
            'Cantidad': row.cantidad,
            'Sede': row.sede,
            'Colaborador': row.colaborador,
        }))
        const wsCups = XLSX.utils.json_to_sheet(cupsData)
        XLSX.utils.book_append_sheet(wb, wsCups, 'Informe CUPS')
    }

    // Descargar
    XLSX.writeFile(wb, `salud_oral_completo_${new Date().toISOString().split('T')[0]}.xlsx`)
}
