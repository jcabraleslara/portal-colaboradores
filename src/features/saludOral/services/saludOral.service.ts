/**
 * Servicio para Salud Oral (Odontología)
 * Maneja CRUD y lógica de negocio para registros odontológicos
 */

import { supabase } from '@/config/supabase.config'
import type {
    OdRegistro,
    OdRegistroCreate,
    OdRegistroUpdate,
    OdFilters,
    OdMetrics,
    PaginatedResponse,
    Sede,
} from '@/types/saludOral.types'

// ========================================
// TRANSFORMACIONES DB <-> FRONTEND
// ========================================

/**
 * Transforma datos de Supabase a formato frontend (camelCase)
 */
function transformFromDB(data: any): OdRegistro {
    return {
        id: data.id,
        pacienteId: data.paciente_id,
        fechaRegistro: data.fecha_registro,
        colaboradorEmail: data.colaborador_email,
        sede: data.sede,

        // Poblaciones Especiales
        gestante: data.gestante,
        cronicosHta: data.cronicos_hta,
        cronicosDm: data.cronicos_dm,
        cronicosErc: data.cronicos_erc,
        discapacidad: data.discapacidad,
        hemofilia: data.hemofilia,
        vih: data.vih,
        cancer: data.cancer,
        menor5Anios: data.menor_5_anios,

        // COP
        copCariesNoCavitacional: data.cop_caries_no_cavitacional,
        copCariesCavitacional: data.cop_caries_cavitacional,
        copObturados: data.cop_obturados,
        copPerdidos: data.cop_perdidos,
        copSanos: data.cop_sanos,

        // PyM
        pymControlPlaca: data.pym_control_placa,
        pymSellantes: data.pym_sellantes,
        pymSellantesCantidad: data.pym_sellantes_cantidad || 2,
        pymFluorBarniz: data.pym_fluor_barniz,
        pymDetartraje: data.pym_detartraje,
        pymProfilaxis: data.pym_profilaxis,
        pymEducacion: data.pym_educacion,

        // Procedimientos
        tipoConsulta: data.tipo_consulta,
        remisionEspecialidades: data.remision_especialidades,

        resina1sup: data.resina_1sup,
        resina2sup: data.resina_2sup,
        resina3sup: data.resina_3sup,

        ionomero1sup: data.ionomero_1sup,
        ionomero2sup: data.ionomero_2sup,
        ionomero3sup: data.ionomero_3sup,

        obturacionTemporal: data.obturacion_temporal,
        pulpectomia: data.pulpectomia,
        pulpotomia: data.pulpotomia,

        terapiaConductoTipo: data.terapia_conducto_tipo,
        terapiaConductoRaices: data.terapia_conducto_raices,
        terapiaConductoCantidad: data.terapia_conducto_cantidad,

        exodonciaTipo: data.exodoncia_tipo,
        exodonciaRaices: data.exodoncia_raices,
        exodonciaIncluido: data.exodoncia_incluido,
        exodonciaCantidad: data.exodoncia_cantidad,

        controlPostquirurgico: data.control_postquirurgico,

        rxSuperiores: data.rx_superiores,
        rxInferiores: data.rx_inferiores,
        rxMolares: data.rx_molares,
        rxPremolares: data.rx_premolares,
        rxCaninos: data.rx_caninos,

        tratamientoFinalizado: data.tratamiento_finalizado,

        createdAt: data.created_at,
        updatedAt: data.updated_at,
    }
}

/**
 * Transforma datos del frontend a formato DB (snake_case)
 */
