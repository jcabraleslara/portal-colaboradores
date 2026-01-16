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
        fechaNacimiento: raw.fecha_nacimiento ? new Date(raw.fecha_nacimiento) : null,
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
                .single()

            if (error) {
                // PGRST116 = no rows found
                if (error.code === 'PGRST116') {
                    return {
                        success: false,
                        error: ERROR_MESSAGES.AFILIADO_NOT_FOUND,
                    }
                }
                console.error('Error buscando afiliado', { documento: documentoLimpio, error })
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
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
}

export default afiliadosService
