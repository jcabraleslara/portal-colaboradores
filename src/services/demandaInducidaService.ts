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
import { pacientesService } from './pacientes.service'

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
 * Busca pacientes en la base de datos por identificación o nombre.
 * Primero intenta match exacto por ID (índice B-tree, instantáneo),
 * luego busca por texto (índice GIN trigram en busqueda_texto).
 * Se evita el OR entre ambos campos porque fuerza Seq Scan en ~2M filas.
 */
async function buscarPacientes(
    criterio: string
): Promise<any[]> {
    // 1. Match exacto por ID (usa índice B-tree, costo ~3)
    const { data: exactMatch, error: exactError } = await supabase
        .from('afiliados')
        .select('*')
        .eq('id', criterio.trim())
        .limit(1)

    if (exactError) {
        throw new Error(`Error buscando pacientes: ${exactError.message}`)
    }

    if (exactMatch && exactMatch.length > 0) {
        return exactMatch
    }

    // 2. Búsqueda por texto (usa índice GIN trigram, costo ~750)
    const { data, error } = await supabase
        .from('afiliados')
        .select('*')
        .ilike('busqueda_texto', `%${criterio.trim()}%`)
        .limit(10)

    if (error) {
        throw new Error(`Error buscando pacientes: ${error.message}`)
    }

    return data || []
}

/**
 * Crea un paciente básico en BD con fuente PORTAL_COLABORADORES
 * Usa servicio centralizado que previene duplicados de bd.id
 */
async function crearPacienteBasico(data: {
    tipoId: string
    identificacion: string
    celular?: string
    departamento?: string
    municipio?: string
    correoActualizado?: string
}) {
    const resultado = await pacientesService.crearPacienteSeguro({
        tipoId: data.tipoId,
        id: data.identificacion,
        nombres: 'POR DEFINIR',
        apellido1: 'POR DEFINIR',
        apellido2: '',
        telefono: data.celular || undefined,
        departamento: data.departamento || undefined,
        municipio: data.municipio || undefined,
        email: data.correoActualizado || undefined
    })

    if (!resultado.success) {
        throw new Error(resultado.error || 'Error creando paciente')
    }

    // Retornar objeto compatible con la lógica existente
    return {
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
        estado: 'ACTIVO'
    }
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
    // 1. Construir query optimizada solo con campos necesarios
    let query = supabase
        .from('demanda_inducida')
        .select('colaborador, clasificacion')

    // Aplicar los mismos filtros que getAll
    if (filters?.busqueda) {
        query = query.or(`paciente_id.ilike.%${filters.busqueda}%`)
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

    // Ejecutar query limitada (hasta 10000)
    const { data: rawCasos, error } = await query.limit(10000)

    if (error) {
        console.error('Error calculando métricas:', error)
        return {
            casosEfectivos: 0,
            casosNoEfectivos: 0,
            casosMesActual: 0,
            porcentajeEfectividad: 0,
            porcentajeNoEfectividad: 0,
            topColaborador: null
        }
    }

    const casos = rawCasos || []

    // 2. Obtener casos del mes actual (query liviana separada)
    const hoy = new Date()
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        .toISOString()
        .split('T')[0]

    const { count: casosMesActual } = await supabase
        .from('demanda_inducida')
        .select('id', { count: 'exact', head: true })
        .gte('fecha_gestion', primerDiaMes)

    // 3. Cálculos en memoria (ahora con data ligera)
    const totalCasos = casos.length
    const casosEfectivos = casos.filter((c: any) => c.clasificacion === 'Efectivo').length
    const casosNoEfectivos = casos.filter((c: any) => c.clasificacion === 'No Efectivo').length

    const porcentajeEfectividad = totalCasos > 0 ? (casosEfectivos / totalCasos) * 100 : 0
    const porcentajeNoEfectividad = totalCasos > 0 ? (casosNoEfectivos / totalCasos) * 100 : 0

    // Calcular top colaborador
    const colaboradorStats = new Map<string, { total: number; efectivos: number }>()
    casos.forEach((c: any) => {
        const nombre = c.colaborador
        if (!nombre) return
        const stats = colaboradorStats.get(nombre) || { total: 0, efectivos: 0 }
        stats.total++
        if (c.clasificacion === 'Efectivo') stats.efectivos++
        colaboradorStats.set(nombre, stats)
    })

    let topColaborador: { nombre: string; totalCasos: number; efectividad: number } | null = null
    let maxScore = -1

    colaboradorStats.forEach((stats, nombre) => {
        const efectividad = stats.total > 0 ? (stats.efectivos / stats.total) * 100 : 0
        // Score simple: efectividad * log(total) para dar peso al volumen pero priorizar calidad
        // O simplemente el de mayor efectividad con mínimo de casos? 
        // Usaremos la lógica previa implícita o una simple ponderación
        const score = efectividad * Math.log10(stats.total + 1)

        if (score > maxScore) {
            maxScore = score
            topColaborador = {
                nombre,
                totalCasos: stats.total,
                efectividad
            }
        }
    })

    return {
        casosEfectivos,
        casosNoEfectivos,
        casosMesActual: casosMesActual || 0,
        porcentajeEfectividad,
        porcentajeNoEfectividad,
        topColaborador
    }
}


/**
 * Obtiene lista única de colaboradores usando RPC para evitar límites de paginación
 */
async function getColaboradores(): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_unique_colaboradores')

    if (error) {
        console.error('Error obteniendo colaboradores:', error)
        return []
    }

    return data.map((d: any) => d.colaborador)
}

/**
 * Obtiene lista única de programas usando RPC
 */
async function getProgramas(): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_unique_programas')

    if (error) {
        console.error('Error obteniendo programas:', error)
        return []
    }

    return data.map((d: any) => d.programa)
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
