/**
 * Schema de validación para Login
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { z } from 'zod'

export const loginSchema = z.object({
    identificacion: z
        .string()
        .min(1, 'El número de identificación es requerido')
        .regex(/^\d+$/, 'Solo se permiten números'),
    password: z
        .string()
        .min(1, 'La contraseña es requerida'),
})

export type LoginFormData = z.infer<typeof loginSchema>