function transformToDB(data: OdRegistroCreate | OdRegistroUpdate): any {
    const dbData: any = {}

    if (data.pacienteId !== undefined) dbData.paciente_id = data.pacienteId
    if (data.fechaRegistro !== undefined) dbData.fecha_registro = data.fechaRegistro
    if (data.colaboradorEmail !== undefined) dbData.colaborador_email = data.colaboradorEmail
    if (data.sede !== undefined) dbData.sede = data.sede

    // Poblaciones Especiales
    if (data.gestante !== undefined) dbData.gestante = data.gestante
    if (data.cronicosHta !== undefined) dbData.cronicos_hta = data.cronicosHta
    if (data.cronicosDm !== undefined) dbData.cronicos_dm = data.cronicosDm
    if (data.cronicosErc !== undefined) dbData.cronicos_erc = data.cronicosErc
    if (data.discapacidad !== undefined) dbData.discapacidad = data.discapacidad
    if (data.hemofilia !== undefined) dbData.hemofilia = data.hemofilia
    if (data.vih !== undefined) dbData.vih = data.vih
    if (data.cancer !== undefined) dbData.cancer = data.cancer
    if (data.menor5Anios !== undefined) dbData.menor_5_anios = data.menor5Anios

    // COP
    if (data.copCariesNoCavitacional !== undefined) dbData.cop_caries_no_cavitacional = data.copCariesNoCavitacional
    if (data.copCariesCavitacional !== undefined) dbData.cop_caries_cavitacional = data.copCariesCavitacional
    if (data.copObturados !== undefined) dbData.cop_obturados = data.copObturados
    if (data.copPerdidos !== undefined) dbData.cop_perdidos = data.copPerdidos
    if (data.copSanos !== undefined) dbData.cop_sanos = data.copSanos

    // PyM
    if (data.pymControlPlaca !== undefined) dbData.pym_control_placa = data.pymControlPlaca
    if (data.pymSellantes !== undefined) dbData.pym_sellantes = data.pymSellantes
    if (data.pymSellantesCantidad !== undefined) dbData.pym_sellantes_cantidad = data.pymSellantesCantidad
    if (data.pymFluorBarniz !== undefined) dbData.pym_fluor_barniz = data.pymFluorBarniz
    if (data.pymDetartraje !== undefined) dbData.pym_detartraje = data.pymDetartraje
    if (data.pymProfilaxis !== undefined) dbData.pym_profilaxis = data.pymProfilaxis
    if (data.pymEducacion !== undefined) dbData.pym_educacion = data.pymEducacion

    // Procedimientos
    if (data.tipoConsulta !== undefined) dbData.tipo_consulta = data.tipoConsulta
    if (data.remisionEspecialidades !== undefined) dbData.remision_especialidades = data.remisionEspecialidades

    if (data.resina1sup !== undefined) dbData.resina_1sup = data.resina1sup
    if (data.resina2sup !== undefined) dbData.resina_2sup = data.resina2sup
    if (data.resina3sup !== undefined) dbData.resina_3sup = data.resina3sup

    if (data.ionomero1sup !== undefined) dbData.ionomero_1sup = data.ionomero1sup
    if (data.ionomero2sup !== undefined) dbData.ionomero_2sup = data.ionomero2sup
    if (data.ionomero3sup !== undefined) dbData.ionomero_3sup = data.ionomero3sup

    if (data.obturacionTemporal !== undefined) dbData.obturacion_temporal = data.obturacionTemporal
    if (data.pulpectomia !== undefined) dbData.pulpectomia = data.pulpectomia
    if (data.pulpotomia !== undefined) dbData.pulpotomia = data.pulpotomia

    if (data.terapiaConductoTipo !== undefined) dbData.terapia_conducto_tipo = data.terapiaConductoTipo
    if (data.terapiaConductoRaices !== undefined) dbData.terapia_conducto_raices = data.terapiaConductoRaices
    if (data.terapiaConductoCantidad !== undefined) dbData.terapia_conducto_cantidad = data.terapiaConductoCantidad

    if (data.exodonciaTipo !== undefined) dbData.exodoncia_tipo = data.exodonciaTipo
    if (data.exodonciaRaices !== undefined) dbData.exodoncia_raices = data.exodonciaRaices
    if (data.exodonciaIncluido !== undefined) dbData.exodoncia_incluido = data.exodonciaIncluido
    if (data.exodonciaCantidad !== undefined) dbData.exodoncia_cantidad = data.exodonciaCantidad

    if (data.controlPostquirurgico !== undefined) dbData.control_postquirurgico = data.controlPostquirurgico

    if (data.rxSuperiores !== undefined) dbData.rx_superiores = data.rxSuperiores
    if (data.rxInferiores !== undefined) dbData.rx_inferiores = data.rxInferiores
    if (data.rxMolares !== undefined) dbData.rx_molares = data.rxMolares
    if (data.rxPremolares !== undefined) dbData.rx_premolares = data.rxPremolares
    if (data.rxCaninos !== undefined) dbData.rx_caninos = data.rxCaninos

    if (data.tratamientoFinalizado !== undefined) dbData.tratamiento_finalizado = data.tratamientoFinalizado

    return dbData
}

