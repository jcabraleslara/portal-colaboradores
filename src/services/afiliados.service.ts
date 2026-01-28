/**
 * Servicio de Afiliados
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Consulta la tabla public.afiliados para validación de derechos.
 */

import { supabase } from '@/config/supabase.config'
import { ERROR_MESSAGES } from '@/config/constants'
import { Afiliado, AfiliadoRaw, ApiResponse } from '@/types'

/**
 * Parsear fecha de la base de datos evitando problemas de timezone.
 * La BD devuelve fechas tipo 'date' con timestamp UTC (ej: "1986-11-01T05:00:00.000Z")
 * pero la fecha real es 1986-11-01 en timezone local.
 * 
 * @param dateString - String de fecha desde DB (ISO 8601)
 * @returns Date object parseado en timezone local o null
 */
function parseDateLocal(dateString: string | null): Date | null {
    if (!dateString) return null

    // Extraer solo la parte de la fecha (YYYY-MM-DD)
    const dateOnly = dateString.split('T')[0]
    const [year, month, day] = dateOnly.split('-').map(Number)

    // Crear fecha en timezone local (mes es 0-indexed en JS)
    return new Date(year, month - 1, day)
}

/**
 * Transformar respuesta de DB (snake_case) a camelCase
 */
function transformAfiliado(raw: AfiliadoRaw): Afiliado {
    return {
        tipoId: raw.tipo_id,
        id: raw.id,
        apellido1: raw.apellido1,
        apellido2: raw.apellido2,
        nombres: raw.nombres,
        sexo: raw.sexo,
        direccion: raw.direccion,
        telefono: raw.telefono,
        fechaNacimiento: parseDateLocal(raw.fecha_nacimiento),
        estado: raw.estado,
        municipio: raw.municipio,
        observaciones: raw.observaciones,
        ipsPrimaria: raw.ips_primaria,
        tipoCotizante: raw.tipo_cotizante,
        departamento: raw.departamento,
        rango: raw.rango,
        email: raw.email,
        regimen: raw.regimen,
        edad: raw.edad,
        eps: raw.eps,
        fuente: raw.fuente,
        updatedAt: raw.updated_at ? new Date(raw.updated_at) : null,
        busquedaTexto: raw.busqueda_texto,
    }
}

