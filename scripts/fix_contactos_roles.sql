-- Solución al error: new row for relation "contactos" violates check constraint "contactos_rol_check"
-- El constraint actual no incluye 'superadministrador' ni otros roles necesarios.

-- 1. Eliminar el constraint restrictivo actual
ALTER TABLE public.contactos DROP CONSTRAINT IF EXISTS contactos_rol_check;

-- 2. Crear el nuevo constraint con todos los roles permitidos
ALTER TABLE public.contactos ADD CONSTRAINT contactos_rol_check 
    CHECK (rol IN ('superadministrador', 'administrador', 'gerencia', 'auditor', 'asistencial', 'operativo', 'externo'));

-- Comentario: Se han agregado 'superadministrador', 'gerencia' y 'auditor'.
