/**
 * Utilidad de Exportación CUPS para Salud Oral
 * Genera informes con mapeo de códigos CUPS
 */

import * as XLSX from 'xlsx'
import { saludOralService } from '../services/saludOral.service'
import type { OdRegistro, OdFilters } from '@/types/saludOral.types'

// Mapeo CUPS actualizado con códigos de 10 dígitos (formato oficial)
const CUPS_MAP: Record<string, { cups: string; descripcion: string }> = {
    // Tipo de consulta
    primera_vez: { cups: '8902030000', descripcion: 'CONSULTA DE PRIMERA VEZ POR ODONTOLOGIA GENERAL' },
    control: { cups: '8903030000', descripcion: 'CONSULTA DE CONTROL POR ODONTOLOGIA GENERAL' },
    urgencias: { cups: '8907030000', descripcion: 'CONSULTA DE URGENCIAS POR ODONTOLOGIA GENERAL' },

    // Remisión
    remision_especialidades: { cups: '8902040000', descripcion: 'CONSULTA DE PRIMERA VEZ POR ESPECIALISTA EN ODONTOLOGIA' },

    // PyM (Prevención y Mantenimiento)
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

    // Radiografías (códigos específicos por tipo)
    rx_superiores: { cups: '8704510000', descripcion: 'RADIOGRAFIAS INTRAORALES PERIAPICALES DIENTES ANTERIORES SUPERIORES' },
    rx_inferiores: { cups: '8704520100', descripcion: 'RADIOGRAFIAS INTRAORALES PERIAPICALES DIENTES ANTERIORES INFERIORES' },
    rx_molares: { cups: '8704550000', descripcion: 'RADIOGRAFIAS INTRAORALES PERIAPICALES MOLARES' },
    rx_premolares: { cups: '8704540100', descripcion: 'RADIOGRAFIAS INTRAORALES PERIAPICALES PREMOLARES' },
    rx_caninos: { cups: '8704530100', descripcion: 'RADIOGRAFIAS INTRAORALES PERIAPICALES ZONA DE CANINOS' },
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
function generarFilasCups(registro: OdRegistro, colaboradoresMap?: Record<string, string>): CupsExportRow[] {
    const rows: CupsExportRow[] = []
    const nombreColaborador = colaboradoresMap?.[registro.colaboradorEmail] || registro.colaboradorEmail.split('@')[0]

    const baseRow = {
        fecha: registro.fechaRegistro,
        identificacion: registro.pacienteId,
        sede: registro.sede,
        colaborador: nombreColaborador,
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

    // Radiografías (códigos específicos por tipo)
    if (registro.rxSuperiores) {
        const map = CUPS_MAP.rx_superiores
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: 1 })
    }
    if (registro.rxInferiores) {
        const map = CUPS_MAP.rx_inferiores
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: 1 })
    }
    if (registro.rxMolares) {
        const map = CUPS_MAP.rx_molares
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: 1 })
    }
    if (registro.rxPremolares) {
        const map = CUPS_MAP.rx_premolares
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: 1 })
    }
    if (registro.rxCaninos) {
        const map = CUPS_MAP.rx_caninos
        rows.push({ ...baseRow, cups: map.cups, descripcion: map.descripcion, cantidad: 1 })
    }

    return rows
}

/**
 * Exporta informe CUPS en formato CSV
 * Por defecto, filtra solo pacientes con IPS primaria 'GESTAR SALUD DE COLOMBIA CERETE%'
 */
