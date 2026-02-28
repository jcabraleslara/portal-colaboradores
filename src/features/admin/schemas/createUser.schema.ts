/**
 * Schema de validación para Crear Usuario
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { z } from 'zod'

const ROLES = ['operativo', 'admin', 'superadmin', 'gerencia', 'auditor', 'asistencial', 'externo'] as const

export const createUserSchema = z.object({
    identificacion: z
        .string()
        .min(1, 'La identificación es requerida')
        .transform(v => v.trim()),
    nombre_completo: z
        .string()
        .min(1, 'El nombre completo es requerido')
        .transform(v => v.trim()),
    email_institucional: z
        .string()
        .min(1, 'El email institucional es requerido')
        .email('El email no es válido'),
    rol: z.enum(ROLES),
    password: z
        .string()
        .min(6, 'La contraseña debe tener al menos 6 caracteres'),
    contacto_id: z
        .string()
        .nullable()
        .optional(),
})

export type CreateUserFormData = z.infer<typeof createUserSchema>
