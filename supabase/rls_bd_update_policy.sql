-- ========================================
-- RLS Policies para tabla 'bd'
-- Portal de Colaboradores GESTAR SALUD IPS
-- ========================================

-- Permitir UPDATE a superadmin y admin en la tabla 'bd'
-- Esta política permite que los usuarios con rol 'superadmin' o 'admin'
-- puedan actualizar registros en la tabla bd

-- Primero, habilitar RLS en la tabla 'bd' si no está habilitado
ALTER TABLE public.bd ENABLE ROW LEVEL SECURITY;

-- Eliminar política anterior si existe (para evitar conflictos)
DROP POLICY IF EXISTS "Permitir UPDATE a superadmin y admin" ON public.bd;

-- Crear nueva política de UPDATE para superadmin y admin
CREATE POLICY "Permitir UPDATE a superadmin y admin" 
ON public.bd
FOR UPDATE
TO authenticated
USING (
    -- Verificar que el usuario autenticado tenga rol superadmin o admin
    EXISTS (
        SELECT 1 
        FROM public.usuarios_portal 
        WHERE email_institucional = auth.jwt() ->> 'email'
        AND rol IN ('superadmin', 'admin')
        AND activo = true
    )
)
WITH CHECK (
    -- La misma verificación para el CHECK (después del UPDATE)
    EXISTS (
        SELECT 1 
        FROM public.usuarios_portal 
        WHERE email_institucional = auth.jwt() ->> 'email'
        AND rol IN ('superadmin', 'admin')
        AND activo = true
    )
);

-- Política de SELECT para todos los usuarios autenticados (si no existe)
-- Esto permite que cualquier usuario autenticado pueda leer de la tabla bd
DROP POLICY IF EXISTS "Permitir SELECT a usuarios autenticados" ON public.bd;

CREATE POLICY "Permitir SELECT a usuarios autenticados" 
ON public.bd
FOR SELECT
TO authenticated
USING (
    -- Verificar que el usuario esté autenticado y activo
    EXISTS (
        SELECT 1 
        FROM public.usuarios_portal 
        WHERE email_institucional = auth.jwt() ->> 'email'
        AND activo = true
    )
);

-- ========================================
-- Comentarios y documentación
-- ========================================

COMMENT ON POLICY "Permitir UPDATE a superadmin y admin" ON public.bd IS 
'Permite a usuarios con rol superadmin o admin actualizar registros en la tabla bd (afiliados). Utilizado en el módulo de Validación de Derechos para editar campos como dirección, email, teléfono y observaciones.';

COMMENT ON POLICY "Permitir SELECT a usuarios autenticados" ON public.bd IS 
'Permite a cualquier usuario autenticado y activo consultar la tabla bd. Utilizado en múltiples módulos del portal para validación de derechos y gestión de afiliados.';
