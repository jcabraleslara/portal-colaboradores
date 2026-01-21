/**
 * Servicio para Demanda Inducida
 * Maneja CRUD y lógica de negocio para casos de demanda inducida
 */

import { supabase } from '@/config/supabase.config'
import type {
    DemandaInducida,
    DemandaInducidaFormData,
    DemandaFilters,
    DemandaMetrics,
} from '@/types/demandaInducida'

/**
 * Transforma datos de Supabase a formato frontend
 */
function transformDemandaFromDB(data: any): DemandaInducida {
    return {
        id: data.id,
        pacienteTipoId: data.paciente_tipo_id,
        pacienteId: data.paciente_id,
        fechaGestion: data.fecha_gestion,
        celular: data.celular,
        horaLlamada: data.hora_llamada,
        clasificacion: data.clasificacion,
        quienRecibeLlamada: data.quien_recibe_llamada,
        relacionUsuario: data.relacion_usuario,
        textoLlamada: data.texto_llamada,
        actividadesRealizadas: data.actividades_realizadas,
        condicionUsuario: data.condicion_usuario,
        soportesRecuperados: data.soportes_recuperados,
        fechaAsignacionCita: data.fecha_asignacion_cita,
        departamento: data.departamento,
        municipio: data.municipio,
        telefonoActualizado: data.telefono_actualizado,
        resultadoLlamada: data.resultado_llamada,
        colaborador: data.colaborador,
        programaDireccionado: data.programa_direccionado,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    }
}

/**
 * Busca pacientes en la base de datos por identificación o nombre
 */
async function buscarPacientes(
    criterio: string
): Promise<any[]> {
    const { data, error } = await supabase
        .from('afiliados')
        .select('*')
        .ilike('busqueda_texto', `%${criterio}%`)
        .limit(10) // Limitamos a 10 resultados para el selector

    if (error) {
        throw new Error(`Error buscando pacientes: ${error.message}`)
    }

    return data || []
}

/**
 * Crea un paciente básico en BD con fuente PORTAL_COLABORADORES
 */
async function crearPacienteBasico(data: {
    tipoId: string
    identificacion: string
    celular?: string
    departamento?: string
    municipio?: string
    correoActualizado?: string
}) {
    const paciente = {
        tipo_id: data.tipoId,
        id: data.identificacion,
        nombres: 'POR DEFINIR',
        apellido1: 'POR DEFINIR',
        apellido2: '',
        telefono: data.celular || null,
        departamento: data.departamento || null,
        municipio: data.municipio || null,
        email: data.correoActualizado || null,
        fuente: 'PORTAL_COLABORADORES',
        estado: 'ACTIVO',
    }

    const { data: result, error } = await supabase.from('bd').insert(paciente).select().single()

    if (error) {
        throw new Error(`Error creando paciente: ${error.message}`)
    }

    return result
}

import type { PaginatedResponse } from '@/types/demandaInducida' // Asegurar import

/**
 * Obtiene todos los casos con filtros opcionales y paginación
 */
async function getAll(filters?: DemandaFilters): Promise<PaginatedResponse<DemandaInducida>> {
    let query = supabase
        .from('demanda_inducida')
        .select('*', { count: 'exact' })

    // Ordenamiento
    if (filters?.sortBy) {
        // Mapeo de campos frontend a DB si es necesario
        const sortField = filters.sortBy === 'fechaGestion' ? 'fecha_gestion' :
            filters.sortBy === 'pacienteId' ? 'paciente_id' :
                filters.sortBy === 'clasificacion' ? 'clasificacion' :
                    filters.sortBy === 'programaDireccionado' ? 'programa_direccionado' :
                        filters.sortBy === 'colaborador' ? 'colaborador' :
                            'fecha_gestion'

        query = query.order(sortField, { ascending: filters.sortOrder === 'asc' })
    } else {
        query = query.order('fecha_gestion', { ascending: false })
    }

    // Aplicar filtros
    if (filters?.busqueda) {
        // Búsqueda por identificación del paciente
        query = query.ilike('paciente_id', `%${filters.busqueda}%`)
    }

    if (filters?.fechaInicio) {
        query = query.gte('fecha_gestion', filters.fechaInicio)
    }

    if (filters?.fechaFin) {
        query = query.lte('fecha_gestion', filters.fechaFin)
    }

    if (filters?.colaborador) {
        query = query.eq('colaborador', filters.colaborador)
    }

    if (filters?.programa) {
        query = query.eq('programa_direccionado', filters.programa)
    }

    if (filters?.clasificacion) {
        query = query.eq('clasificacion', filters.clasificacion)
    }

    // Paginación
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
        throw new Error(`Error obteniendo demandas: ${error.message}`)
    }

    return {
        data: (data || []).map(transformDemandaFromDB),
        count: count || 0
    }
}

