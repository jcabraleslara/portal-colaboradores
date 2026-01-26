/**
 * Servicio Centralizado de Gestión de Pacientes
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Maneja la lógica de negocio para creación segura de pacientes
 * evitando duplicados de bd.id independientemente de la fuente.
 */

import { supabase } from '@/config/supabase.config'
import { ApiResponse } from '@/types'
import { z } from 'zod'

// Esquema de validación estricto para PORTAL_COLABORADORES
const PacientePortalSchema = z.object({
    // Tipos de ID validados contra tabla tipoid (CE, CN, SC, PE, PT, TI, CC, RC, ME, AS)
    tipoId: z.enum(['CC', 'TI', 'CE', 'PA', 'RC', 'MS', 'AS', 'PT', 'CN', 'SC', 'PE', 'ME']),
    id: z.string().min(3, 'El documento debe tener al menos 3 caracteres'),
    nombres: z.string().min(2, 'El nombre es muy corto').transform(val => val.toUpperCase()),
    apellido1: z.string().min(2, 'El primer apellido es muy corto').transform(val => val.toUpperCase()),
    apellido2: z.string().optional().nullable().transform(val => val?.toUpperCase() || null),
    sexo: z.enum(['M', 'F']).optional().nullable(),
    direccion: z.string().optional().nullable().transform(val => val?.toUpperCase() || null),
    telefono: z.string().optional().nullable(),
    fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').optional().nullable(),
    municipio: z.string().length(3, 'Código de municipio inválido').optional().nullable(),
    departamento: z.string().length(2, 'Código de departamento inválido').optional().nullable(),
    regimen: z.enum(['CONTRIBUTIVO', 'SUBSIDIADO']).optional().nullable(),
    ipsPrimaria: z.string().optional().nullable(),
    tipoCotizante: z.enum(['COTIZANTE', 'BENEFICIARIO']).optional().nullable(),
    eps: z.enum(['NUEVA EPS', 'SALUD TOTAL', 'FAMILIAR DE COLOMBIA']).optional().nullable(),
    email: z.string().email('Email inválido').optional().nullable(),
})

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
 * Normalizar texto a mayúsculas sin tildes
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
 * 1. Valida estrictamente los datos con Zod
 * 2. Verifica si ya existe un paciente con (tipo_id, id) sin importar la fuente
 * 3. Si existe: NO crea duplicado, devuelve success
 * 4. Si NO existe: Crea con fuente PORTAL_COLABORADORES
 * 
 * Esto garantiza que NUNCA habrá dos registros con el mismo bd.id
 * pero diferente fuente que incluya PORTAL_COLABORADORES.
 */
export async function crearPacienteSeguro(
    data: CrearPacienteSeguroData
): Promise<ApiResponse<{ id: string; yaExistia: boolean }>> {
    try {
        // PASO 0: Validación de Tipos Estricta
        const validacion = PacientePortalSchema.safeParse(data)

        if (!validacion.success) {
            const errores = (validacion.error as any).errors.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')
            console.error('Error de validación Zod:', errores)
            return {
                success: false,
                error: `Error de validación: ${errores}`
            }
        }

        const safeData = validacion.data

        // PASO 1: Verificar si ya existe (cualquier fuente)
        const { data: existente, error: errorBusqueda } = await supabase
            .from('bd')
            .select('tipo_id, id, fuente')
            .eq('tipo_id', safeData.tipoId)
            .eq('id', safeData.id)
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
            console.log(`✓ Paciente ${safeData.tipoId} ${safeData.id} ya existe con fuente: ${existente.fuente}. No se crea duplicado.`)
            return {
                success: true,
                data: { id: safeData.id, yaExistia: true },
                message: `Paciente ya existe en el sistema (fuente: ${existente.fuente})`
            }
        }

        // PASO 3: No existe, crear con fuente PORTAL_COLABORADORES
        const { error: errorInsertar } = await supabase
            .from('bd')
            .insert({
                tipo_id: safeData.tipoId,
                id: safeData.id,
                nombres: normalizarTexto(safeData.nombres),
                apellido1: normalizarTexto(safeData.apellido1),
                apellido2: safeData.apellido2 ? normalizarTexto(safeData.apellido2) : null,
                sexo: safeData.sexo || null,
                direccion: safeData.direccion ? normalizarTexto(safeData.direccion) : null,
                telefono: safeData.telefono || null,
                fecha_nacimiento: safeData.fechaNacimiento || null,
                municipio: safeData.municipio || null,
                departamento: safeData.departamento || null,
                regimen: safeData.regimen || null,
                ips_primaria: safeData.ipsPrimaria || null,
                tipo_cotizante: safeData.tipoCotizante || null,
                eps: safeData.eps || null,
                email: safeData.email || null,
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

        console.log(`✓ Paciente ${safeData.tipoId} ${safeData.id} creado exitosamente con fuente PORTAL_COLABORADORES`)
        return {
            success: true,
            data: { id: safeData.id, yaExistia: false },
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
