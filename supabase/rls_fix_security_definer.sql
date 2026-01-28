-- ========================================
-- SOLUCIÓN DEFINITIVA: Función SECURITY DEFINER
-- Portal de Colaboradores GESTAR SALUD IPS
-- ========================================

-- PASO 1: Crear función de verificación de permisos
-- Esta función se ejecuta con permisos de superusuario (SECURITY DEFINER)
-- permitiendo leer usuarios_portal sin importar las políticas RLS de esa tabla.

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- ¡Importante! Ejecuta como creador de la función
SET search_path = public -- Por seguridad
AS $$
BEGIN
  -- Verificar si el usuario actual es admin o superadmin y está activo
  RETURN EXISTS (
    SELECT 1 
    FROM public.usuarios_portal 
    WHERE email_institucional = (
        -- Obtener email seguro desde auth
        SELECT email FROM auth.users WHERE id = auth.uid()
    )
    AND rol IN ('superadmin', 'admin')
    AND activo = true
  );
END;
$$;

-- Permitir ejecutar la función a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.check_is_admin TO authenticated;


-- PASO 2: Actualizar la política de RLS en 'bd' para usar la función
-- Esto simplifica enormemente la política y quita los errores de permisos.

-- Eliminar la política anterior
DROP POLICY IF EXISTS "bd_update_superadmin_admin" ON public.bd;

-- Crear la política usando la función segura
CREATE POLICY "bd_update_superadmin_admin" 
ON public.bd
FOR UPDATE
TO authenticated
USING ( 
    check_is_admin() = true 
)
WITH CHECK ( 
    check_is_admin() = true 
);


-- Información de diagnóstico
DO $$
BEGIN
    RAISE NOTICE 'Función check_is_admin creada exitosamente';
    RAISE NOTICE 'Política bd_update_superadmin_admin actualizada para usar la función';
END $$;

-- Verificación final
SELECT 
    policyname, 
    cmd, 
    qual as using_clause 
FROM pg_policies 
WHERE tablename = 'bd' AND cmd = 'UPDATE';
