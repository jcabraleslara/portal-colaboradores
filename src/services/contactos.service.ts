/**
 * Servicio de Contactos (Directorio Institucional)
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Gestiona operaciones CRUD en la tabla public.contactos
 * y subida de archivos a los buckets hojas-vida y firmas.
 */

import { supabase } from '@/config/supabase.config'
import { ERROR_MESSAGES } from '@/config/constants'
import { ApiResponse } from '@/types'
import {
    Contacto,
    ContactoFiltros,
    ConteosContactos,
    ContactoInput,
    ContactoUpdate,
} from '@/types/contactos.types'

const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_CONTACTS_WEBHOOK_URL

/**
 * Notifica a n8n sobre cambios para sincronización externa
 */
async function triggerSync(action: 'create' | 'update' | 'delete', data: Partial<Contacto>) {
    if (!N8N_WEBHOOK_URL) {
        console.warn('URL de Webhook N8N no configurada. Saltando sincronización.')
        return
    }

    try {
        console.log(`Iniciando sincronización N8N [${action}]...`)
        // Fire and forget - no bloqueamos la UI esperando respuesta del webhook
        fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                data,
                timestamp: new Date().toISOString(),
                source: 'portal_colaboradores'
            })
        }).then(res => {
            if (!res.ok) console.error('N8N Webhook error:', res.statusText)
        }).catch(err => console.error('Error de conexión con N8N:', err))

    } catch (error) {
        console.error('Error disparando sync:', error)
    }
}

// ========================================
// HELPERS
// ========================================

/**
 * Obtener nombre completo del contacto
 */
export function obtenerNombreCompleto(contacto: Contacto): string {
    const partes = [
        contacto.tratamiento,
        contacto.primer_nombre,
        contacto.segundo_nombre,
        contacto.apellidos
    ].filter(Boolean)
    return partes.join(' ')
}

// ========================================
// SERVICIO
// ========================================

