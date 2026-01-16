/**
 * Servicio de Airtable para Radicación de Casos
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * CONFIGURACIÓN REQUERIDA:
 * - VITE_AIRTABLE_API_KEY: Token de acceso personal de Airtable
 * - VITE_AIRTABLE_BASE_ID: ID de la base (appXXXXXX)
 * - VITE_AIRTABLE_TABLE_NAME: Nombre de la tabla destino
 * 
 * CÓMO OBTENER CREDENCIALES:
 * 1. Ir a https://airtable.com/create/tokens
 * 2. Crear token con scope: data.records:write
 * 3. Copiar el Base ID de la URL de tu base
 */

import { AIRTABLE, ERROR_MESSAGES } from '@/config/constants'
import { RadicacionData, ApiResponse } from '@/types'

// ========================================
// TIPOS INTERNOS
// ========================================

interface AirtableRecord {
    fields: Record<string, unknown>
}

interface AirtableResponse {
    id: string
    createdTime: string
    fields: Record<string, unknown>
}

interface AirtableError {
    error: {
        type: string
        message: string
    }
}

// ========================================
// FUNCIONES AUXILIARES
// ========================================

/**
 * Verificar configuración de Airtable
 */
function checkConfig(): { valid: boolean; error?: string } {
    if (!AIRTABLE.API_KEY) {
        return { valid: false, error: 'VITE_AIRTABLE_API_KEY no configurada' }
    }
    if (!AIRTABLE.BASE_ID) {
        return { valid: false, error: 'VITE_AIRTABLE_BASE_ID no configurada' }
    }
    return { valid: true }
}

/**
 * Construir URL de la API de Airtable
 */
function buildUrl(tableName: string = AIRTABLE.TABLE_NAME): string {
    return `${AIRTABLE.API_URL}/${AIRTABLE.BASE_ID}/${encodeURIComponent(tableName)}`
}

/**
 * Headers de autenticación
 */
function getHeaders(): HeadersInit {
    return {
        'Authorization': `Bearer ${AIRTABLE.API_KEY}`,
        'Content-Type': 'application/json',
    }
}

// ========================================
// SERVICIO PRINCIPAL
// ========================================

export const airtableService = {
    /**
     * Crear un nuevo registro de radicación en Airtable
     */
    async crearRadicacion(data: RadicacionData): Promise<ApiResponse<{ recordId: string }>> {
        try {
            // Verificar configuración
            const configCheck = checkConfig()
            if (!configCheck.valid) {
                console.error('Airtable no configurado', { error: configCheck.error })
                return {
                    success: false,
                    error: configCheck.error,
                }
            }

            // Mapear datos al formato de Airtable
            // NOTA: Los nombres de campo deben coincidir con los de la tabla en Airtable
            const record: AirtableRecord = {
                fields: {
                    'Documento': data.documentoAfiliado,
                    'Nombre Afiliado': data.nombreAfiliado,
                    'EPS': data.eps || '',
                    'Régimen': data.regimen || '',
                    'Tipo Solicitud': data.tipoSolicitud,
                    'Descripción': data.descripcion,
                    'Prioridad': data.prioridad,
                    'Fecha Solicitud': data.fechaSolicitud.toISOString().split('T')[0],
                    'Observaciones': data.observaciones || '',
                    'Radicado Por': data.radicadoPor,
                    'Fecha Radicación': new Date().toISOString(),
                },
            }

            const response = await fetch(buildUrl(), {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(record),
            })

            if (!response.ok) {
                const errorData = await response.json() as AirtableError
                console.error('Error de Airtable', {
                    status: response.status,
                    error: errorData.error
                })

                // Mapear errores comunes
                if (response.status === 401) {
                    return { success: false, error: 'Token de Airtable inválido o expirado' }
                }
                if (response.status === 403) {
                    return { success: false, error: 'Sin permisos para escribir en esta tabla' }
                }
                if (response.status === 404) {
                    return { success: false, error: 'Base o tabla de Airtable no encontrada' }
                }
                if (response.status === 422) {
                    return { success: false, error: 'Datos inválidos: verifica los campos requeridos' }
                }

                return {
                    success: false,
                    error: errorData.error?.message || ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            const result = await response.json() as AirtableResponse

            console.info('Radicación creada en Airtable', {
                recordId: result.id,
                documento: data.documentoAfiliado,
            })

            return {
                success: true,
                data: { recordId: result.id },
                message: 'Caso radicado exitosamente',
            }
        } catch (error) {
            console.error('Error en crearRadicacion', { error })

            // Detectar errores de red
            if (error instanceof TypeError && error.message.includes('fetch')) {
                return {
                    success: false,
                    error: ERROR_MESSAGES.NETWORK_ERROR,
                }
            }

            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Verificar conexión con Airtable
     */
    async testConnection(): Promise<ApiResponse<boolean>> {
        try {
            const configCheck = checkConfig()
            if (!configCheck.valid) {
                return { success: false, error: configCheck.error }
            }

            // Intentar obtener un registro (limitado a 1) para verificar conexión
            const response = await fetch(`${buildUrl()}?maxRecords=1`, {
                method: 'GET',
                headers: getHeaders(),
            })

            if (!response.ok) {
                return { success: false, error: 'No se pudo conectar con Airtable' }
            }

            return { success: true, data: true, message: 'Conexión exitosa' }
        } catch (error) {
            console.error('Error en testConnection', { error })
            return { success: false, error: ERROR_MESSAGES.NETWORK_ERROR }
        }
    },
}

export default airtableService