// ========================================
// FUNCIONES CRUD
// ========================================

/**
 * Obtiene todos los registros con filtros opcionales y paginación
 */
async function getAll(filters?: OdFilters): Promise<PaginatedResponse<OdRegistro>> {
    let query = supabase
        .from('od')
        .select('*', { count: 'exact' })

    // Ordenamiento
    if (filters?.sortBy) {
        const sortFieldMap: Record<string, string> = {
            fechaRegistro: 'fecha_registro',
            pacienteId: 'paciente_id',
            colaboradorEmail: 'colaborador_email',
            sede: 'sede',
            createdAt: 'created_at',
        }
        const sortField = sortFieldMap[filters.sortBy] || 'fecha_registro'
        query = query.order(sortField, { ascending: filters.sortOrder === 'asc' })
    } else {
        query = query.order('fecha_registro', { ascending: false })
    }

    // Aplicar filtros
    if (filters?.pacienteId) {
        query = query.ilike('paciente_id', `%${filters.pacienteId}%`)
    }

    if (filters?.fechaInicio) {
        query = query.gte('fecha_registro', filters.fechaInicio)
    }

    if (filters?.fechaFin) {
        query = query.lte('fecha_registro', filters.fechaFin)
    }

    if (filters?.colaboradorEmail) {
        query = query.eq('colaborador_email', filters.colaboradorEmail)
    }

    if (filters?.sede) {
        query = query.eq('sede', filters.sede)
    }

    if (filters?.tratamientoFinalizado !== undefined) {
        query = query.eq('tratamiento_finalizado', filters.tratamientoFinalizado)
    }

    // Filtro por actividad específica
    if (filters?.actividad) {
        const act = filters.actividad
        switch (act) {
            case 'fluor':
                query = query.eq('pym_fluor_barniz', true)
                break
            case 'sellantes':
                query = query.eq('pym_sellantes', true)
                break
            case 'detartraje':
                query = query.eq('pym_detartraje', true)
                break
            case 'control_placa':
                query = query.eq('pym_control_placa', true)
                break
            case 'profilaxis':
                query = query.eq('pym_profilaxis', true)
                break
            case 'educacion':
                query = query.eq('pym_educacion', true)
                break
            case 'resina':
                query = query.or('resina_1sup.gt.0,resina_2sup.gt.0,resina_3sup.gt.0')
                break
            case 'ionomero':
                query = query.or('ionomero_1sup.gt.0,ionomero_2sup.gt.0,ionomero_3sup.gt.0')
                break
            case 'obturacion_temporal':
                query = query.gt('obturacion_temporal', 0)
                break
            case 'pulpectomia':
                query = query.gt('pulpectomia', 0)
                break
            case 'pulpotomia':
                query = query.gt('pulpotomia', 0)
                break
            case 'terapia_conducto':
                query = query.gt('terapia_conducto_cantidad', 0)
                break
            case 'exodoncia':
                query = query.gt('exodoncia_cantidad', 0)
                break
            case 'control_postquirurgico':
                query = query.eq('control_postquirurgico', true)
                break
            case 'rx':
                query = query.or('rx_superiores.eq.true,rx_inferiores.eq.true,rx_molares.eq.true,rx_premolares.eq.true,rx_caninos.eq.true')
                break
        }
    }

    // Paginación
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
        throw new Error(`Error obteniendo registros de salud oral: ${error.message}`)
    }

    return {
        data: (data || []).map(transformFromDB),
        count: count || 0,
    }
}