export const contactosService = {
    /**
     * Obtener contactos con filtros y paginación
     */
    async obtenerContactosFiltrados(
        filtros: ContactoFiltros,
        offset = 0,
        limit = 30
    ): Promise<ApiResponse<{ contactos: Contacto[]; total: number }>> {
        try {
            let query = supabase
                .from('contactos')
                .select('*', { count: 'exact' })

            // Filtro por empresa
            if (filtros.empresa) {
                query = query.eq('empresa', filtros.empresa)
            }

            // Filtro por área
            if (filtros.area) {
                query = query.eq('area', filtros.area)
            }

            // Filtro por ciudad
            if (filtros.ciudad) {
                query = query.eq('ciudad', filtros.ciudad)
            }

            // Búsqueda general optimizada (múltiples términos)
            if (filtros.busqueda && filtros.busqueda.trim()) {
                const terminos = filtros.busqueda.trim().toLowerCase().split(/\s+/)

                // Para cada palabra, agregamos una condición OR que debe cumplirse (AND implícito entre grupos OR)
                terminos.forEach(termino => {
                    if (termino.length > 0) {
                        query = query.or(
                            `primer_nombre.ilike.%${termino}%,` +
                            `segundo_nombre.ilike.%${termino}%,` +
                            `apellidos.ilike.%${termino}%,` +
                            `identificacion.ilike.%${termino}%,` +
                            `puesto.ilike.%${termino}%,` +
                            `area.ilike.%${termino}%,` +
                            `empresa.ilike.%${termino}%,` +
                            `ciudad.ilike.%${termino}%,` +
                            `email_personal.ilike.%${termino}%,` +
                            `email_institucional.ilike.%${termino}%`
                        )
                    }
                })
            }

            // Ordenar por apellidos, luego nombre
            query = query
                .order('apellidos', { ascending: true })
                .order('primer_nombre', { ascending: true })
                .range(offset, offset + limit - 1)

            const { data, error, count } = await query

            if (error) {
                console.error('Error obteniendo contactos:', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            return {
                success: true,
                data: {
                    contactos: (data || []) as Contacto[],
                    total: count || 0,
                },
            }
        } catch (error) {
            console.error('Error en obtenerContactosFiltrados:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Obtener conteos por categoría para cards
     */
    async obtenerConteos(): Promise<ApiResponse<ConteosContactos>> {
        try {
            // Obtener total y agrupar por empresa, área, ciudad
            const { data, error, count } = await supabase
                .from('contactos')
                .select('empresa, area, ciudad', { count: 'exact' })

            if (error) {
                console.error('Error obteniendo conteos:', error)
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            // Agrupar manualmente
            const porEmpresa: Record<string, number> = {}
            const porArea: Record<string, number> = {}
            const porCiudad: Record<string, number> = {}

            for (const row of data || []) {
                // Empresa
                const empresa = row.empresa || 'Sin empresa'
                porEmpresa[empresa] = (porEmpresa[empresa] || 0) + 1

                // Área
                const area = row.area || 'Sin área'
                porArea[area] = (porArea[area] || 0) + 1

                // Ciudad
                const ciudad = row.ciudad || 'Sin ciudad'
                porCiudad[ciudad] = (porCiudad[ciudad] || 0) + 1
            }

            return {
                success: true,
                data: {
                    total: count || 0,
                    porEmpresa: Object.entries(porEmpresa)
                        .map(([empresa, cantidad]) => ({ empresa, cantidad }))
                        .sort((a, b) => b.cantidad - a.cantidad)
                        .slice(0, 10), // Top 10 empresas
                    porArea: Object.entries(porArea)
                        .map(([area, cantidad]) => ({ area, cantidad }))
                        .sort((a, b) => b.cantidad - a.cantidad)
                        .slice(0, 10), // Top 10 áreas
                    porCiudad: Object.entries(porCiudad)
                        .map(([ciudad, cantidad]) => ({ ciudad, cantidad }))
                        .sort((a, b) => b.cantidad - a.cantidad)
                        .slice(0, 10), // Top 10 ciudades
                },
            }
        } catch (error) {
            console.error('Error en obtenerConteos:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Obtener un contacto por ID
     */
    async obtenerPorId(id: string): Promise<ApiResponse<Contacto>> {
        try {
            const { data, error } = await supabase
                .from('contactos')
                .select('*')
                .eq('id', id)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    return {
                        success: false,
                        error: 'Contacto no encontrado',
                    }
                }
                return {
                    success: false,
                    error: ERROR_MESSAGES.SERVER_ERROR,
                }
            }

            return {
                success: true,
                data: data as Contacto,
            }
        } catch (error) {
            console.error('Error en obtenerPorId:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Crear un nuevo contacto
     */
    async crearContacto(datos: ContactoInput): Promise<ApiResponse<Contacto>> {
        try {
            const { data, error } = await supabase
                .from('contactos')
                .insert({
                    tratamiento: datos.tratamiento || null,
                    primer_nombre: datos.primer_nombre,
                    segundo_nombre: datos.segundo_nombre || null,
                    apellidos: datos.apellidos,
                    identificacion: datos.identificacion || null,
                    email_personal: datos.email_personal || null,
                    email_institucional: datos.email_institucional || null,
                    empresa: datos.empresa || null,
                    puesto: datos.puesto || null,
                    celular_1: datos.celular_1 || null,
                    celular_2: datos.celular_2 || null,
                    fecha_nacimiento: datos.fecha_nacimiento || null,
                    direccion: datos.direccion || null,
                    ciudad: datos.ciudad || 'Montería',
                    departamento: datos.departamento || 'Córdoba',
                    pais: datos.pais || 'Colombia',
                    notas: datos.notas || null,
                    hoja_vida_url: datos.hoja_vida_url || null,
                    firma_url: datos.firma_url || null,
                    area: datos.area || null,
                })
                .select()
                .single()

            if (error) {
                console.error('Error creando contacto:', error)
                return {
                    success: false,
                    error: 'Error al crear el contacto: ' + error.message,
                }
            }

            // Disparar sincronización
            triggerSync('create', data as Contacto)

            return {
                success: true,
                data: data as Contacto,
                message: 'Contacto creado exitosamente. Iniciando sincronización...',
            }
        } catch (error) {
            console.error('Error en crearContacto:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Actualizar un contacto existente
     */
    async actualizarContacto(id: string, datos: ContactoUpdate): Promise<ApiResponse<Contacto>> {
        try {
            // Construir objeto de actualización solo con campos definidos
            const updateData: Record<string, unknown> = {}

            const camposPermitidos = [
                'tratamiento', 'primer_nombre', 'segundo_nombre', 'apellidos',
                'identificacion', 'email_personal', 'email_institucional',
                'empresa', 'puesto', 'celular_1', 'celular_2', 'fecha_nacimiento',
                'direccion', 'ciudad', 'departamento', 'pais', 'notas',
                'hoja_vida_url', 'firma_url', 'area',
                'google_contact_id', 'outlook_contact_id'
            ]

            for (const campo of camposPermitidos) {
                if ((datos as Record<string, unknown>)[campo] !== undefined) {
                    updateData[campo] = (datos as Record<string, unknown>)[campo]
                }
            }

            const { data, error } = await supabase
                .from('contactos')
                .update(updateData)
                .eq('id', id)
                .select()
                .single()

            if (error) {
                console.error('Error actualizando contacto:', error)
                return {
                    success: false,
                    error: 'Error al actualizar el contacto: ' + error.message,
                }
            }

            // Disparar sincronización
            triggerSync('update', data as Contacto)

            return {
                success: true,
                data: data as Contacto,
                message: 'Contacto actualizado exitosamente',
            }
        } catch (error) {
            console.error('Error en actualizarContacto:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Eliminar un contacto
     */
    async eliminarContacto(id: string): Promise<ApiResponse<boolean>> {
        try {
            const { error } = await supabase
                .from('contactos')
                .delete()
                .eq('id', id)

            if (error) {
                console.error('Error eliminando contacto:', error)
                return {
                    success: false,
                    error: 'Error al eliminar el contacto. Verifica tus permisos.',
                }
            }

            // Disparar sincronización
            triggerSync('delete', { id })

            return {
                success: true,
                data: true,
                message: 'Contacto eliminado exitosamente',
            }
        } catch (error) {
            console.error('Error en eliminarContacto:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    // ========================================
    // MÉTODOS DE ARCHIVOS
    // ========================================

    /**
     * Subir hoja de vida (PDF) al bucket
     */
    async subirHojaVida(archivo: File, contactoId: string): Promise<ApiResponse<string>> {
        try {
            const extension = archivo.name.split('.').pop()?.toLowerCase() || 'pdf'
            const nombreArchivo = `${contactoId}_hv.${extension}`
            const ruta = `${contactoId}/${nombreArchivo}`

            // Eliminar archivo anterior si existe
            await supabase.storage.from('hojas-vida').remove([ruta])

            const { error } = await supabase.storage
                .from('hojas-vida')
                .upload(ruta, archivo, {
                    cacheControl: '3600',
                    upsert: true,
                })

            if (error) {
                console.error('Error subiendo hoja de vida:', error)
                return {
                    success: false,
                    error: 'Error al subir la hoja de vida: ' + error.message,
                }
            }

            // Generar URL pública o firmada
            const { data: urlData } = await supabase.storage
                .from('hojas-vida')
                .createSignedUrl(ruta, 31536000) // 1 año

            if (urlData?.signedUrl) {
                // Actualizar el contacto con la URL
                await this.actualizarContacto(contactoId, { hoja_vida_url: urlData.signedUrl })

                return {
                    success: true,
                    data: urlData.signedUrl,
                    message: 'Hoja de vida subida exitosamente',
                }
            }

            return {
                success: false,
                error: 'Error generando URL del archivo',
            }
        } catch (error) {
            console.error('Error en subirHojaVida:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Subir firma (imagen) al bucket
     */
    async subirFirma(archivo: File, contactoId: string): Promise<ApiResponse<string>> {
        try {
            const extension = archivo.name.split('.').pop()?.toLowerCase() || 'png'
            const nombreArchivo = `${contactoId}_firma.${extension}`
            const ruta = `${contactoId}/${nombreArchivo}`

            // Eliminar archivo anterior si existe
            await supabase.storage.from('firmas').remove([ruta])

            const { error } = await supabase.storage
                .from('firmas')
                .upload(ruta, archivo, {
                    cacheControl: '3600',
                    upsert: true,
                })

            if (error) {
                console.error('Error subiendo firma:', error)
                return {
                    success: false,
                    error: 'Error al subir la firma: ' + error.message,
                }
            }

            // Generar URL pública o firmada
            const { data: urlData } = await supabase.storage
                .from('firmas')
                .createSignedUrl(ruta, 31536000) // 1 año

            if (urlData?.signedUrl) {
                // Actualizar el contacto con la URL
                await this.actualizarContacto(contactoId, { firma_url: urlData.signedUrl })

                return {
                    success: true,
                    data: urlData.signedUrl,
                    message: 'Firma subida exitosamente',
                }
            }

            return {
                success: false,
                error: 'Error generando URL del archivo',
            }
        } catch (error) {
            console.error('Error en subirFirma:', error)
            return {
                success: false,
                error: ERROR_MESSAGES.SERVER_ERROR,
            }
        }
    },

    /**
     * Refrescar URL firmada de un archivo
     */
    async refrescarUrl(url: string, bucket: 'hojas-vida' | 'firmas'): Promise<string> {
        try {
            if (!url.includes(bucket)) return url

            let pathArchivo = ''
            const urlObj = new URL(url)
            const partes = urlObj.pathname.split(`/${bucket}/`)
            if (partes.length >= 2) {
                pathArchivo = decodeURIComponent(partes[1])
            }

            if (pathArchivo) {
                const { data } = await supabase.storage
                    .from(bucket)
                    .createSignedUrl(pathArchivo, 3600)

                if (data?.signedUrl) return data.signedUrl
            }

            return url
        } catch (error) {
            console.error('Error refrescando URL:', error)
            return url
        }
    },
}

export default contactosService