/**
 * Obtiene un caso por ID
 */
async function getById(id: number): Promise<DemandaInducida | null> {
    const { data, error } = await supabase
        .from('demanda_inducida')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !data) {
        return null
    }

    return transformDemandaFromDB(data)
}

/**
 * Crea un nuevo caso de demanda inducida
 */
async function create(
    formData: DemandaInducidaFormData,
    nombreColaborador: string
): Promise<DemandaInducida> {
    // Verificar si el paciente existe (búsqueda exacta por ID)
    const result = await buscarPacientes(formData.identificacion)
    const existe = result.some(p => p.id === formData.identificacion)

    // Si no existe, crearlo (usando lógica anterior o manejando el caso)
    if (!existe) {
        // Logica de backup si no existe en afiliados... 
        // Por ahora mantenemos crearPacienteBasico si es necesario, 
        // pero ajustado a que bd puede ser diferente a afiliados.
        // Si el usuario dijo "buscar en afiliados", asumimos que la data viene de ahi.
        // Si no existe, intentamos crearlo en 'bd' como antes para no romper FKs
        await crearPacienteBasico({
            tipoId: formData.tipoId,
            identificacion: formData.identificacion,
            celular: formData.celular,
            departamento: formData.departamento,
            municipio: formData.municipio,
        })
    }

    // Preparar datos para inserción
    const demandaData = {
        paciente_tipo_id: formData.tipoId,
        paciente_id: formData.identificacion,
        fecha_gestion: formData.fechaGestion,
        celular: formData.celular || null,
        hora_llamada: formData.horaLlamada || null,
        clasificacion: formData.clasificacion,
        quien_recibe_llamada: formData.quienRecibeLlamada || null,
        relacion_usuario: formData.relacionUsuario || null,
        texto_llamada: formData.textoLlamada || null,
        actividades_realizadas: formData.actividadesRealizadas || null,
        condicion_usuario: formData.condicionUsuario || null,
        soportes_recuperados: formData.soportesRecuperados || null,
        fecha_asignacion_cita: formData.fechaAsignacionCita || null,
        departamento: formData.departamento || null,
        municipio: formData.municipio || null,
        telefono_actualizado: formData.telefonoActualizado || null,
        resultado_llamada: formData.resultadoLlamada || null,
        colaborador: nombreColaborador,
        programa_direccionado: formData.programaDireccionado || null,
    }

    const { data, error } = await supabase
        .from('demanda_inducida')
        .insert(demandaData)
        .select()
        .single()

    if (error) {
        throw new Error(`Error creando demanda inducida: ${error.message}`)
    }

    return transformDemandaFromDB(data)
}

/**
 * Obtiene métricas/estadísticas
 */
async function getMetrics(filters?: DemandaFilters): Promise<DemandaMetrics> {
    // Obtener todos los casos para métricas (sin paginación efectiva, límite alto)
    const { data: casos } = await getAll({ ...filters, page: 1, pageSize: 10000 })

    // Obtener casos del mes actual (sin filtros de fecha)
    const hoy = new Date()
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        .toISOString()
        .split('T')[0]

    const { data: casosMes } = await supabase
        .from('demanda_inducida')
        .select('id')
        .gte('fecha_gestion', primerDiaMes)

    const totalCasos = casos.length
    const casosEfectivos = casos.filter((c) => c.clasificacion === 'Efectivo').length
    const casosNoEfectivos = casos.filter((c) => c.clasificacion === 'No Efectivo').length
    const casosMesActual = casosMes?.length || 0
    const porcentajeEfectividad = totalCasos > 0 ? (casosEfectivos / totalCasos) * 100 : 0
    const porcentajeNoEfectividad = totalCasos > 0 ? (casosNoEfectivos / totalCasos) * 100 : 0

    // Calcular top colaborador (mayor registros + mayor efectividad)
    const colaboradorStats = new Map<string, { total: number; efectivos: number }>()
    casos.forEach((c) => {
        const nombre = c.colaborador
        if (!nombre) return
        const stats = colaboradorStats.get(nombre) || { total: 0, efectivos: 0 }
        stats.total++
        if (c.clasificacion === 'Efectivo') stats.efectivos++
        colaboradorStats.set(nombre, stats)
    })

    // Ordenar por: 1) Mayor efectividad, 2) Mayor registros
    let topColaborador: { nombre: string; totalCasos: number; efectividad: number } | null = null
    let maxScore = -1
    colaboradorStats.forEach((stats, nombre) => {
        const efectividad = stats.total > 0 ? (stats.efectivos / stats.total) * 100 : 0
        // Score = efectividad ponderada + bonus por volumen
        const score = efectividad + (stats.total / 100)
        if (score > maxScore) {
            maxScore = score
            topColaborador = {
                nombre,
                totalCasos: stats.total,
                efectividad,
            }
        }
    })

    return {
        topColaborador,
        casosEfectivos,
        casosNoEfectivos,
        casosMesActual,
        porcentajeEfectividad,
        porcentajeNoEfectividad,
    }
}