/**
 * Obtiene un registro por ID
 */
async function getById(id: string): Promise<OdRegistro | null> {
    const { data, error } = await supabase
        .from('od')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !data) {
        return null
    }

    return transformFromDB(data)
}

/**
 * Crea un nuevo registro
 */
async function create(registro: OdRegistroCreate): Promise<OdRegistro> {
    const dbData = transformToDB(registro)

    const { data, error } = await supabase
        .from('od')
        .insert(dbData)
        .select()
        .single()

    if (error) {
        throw new Error(`Error creando registro de salud oral: ${error.message}`)
    }

    return transformFromDB(data)
}

/**
 * Actualiza un registro existente
 */
async function update(id: string, registro: OdRegistroUpdate): Promise<OdRegistro> {
    const dbData = transformToDB(registro)

    const { data, error } = await supabase
        .from('od')
        .update(dbData)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        throw new Error(`Error actualizando registro de salud oral: ${error.message}`)
    }

    return transformFromDB(data)
}

/**
 * Elimina un registro por ID
 */
async function deleteRecord(id: string): Promise<void> {
    const { error } = await supabase
        .from('od')
        .delete()
        .eq('id', id)

    if (error) {
        throw new Error(`Error eliminando registro de salud oral: ${error.message}`)
    }
}

// ========================================
// MÉTRICAS Y ESTADÍSTICAS
// ========================================

/**
 * Obtiene métricas generales
 */
async function getMetrics(filters?: OdFilters): Promise<OdMetrics> {
    // Query base con campos mínimos para cálculos
    let query = supabase
        .from('od')
        .select('colaborador_email, sede, tratamiento_finalizado')

    // Aplicar filtros
    if (filters?.fechaInicio) {
        query = query.gte('fecha_registro', filters.fechaInicio)
    }
    if (filters?.fechaFin) {
        query = query.lte('fecha_registro', filters.fechaFin)
    }
    if (filters?.colaboradorEmail) {
        query = query.eq('colaborador_email', filters.colaboradorEmail)
    }
    if (filters?.sede) {
        query = query.eq('sede', filters.sede)
    }

    const { data: registros, error } = await query.limit(10000)

    if (error) {
        console.error('Error calculando métricas:', error)
        return {
            totalRegistros: 0,
            registrosMesActual: 0,
            tratamientosFinalizados: 0,
            porcentajeFinalizados: 0,
            pymMesActual: { fluor: 0, sellantes: 0, detartraje: 0, controlPlaca: 0 },
            porSede: { 'Montería': 0, 'Cereté': 0, 'Ciénaga de Oro': 0 },
            topColaborador: null,
        }
    }

    const datos = registros || []

    // Casos del mes actual
    const hoy = new Date()
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]

    const { count: registrosMesActual } = await supabase
        .from('od')
        .select('id', { count: 'exact', head: true })
        .gte('fecha_registro', primerDiaMes)

    // Query para métricas PyM del mes actual
    const { data: pymData } = await supabase
        .from('od')
        .select('pym_fluor_barniz, pym_sellantes, pym_detartraje, pym_control_placa, tratamiento_finalizado')
        .gte('fecha_registro', primerDiaMes)

    const pymMesActual = {
        fluor: (pymData || []).filter((r: any) => r.pym_fluor_barniz).length,
        sellantes: (pymData || []).filter((r: any) => r.pym_sellantes).length,
        detartraje: (pymData || []).filter((r: any) => r.pym_detartraje).length,
        controlPlaca: (pymData || []).filter((r: any) => r.pym_control_placa).length,
    }

    // Porcentaje de finalizados del mes
    const finalizadosMes = (pymData || []).filter((r: any) => r.tratamiento_finalizado).length
    const totalMes = registrosMesActual || 0
    const porcentajeFinalizados = totalMes > 0 ? Math.round((finalizadosMes / totalMes) * 100) : 0

    // Cálculos
    const totalRegistros = datos.length
    const tratamientosFinalizados = datos.filter((r: any) => r.tratamiento_finalizado).length

    // Por sede
    const porSede: Record<Sede, number> = {
        'Montería': 0,
        'Cereté': 0,
        'Ciénaga de Oro': 0,
    }
    datos.forEach((r: any) => {
        if (r.sede && porSede[r.sede as Sede] !== undefined) {
            porSede[r.sede as Sede]++
        }
    })



    // Top colaborador
    const colaboradorStats = new Map<string, number>()
    datos.forEach((r: any) => {
        if (r.colaborador_email) {
            colaboradorStats.set(
                r.colaborador_email,
                (colaboradorStats.get(r.colaborador_email) || 0) + 1
            )
        }
    })

    let topColaborador: { email: string; nombre: string; total: number } | null = null
    let maxCasos = 0
    colaboradorStats.forEach((total, email) => {
        if (total > maxCasos) {
            maxCasos = total
            topColaborador = {
                email,
                nombre: email.split('@')[0], // Simplificado, idealmente buscar en usuarios_portal
                total,
            }
        }
    })

    return {
        totalRegistros,
        registrosMesActual: registrosMesActual || 0,
        tratamientosFinalizados,
        porcentajeFinalizados,
        pymMesActual,
        porSede,
        topColaborador,
    }
}