export const afiliadosService = {
    /**
     * Buscar afiliado por documento de identidad
     * @param documento - Número de documento (solo números)
     */
    async buscarPorDocumento(documento: string): Promise<ApiResponse<Afiliado>> {
        try {
            // Sanitizar: solo números
            const documentoLimpio = documento.replace(/\D/g, '')

            if (!documentoLimpio) {
                return {
                    success: false,
                    error: ERROR_MESSAGES.INVALID_DOCUMENT,
                }
            }

            const { data, error } = await supabase
                .from('afiliados')
                .select('*')
                .eq('id', documentoLimpio)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (error) {
                console.error('Error buscando afiliado', { documento: documentoLimpio, error })
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            // maybeSingle devuelve null cuando no encuentra
            if (!data) {
                return {
                    success: false,
                    error: ERROR_MESSAGES.AFILIADO_NOT_FOUND,
                }
            }

            const afiliado = transformAfiliado(data as AfiliadoRaw)

            return {
                success: true,
                data: afiliado,
            }
        } catch (error) {
            console.error('Error en buscarPorDocumento', { error })
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Buscar afiliados por texto (nombre, apellido, documento)
     * @param texto - Texto de búsqueda
     * @param limite - Máximo de resultados (default 50)
     */
    async buscarPorTexto(texto: string, limite = 50): Promise<ApiResponse<Afiliado[]>> {
        try {
            const textoLimpio = texto.trim().toUpperCase()

            if (textoLimpio.length < 3) {
                return {
                    success: false,
                    error: 'Ingresa al menos 3 caracteres para buscar',
                }
            }

            const { data, error } = await supabase
                .from('afiliados')
                .select('*')
                .ilike('busqueda_texto', `%${textoLimpio}%`)
                .limit(limite)

            if (error) {
                console.error('Error buscando afiliados por texto', { texto: textoLimpio, error })
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            const afiliados = (data as AfiliadoRaw[]).map(transformAfiliado)

            return {
                success: true,
                data: afiliados,
                message: afiliados.length === 0 ? 'No se encontraron resultados' : undefined,
            }
        } catch (error) {
            console.error('Error en buscarPorTexto', { error })
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Actualizar teléfono del afiliado
     */
    async actualizarTelefono(tipoId: string, id: string, nuevoTelefono: string): Promise<ApiResponse<null>> {
        try {
            const { error } = await supabase
                .from('bd')
                .update({ telefono: nuevoTelefono })
                .eq('tipo_id', tipoId) // Asegurar correspondencia única
                .eq('id', id)

            if (error) {
                console.error('Error actualizando teléfono', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR
                }
            }

            return {
                success: true,
                data: null
            }
        } catch (error) {
            console.error('Error en actualizarTelefono', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR
            }
        }
    },

    /**
     * Actualizar email del afiliado
     */
    async actualizarEmail(tipoId: string, id: string, nuevoEmail: string): Promise<ApiResponse<null>> {
        try {
            const { error } = await supabase
                .from('bd')
                .update({ email: nuevoEmail })
                .eq('tipo_id', tipoId)
                .eq('id', id)

            if (error) {
                console.error('Error actualizando email', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR
                }
            }

            return {
                success: true,
                data: null
            }
        } catch (error) {
            console.error('Error en actualizarEmail', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR
            }
        }
    },

    /**
     * Actualizar dirección del afiliado
     */
    async actualizarDireccion(tipoId: string, id: string, nuevaDireccion: string): Promise<ApiResponse<null>> {
        try {
            const { error } = await supabase
                .from('bd')
                .update({ direccion: nuevaDireccion })
                .eq('tipo_id', tipoId)
                .eq('id', id)

            if (error) {
                console.error('Error actualizando dirección', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR
                }
            }

            return {
                success: true,
                data: null
            }
        } catch (error) {
            console.error('Error en actualizarDireccion', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR
            }
        }
    },

    /**
     * Actualizar observaciones del afiliado
     */
    async actualizarObservaciones(tipoId: string, id: string, nuevasObservaciones: string): Promise<ApiResponse<null>> {
        try {
            const { error } = await supabase
                .from('bd')
                .update({ observaciones: nuevasObservaciones })
                .eq('tipo_id', tipoId)
                .eq('id', id)

            if (error) {
                console.error('Error actualizando observaciones', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR
                }
            }

            return {
                success: true,
                data: null
            }
        } catch (error) {
            console.error('Error en actualizarObservaciones', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR
            }
        }
    },

    /**
     * Actualizar sexo del afiliado
     */
    async actualizarSexo(tipoId: string, id: string, nuevoSexo: string): Promise<ApiResponse<null>> {
        try {
            const { error } = await supabase
                .from('bd')
                .update({ sexo: nuevoSexo })
                .eq('tipo_id', tipoId)
                .eq('id', id)

            if (error) {
                console.error('Error actualizando sexo', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR
                }
            }

            return {
                success: true,
                data: null
            }
        } catch (error) {
            console.error('Error en actualizarSexo', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR
            }
        }
    },

    /**
     * Actualizar fecha de nacimiento del afiliado
     */
    async actualizarFechaNacimiento(tipoId: string, id: string, nuevaFecha: string): Promise<ApiResponse<null>> {
        try {
            const { error } = await supabase
                .from('bd')
                .update({ fecha_nacimiento: nuevaFecha })
                .eq('tipo_id', tipoId)
                .eq('id', id)

            if (error) {
                console.error('Error actualizando fecha de nacimiento', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR
                }
            }

            return {
                success: true,
                data: null
            }
        } catch (error) {
            console.error('Error en actualizarFechaNacimiento', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR
            }
        }
    },

    /**
     * Actualizar régimen del afiliado
     */
    async actualizarRegimen(tipoId: string, id: string, nuevoRegimen: string): Promise<ApiResponse<null>> {
        try {
            const { error } = await supabase
                .from('bd')
                .update({ regimen: nuevoRegimen })
                .eq('tipo_id', tipoId)
                .eq('id', id)

            if (error) {
                console.error('Error actualizando régimen', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR
                }
            }

            return {
                success: true,
                data: null
            }
        } catch (error) {
            console.error('Error en actualizarRegimen', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR
            }
        }
    },

    /**
     * Actualizar tipo cotizante del afiliado
     */
    async actualizarTipoCotizante(tipoId: string, id: string, nuevoTipoCotizante: string): Promise<ApiResponse<null>> {
        try {
            const { error } = await supabase
                .from('bd')
                .update({ tipo_cotizante: nuevoTipoCotizante })
                .eq('tipo_id', tipoId)
                .eq('id', id)

            if (error) {
                console.error('Error actualizando tipo cotizante', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR
                }
            }

            return {
                success: true,
                data: null
            }
        } catch (error) {
            console.error('Error en actualizarTipoCotizante', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR
            }
        }
    },

    /**
     * Actualizar IPS primaria del afiliado
     */
    async actualizarIpsPrimaria(tipoId: string, id: string, nuevaIps: string): Promise<ApiResponse<null>> {
        try {
            const { error } = await supabase
                .from('bd')
                .update({ ips_primaria: nuevaIps })
                .eq('tipo_id', tipoId)
                .eq('id', id)

            if (error) {
                console.error('Error actualizando IPS primaria', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR
                }
            }

            return {
                success: true,
                data: null
            }
        } catch (error) {
            console.error('Error en actualizarIpsPrimaria', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR
            }
        }
    },

    /**
     * Actualizar municipio del afiliado
     */
    async actualizarMunicipio(tipoId: string, id: string, nuevoMunicipio: string): Promise<ApiResponse<null>> {
        try {
            const { error } = await supabase
                .from('bd')
                .update({ municipio: nuevoMunicipio })
                .eq('tipo_id', tipoId)
                .eq('id', id)

            if (error) {
                console.error('Error actualizando municipio', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR
                }
            }

            return {
                success: true,
                data: null
            }
        } catch (error) {
            console.error('Error en actualizarMunicipio', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR
            }
        }
    },

    /**
     * Actualizar departamento del afiliado
     */
    async actualizarDepartamento(tipoId: string, id: string, nuevoDepartamento: string): Promise<ApiResponse<null>> {
        try {
            const { error } = await supabase
                .from('bd')
                .update({ departamento: nuevoDepartamento })
                .eq('tipo_id', tipoId)
                .eq('id', id)

            if (error) {
                console.error('Error actualizando departamento', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR
                }
            }

            return {
                success: true,
                data: null
            }
        } catch (error) {
            console.error('Error en actualizarDepartamento', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR
            }
        }
    },

    /**
     * Actualizar EPS del afiliado
     */
    async actualizarEps(tipoId: string, id: string, nuevaEps: string): Promise<ApiResponse<null>> {
        try {
            const { error } = await supabase
                .from('bd')
                .update({ eps: nuevaEps })
                .eq('tipo_id', tipoId)
                .eq('id', id)

            if (error) {
                console.error('Error actualizando EPS', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR
                }
            }

            return {
                success: true,
                data: null
            }
        } catch (error) {
            console.error('Error en actualizarEps', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR
            }
        }
    },

    /**
     * Actualizar estado del afiliado
     */
    async actualizarEstado(tipoId: string, id: string, nuevoEstado: string): Promise<ApiResponse<null>> {
        try {
            const { error } = await supabase
                .from('bd')
                .update({ estado: nuevoEstado })
                .eq('tipo_id', tipoId)
                .eq('id', id)

            if (error) {
                console.error('Error actualizando estado', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR
                }
            }

            return {
                success: true,
                data: null
            }
        } catch (error) {
            console.error('Error en actualizarEstado', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR
            }
        }
    },
}

export default afiliadosService
