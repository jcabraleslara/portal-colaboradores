-- ========================================
-- SOLUCIÓN: Limpiar políticas conflictivas
-- Portal de Colaboradores GESTAR SALUD IPS
-- ========================================

-- PASO 1: Eliminar TODAS las políticas existentes en la tabla bd
-- (Esto evita conflictos con políticas antiguas)

DROP POLICY IF EXISTS "service_bd_all" ON public.bd;
DROP POLICY IF EXISTS "bd_insert_authenticated" ON public.bd;
DROP POLICY IF EXISTS "Permitir SELECT a usuarios autenticados" ON public.bd;
DROP POLICY IF EXISTS "datos_bd_select_authenticated" ON public.bd;
DROP POLICY IF EXISTS "Permitir UPDATE a superadmin y admin" ON public.bd;
DROP POLICY IF EXISTS "bd_update_authenticated" ON public.bd;
DROP POLICY IF EXISTS "bd_select_authenticated" ON public.bd;
DROP POLICY IF EXISTS "bd_all_authenticated" ON public.bd;

-- PASO 2: Crear políticas limpias y correctas

-- Política 1: SELECT para todos los usuarios autenticados
CREATE POLICY "bd_select_all_authenticated" 
ON public.bd
FOR SELECT
TO authenticated
USING (
    -- Cualquier usuario autenticado puede leer
    EXISTS (
        SELECT 1 
        FROM public.usuarios_portal 
        WHERE id::text = auth.uid()::text
        AND activo = true
    )
);

-- Política 2: UPDATE solo para superadmin y admin
CREATE POLICY "bd_update_superadmin_admin" 
ON public.bd
FOR UPDATE
TO authenticated
USING (
    -- Solo superadmin y admin pueden actualizar
    EXISTS (
        SELECT 1 
        FROM public.usuarios_portal 
        WHERE id::text = auth.uid()::text
        AND rol IN ('superadmin', 'admin')
        AND activo = true
    )
)
WITH CHECK (
    -- Verificar también en el CHECK
    EXISTS (
        SELECT 1 
        FROM public.usuarios_portal 
        WHERE id::text = auth.uid()::text
        AND rol IN ('superadmin', 'admin')
        AND activo = true
    )
);

-- Política 3: INSERT para usuarios autenticados (si es necesario)
CREATE POLICY "bd_insert_authenticated" 
ON public.bd
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM public.usuarios_portal 
        WHERE id::text = auth.uid()::text
        AND activo = true
    )
);

-- PASO 3: Verificar que las políticas se crearon correctamente
SELECT 
    policyname,
    cmd as comando,
    CASE 
        WHEN cmd = 'SELECT' THEN '👁️ Lectura'
        WHEN cmd = 'UPDATE' THEN '✏️ Edición'
        WHEN cmd = 'INSERT' THEN '➕ Creación'
        WHEN cmd = 'DELETE' THEN '🗑️ Eliminación'
        ELSE cmd
    END as tipo_operacion,
    (qual IS NOT NULL) as tiene_using,
    (with_check IS NOT NULL) as tiene_check
FROM pg_policies
WHERE tablename = 'bd' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- PASO 4: Comentarios para documentación
COMMENT ON POLICY "bd_select_all_authenticated" ON public.bd IS 
'Permite a cualquier usuario autenticado y activo leer registros de la tabla bd';

COMMENT ON POLICY "bd_update_superadmin_admin" ON public.bd IS 
'Permite SOLO a superadmin y admin actualizar registros en la tabla bd. Usado en Validación de Derechos para editar campos de afiliados';

COMMENT ON POLICY "bd_insert_authenticated" ON public.bd IS 
'Permite a usuarios autenticados insertar nuevos registros en la tabla bd';