/**
 * Obtiene lista única de colaboradores con sus nombres completos
 * @returns Record donde la key es el email y el value es el nombre completo
 */
async function getColaboradores(): Promise<Record<string, string>> {
    // Primero obtener los emails únicos de los colaboradores
    const { data: odData, error: odError } = await supabase
        .from('od')
        .select('colaborador_email')
        .order('colaborador_email')

    if (odError) {
        console.error('Error obteniendo colaboradores:', odError)
        return {}
    }

    const uniqueEmails = [...new Set((odData || []).map((d: any) => d.colaborador_email))].filter(Boolean)

    if (uniqueEmails.length === 0) {
        return {}
    }

    // Obtener nombres completos desde usuarios_portal
    const { data: usuariosData, error: usuariosError } = await supabase
        .from('usuarios_portal')
        .select('email_institucional, nombre_completo')
        .in('email_institucional', uniqueEmails)

    if (usuariosError) {
        console.error('Error obteniendo nombres de usuarios:', usuariosError)
        // Si falla, convertir emails a formato simple (fallback)
        return Object.fromEntries(
            uniqueEmails.map(email => [email, email.split('@')[0]])
        )
    }

    // Crear mapa de email => nombre
    const colaboradoresMap: Record<string, string> = {}

    usuariosData?.forEach((usuario: any) => {
        colaboradoresMap[usuario.email_institucional] = usuario.nombre_completo
    })

    // Agregar emails que no están en usuarios_portal con formato simple (fallback)
    uniqueEmails.forEach(email => {
        if (!colaboradoresMap[email]) {
            colaboradoresMap[email] = email.split('@')[0]
        }
    })

    return colaboradoresMap
}

/**
 * Obtiene registros por paciente
 */
async function getByPaciente(pacienteId: string): Promise<OdRegistro[]> {
    const { data, error } = await supabase
        .from('od')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('fecha_registro', { ascending: false })

    if (error) {
        throw new Error(`Error obteniendo registros del paciente: ${error.message}`)
    }

    return (data || []).map(transformFromDB)
}

// ========================================
// EXPORT
// ========================================

export const saludOralService = {
    getAll,
    getById,
    create,
    update,
    delete: deleteRecord,
    getMetrics,
    getColaboradores,
    getByPaciente,
}