/**
 * Obtiene lista única de colaboradores
 */
async function getColaboradores(): Promise<string[]> {
    const { data, error } = await supabase
        .from('demanda_inducida')
        .select('colaborador')
        .order('colaborador')

    if (error) {
        return []
    }

    // Obtener valores únicos
    const colaboradores = [...new Set(data.map((d: any) => d.colaborador))].filter(Boolean)
    return colaboradores as string[]
}

/**
 * Obtiene lista única de programas
 */
async function getProgramas(): Promise<string[]> {
    const { data, error } = await supabase
        .from('demanda_inducida')
        .select('programa_direccionado')
        .order('programa_direccionado')

    if (error) {
        return []
    }

    // Obtener valores únicos
    const programas = [...new Set(data.map((d: any) => d.programa_direccionado))].filter(Boolean)
    return programas as string[]
}


/**
 * Elimina un caso por ID
 */
async function deleteCase(id: number): Promise<void> {
    const { error } = await supabase
        .from('demanda_inducida')
        .delete()
        .eq('id', id)

    if (error) {
        throw new Error(`Error eliminando demanda inducida: ${error.message}`)
    }
}

/**
 * Actualiza un caso existente
 */
async function update(id: number, data: Partial<DemandaInducida>): Promise<DemandaInducida> {
    // Mapear campos frontend a DB
    const dbData: any = {}
    if (data.pacienteTipoId !== undefined) dbData.paciente_tipo_id = data.pacienteTipoId
    if (data.pacienteId !== undefined) dbData.paciente_id = data.pacienteId
    if (data.fechaGestion !== undefined) dbData.fecha_gestion = data.fechaGestion
    if (data.celular !== undefined) dbData.celular = data.celular
    if (data.horaLlamada !== undefined) dbData.hora_llamada = data.horaLlamada
    if (data.clasificacion !== undefined) dbData.clasificacion = data.clasificacion
    if (data.quienRecibeLlamada !== undefined) dbData.quien_recibe_llamada = data.quienRecibeLlamada
    if (data.relacionUsuario !== undefined) dbData.relacion_usuario = data.relacionUsuario
    if (data.textoLlamada !== undefined) dbData.texto_llamada = data.textoLlamada
    if (data.actividadesRealizadas !== undefined) dbData.actividades_realizadas = data.actividadesRealizadas
    if (data.condicionUsuario !== undefined) dbData.condicion_usuario = data.condicionUsuario
    if (data.soportesRecuperados !== undefined) dbData.soportes_recuperados = data.soportesRecuperados
    if (data.fechaAsignacionCita !== undefined) dbData.fecha_asignacion_cita = data.fechaAsignacionCita
    if (data.departamento !== undefined) dbData.departamento = data.departamento
    if (data.municipio !== undefined) dbData.municipio = data.municipio
    if (data.telefonoActualizado !== undefined) dbData.telefono_actualizado = data.telefonoActualizado
    if (data.resultadoLlamada !== undefined) dbData.resultado_llamada = data.resultadoLlamada
    if (data.programaDireccionado !== undefined) dbData.programa_direccionado = data.programaDireccionado

    dbData.updated_at = new Date().toISOString()

    const { data: updated, error } = await supabase
        .from('demanda_inducida')
        .update(dbData)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        throw new Error(`Error actualizando demanda inducida: ${error.message}`)
    }

    return transformDemandaFromDB(updated)
}

export const demandaInducidaService = {
    getAll,
    getById,
    create,
    delete: deleteCase,
    getMetrics,
    buscarPacientes,
    crearPacienteBasico,
    getColaboradores,
    getProgramas,
    update,
}
