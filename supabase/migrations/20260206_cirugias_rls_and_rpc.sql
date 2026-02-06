-- ========================================
-- RLS + RPC para tabla 'cirugias'
-- Portal de Colaboradores GESTAR SALUD IPS
-- Fecha: 2026-02-06
-- ========================================

-- ═══════════════════════════════════════
-- PASO 1: Habilitar RLS en la tabla cirugias
-- ═══════════════════════════════════════

ALTER TABLE public.cirugias ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════
-- PASO 2: Crear políticas de seguridad
-- ═══════════════════════════════════════

-- Política 1: SELECT para usuarios autenticados
-- Cualquier usuario autenticado puede consultar cirugías
CREATE POLICY "datos_cirugias_select_authenticated"
ON public.cirugias
FOR SELECT
TO authenticated
USING (true);

-- Política 2: service_role acceso total
-- Permite operaciones completas desde Edge Functions y servicios backend
CREATE POLICY "service_cirugias_all"
ON public.cirugias
TO service_role
USING (true)
WITH CHECK (true);

-- ═══════════════════════════════════════
-- PASO 3: Crear RPC importar_cirugias
-- SECURITY DEFINER para bypass de RLS en INSERT
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION public.importar_cirugias(datos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    registro jsonb;
    v_insertados integer := 0;
    v_duplicados integer := 0;
    v_fecha date;
    v_cups varchar(6);
    v_dx1 varchar(5);
BEGIN
    FOR registro IN SELECT * FROM jsonb_array_elements(datos)
    LOOP
        BEGIN
            -- Parsear fecha
            v_fecha := (registro->>'fecha')::date;

            -- Normalizar CUPS (trim)
            v_cups := TRIM(registro->>'cups');

            -- Normalizar DX1 (puede ser null)
            v_dx1 := NULLIF(TRIM(UPPER(registro->>'dx1')), '');

            INSERT INTO public.cirugias (
                fecha,
                tipo_id,
                id,
                apellido1,
                apellido2,
                nombre1,
                nombre2,
                edad,
                contrato,
                dx1,
                medico,
                especialidad,
                ayudante,
                anestesiologo,
                cups,
                sede
            ) VALUES (
                v_fecha,
                TRIM(registro->>'tipo_id'),
                TRIM(registro->>'id'),
                TRIM(registro->>'apellido1'),
                TRIM(registro->>'apellido2'),
                TRIM(registro->>'nombre1'),
                TRIM(registro->>'nombre2'),
                (registro->>'edad')::integer,
                TRIM(registro->>'contrato'),
                v_dx1,
                TRIM(registro->>'medico'),
                TRIM(registro->>'especialidad'),
                TRIM(registro->>'ayudante'),
                TRIM(registro->>'anestesiologo'),
                v_cups,
                TRIM(registro->>'sede')
            )
            ON CONFLICT (fecha, id, cups) DO NOTHING;

            -- Verificar si se insertó o fue duplicado
            IF FOUND THEN
                v_insertados := v_insertados + 1;
            ELSE
                v_duplicados := v_duplicados + 1;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            -- Registro con error se cuenta como duplicado/fallido
            v_duplicados := v_duplicados + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'insertados', v_insertados,
        'duplicados', v_duplicados
    );
END;
$$;

-- Permitir ejecución a usuarios autenticados (necesario para el frontend)
GRANT EXECUTE ON FUNCTION public.importar_cirugias(jsonb) TO authenticated;

-- ═══════════════════════════════════════
-- PASO 4: Verificación
-- ═══════════════════════════════════════

-- Verificar RLS habilitado
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'cirugias'
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS habilitado correctamente en tabla cirugias';
    ELSE
        RAISE WARNING 'RLS NO se habilitó en tabla cirugias';
    END IF;
END $$;

-- Verificar políticas creadas
SELECT
    policyname AS politica,
    cmd AS operacion,
    permissive AS permisiva,
    roles AS roles_aplicados
FROM pg_policies
WHERE tablename = 'cirugias' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- Verificar función RPC
SELECT
    routine_name AS funcion,
    security_type AS tipo_seguridad
FROM information_schema.routines
WHERE routine_name = 'importar_cirugias'
AND routine_schema = 'public';

-- ═══════════════════════════════════════
-- DOCUMENTACIÓN
-- ═══════════════════════════════════════

COMMENT ON POLICY "datos_cirugias_select_authenticated" ON public.cirugias IS
'Permite a cualquier usuario autenticado consultar registros de cirugías. Usado en validación de derechos y reportes clínicos.';

COMMENT ON POLICY "service_cirugias_all" ON public.cirugias IS
'Acceso completo para service_role. Usado por Edge Functions y procesos backend.';

COMMENT ON FUNCTION public.importar_cirugias(jsonb) IS
'RPC para importación masiva de cirugías. SECURITY DEFINER para bypass de RLS.
Parámetro: datos (jsonb array con objetos CirugiaRow).
Retorna: {insertados: int, duplicados: int}.
PK compuesta: (fecha, id, cups). ON CONFLICT DO NOTHING para deduplicación.';
