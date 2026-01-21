/**
 * Servicio Centralizado de Gestión de Pacientes
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Maneja la lógica de negocio para creación segura de pacientes
 * evitando duplicados de bd.id independientemente de la fuente.
 */

import { supabase } from '@/config/supabase.config'
import { ApiResponse } from '@/types'

interface CrearPacienteSeguroData {
    tipoId: string
    id: string
    nombres: string
    apellido1: string
    apellido2?: string
    sexo?: string
    direccion?: string
    telefono?: string
    fechaNacimiento?: string
    municipio?: string
    departamento?: string
    regimen?: string
    ipsPrimaria?: string
    tipoCotizante?: string
    eps?: string
    email?: string
}

/**
 * Normalizar texto a mayúsculas s tildes
 */
function normalizarTexto(texto: string): string {
    return texto
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Crear paciente de forma segura evitando duplicados de bd.id
 * 
 * LÓGICA:
 * 1. Verifica si ya existe un paciente con (tipo_id, id) sin importar la fuente
 * 2. Si existe: NO crea duplicado, devuelve success
 * 3. Si NO existe: Crea con fuente PORTAL_COLABORADORES
 * 
 * Esto garantiza que NUNCA habrá dos registros con el mismo bd.id
 * pero diferente fuente que incluya PORTAL_COLABORADORES.
 */
export async function crearPacienteSeguro(
    data: CrearPacienteSeguroData
): Promise<ApiResponse<{ id: string; yaExistia: boolean }>> {
    try {
        // PASO 1: Verificar si ya existe (cualquier fuente)
        const { data: existente, error: errorBusqueda } = await supabase
            .from('bd')
            .select('tipo_id, id, fuente')
            .eq('tipo_id', data.tipoId)
            .eq('id', data.id)
            .limit(1)
            .single()

        if (errorBusqueda && errorBusqueda.code !== 'PGRST116') {
            // Error diferente a "no encontrado"
            console.error('Error verificando paciente existente:', errorBusqueda)
            return {
                success: false,
                error: 'Error al verificar paciente existente: ' + errorBusqueda.message
            }
        }

        // PASO 2: Si ya existe, no crear duplicado
        if (existente) {
            console.log(`✓ Paciente ${data.tipoId} ${data.id} ya existe con fuente: ${existente.fuente}. No se crea duplicado.`)
            return {
                success: true,
                data: { id: data.id, yaExistia: true },
                message: `Paciente ya existe en el sistema (fuente: ${existente.fuente})`
            }
        }

        // PASO 3: No existe, crear con fuente PORTAL_COLABORADORES
        const { error: errorInsertar } = await supabase
            .from('bd')
            .insert({
                tipo_id: data.tipoId,
                id: data.id,
                nombres: normalizarTexto(data.nombres),
                apellido1: normalizarTexto(data.apellido1),
                apellido2: data.apellido2 ? normalizarTexto(data.apellido2) : null,
                sexo: data.sexo || null,
                direccion: data.direccion ? normalizarTexto(data.direccion) : null,
                telefono: data.telefono || null,
                fecha_nacimiento: data.fechaNacimiento || null,
                municipio: data.municipio || null,
                departamento: data.departamento || null,
                regimen: data.regimen || null,
                ips_primaria: data.ipsPrimaria || null,
                tipo_cotizante: data.tipoCotizante || null,
                eps: data.eps || null,
                email: data.email || null,
                fuente: 'PORTAL_COLABORADORES',
                estado: 'ACTIVO'
            })

        if (errorInsertar) {
            console.error('Error creando paciente:', errorInsertar)
            return {
                success: false,
                error: 'Error al crear paciente: ' + errorInsertar.message
            }
        }

        console.log(`✓ Paciente ${data.tipoId} ${data.id} creado exitosamente con fuente PORTAL_COLABORADORES`)
        return {
            success: true,
            data: { id: data.id, yaExistia: false },
            message: 'Paciente creado exitosamente'
        }

    } catch (error) {
        console.error('Error en crearPacienteSeguro:', error)
        return {
            success: false,
            error: 'Error inesperado al crear paciente'
        }
    }
}

export const pacientesService = {
    crearPacienteSeguro
}