export async function exportarInformeCups(filters?: OdFilters): Promise<void> {
    // Importar supabase para hacer la consulta de filtrado
    const { supabase } = await import('@/config/supabase.config')

    // Obtener mapa de colaboradores
    const colaboradoresMap = await saludOralService.getColaboradores()

    // Obtener todos los registros con los filtros aplicados
    const { data: registros } = await saludOralService.getAll({
        ...filters,
        page: 1,
        pageSize: 100000, // Obtener todos
    })

    if (registros.length === 0) {
        throw new Error('No hay datos para exportar')
    }

    // Filtrar solo registros de pacientes con IPS primaria 'GESTAR SALUD DE COLOMBIA CERETE%'
    const pacientesIds = [...new Set(registros.map(r => r.pacienteId))]

    const { data: afiliadosCerete, error } = await supabase
        .from('afiliados')
        .select('numero_documento')
        .in('numero_documento', pacientesIds)
        .ilike('ips_primaria', 'GESTAR SALUD DE COLOMBIA CERETE%')

    if (error) {
        console.error('Error filtrando por IPS primaria:', error)
        throw new Error('Error al filtrar pacientes por IPS primaria')
    }

    // Crear set con los documentos válidos
    const documentosValidos = new Set(afiliadosCerete?.map(a => a.numero_documento) || [])

    // Filtrar registros solo de pacientes con IPS primaria válida
    const registrosFiltrados = registros.filter(r => documentosValidos.has(r.pacienteId))

    if (registrosFiltrados.length === 0) {
        throw new Error('No hay registros de pacientes con IPS primaria GESTAR SALUD DE COLOMBIA CERETE')
    }

    // Generar filas CUPS
    const allRows: CupsExportRow[] = []
    for (const registro of registrosFiltrados) {
        const rows = generarFilasCups(registro, colaboradoresMap)
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

    // Agregar BOM UTF-8 para correcta visualización de caracteres especiales en Excel
    const csvWithBom = '\uFEFF' + csv

    // Descargar
    const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `salud_oral_cups_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
}

/**
 * Exporta informe completo en Excel
 * Por defecto, filtra solo pacientes con IPS primaria 'GESTAR SALUD DE COLOMBIA CERETE%'
 */
export async function exportarInformeExcel(filters?: OdFilters): Promise<void> {
    // Importar supabase para hacer la consulta de filtrado
    const { supabase } = await import('@/config/supabase.config')

    // Obtener mapa de colaboradores
    const colaboradoresMap = await saludOralService.getColaboradores()

    // Obtener todos los registros
    const { data: registros } = await saludOralService.getAll({
        ...filters,
        page: 1,
        pageSize: 100000,
    })

    if (registros.length === 0) {
        throw new Error('No hay datos para exportar')
    }

    // Filtrar solo registros de pacientes con IPS primaria 'GESTAR SALUD DE COLOMBIA CERETE%'
    const pacientesIds = [...new Set(registros.map(r => r.pacienteId))]

    const { data: afiliadosCerete, error } = await supabase
        .from('afiliados')
        .select('numero_documento')
        .in('numero_documento', pacientesIds)
        .ilike('ips_primaria', 'GESTAR SALUD DE COLOMBIA CERETE%')

    if (error) {
        console.error('Error filtrando por IPS primaria:', error)
        throw new Error('Error al filtrar pacientes por IPS primaria')
    }

    // Crear set con los documentos válidos
    const documentosValidos = new Set(afiliadosCerete?.map(a => a.numero_documento) || [])

    // Filtrar registros solo de pacientes con IPS primaria válida
    const registrosFiltrados = registros.filter(r => documentosValidos.has(r.pacienteId))

    if (registrosFiltrados.length === 0) {
        throw new Error('No hay registros de pacientes con IPS primaria GESTAR SALUD DE COLOMBIA CERETE')
    }

    // Formatear datos completos
    const exportData = registrosFiltrados.map((reg) => ({
        'ID': reg.id,
        'Fecha Registro': reg.fechaRegistro,
        'Identificación Paciente': reg.pacienteId,
        'Sede': reg.sede,
        'Colaborador': colaboradoresMap[reg.colaboradorEmail] || reg.colaboradorEmail,

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
    for (const registro of registrosFiltrados) {
        cupsRows.push(...generarFilasCups(registro, colaboradoresMap))
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
