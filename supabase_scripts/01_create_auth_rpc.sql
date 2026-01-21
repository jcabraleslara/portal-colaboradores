-- =====================================================
-- RPC FUNCTION: get_user_profile_by_email
-- Bypass RLS para autenticación ultra-rápida
-- =====================================================

-- Drop si existe (para re-ejecución)
DROP FUNCTION IF EXISTS get_user_profile_by_email(TEXT);

-- Crear función
CREATE OR REPLACE FUNCTION get_user_profile_by_email(user_email TEXT)
RETURNS TABLE (
    identificacion TEXT,
    nombre_completo TEXT,
    email_institucional TEXT,
    rol TEXT,
    activo BOOLEAN,
    last_sign_in_at TIMESTAMPTZ
) 
SECURITY DEFINER -- ✅ Ejecuta con permisos del owner (bypassea RLS)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.identificacion,
        u.nombre_completo,
        u.email_institucional,
        u.rol,
        u.activo,
        u.last_sign_in_at
    FROM usuarios_portal u
    WHERE u.email_institucional = user_email
      AND u.activo = true -- Solo usuarios activos
    LIMIT 1;
END;
$$;

-- Permisos: Permitir a usuarios autenticados
GRANT EXECUTE ON FUNCTION get_user_profile_by_email(TEXT) TO authenticated;

-- Comentario
COMMENT ON FUNCTION get_user_profile_by_email(TEXT) IS 
'Obtiene perfil de usuario por email. SECURITY DEFINER para bypass de RLS en autenticación.';

-- =====================================================
-- ÍNDICE: email_institucional para búsqueda rápida
-- =====================================================

-- Verificar si existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'usuarios_portal' 
        AND indexname = 'idx_usuarios_portal_email'
    ) THEN
        CREATE INDEX idx_usuarios_portal_email 
        ON usuarios_portal(email_institucional);
        
        RAISE NOTICE 'Índice idx_usuarios_portal_email creado exitosamente';
    ELSE
        RAISE NOTICE 'Índice idx_usuarios_portal_email ya existe';
    END IF;
END $$;

-- =====================================================
-- ANÁLISIS DE PERFORMANCE (OPCIONAL - Para debugging)
-- =====================================================

-- Ejecutar para verificar que el índice se usa:
-- EXPLAIN ANALYZE
-- SELECT * FROM get_user_profile_by_email('coordinacionmedica@gestarsaludips.com');
