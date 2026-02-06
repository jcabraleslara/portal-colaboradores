-- ========================================
-- RLS + RPC para tabla 'ordenamientos'
-- Portal de Colaboradores GESTAR SALUD IPS
-- Fecha: 2026-02-06
-- ========================================

-- ═══════════════════════════════════════
-- PASO 1: Habilitar RLS en la tabla ordenamientos
-- ═══════════════════════════════════════

ALTER TABLE public.ordenamientos ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════
-- PASO 2: Crear políticas de seguridad
-- ═══════════════════════════════════════

-- Política 1: SELECT para usuarios autenticados
CREATE POLICY "datos_ordenamientos_select_authenticated"
ON public.ordenamientos
FOR SELECT
TO authenticated
USING (true);

-- Política 2: service_role acceso total
CREATE POLICY "service_ordenamientos_all"
ON public.ordenamientos
TO service_role
USING (true)
WITH CHECK (true);

-- ═══════════════════════════════════════
-- PASO 3: Crear RPC importar_ordenamientos
-- SECURITY DEFINER para bypass de RLS en INSERT
-- Usa temp table para alto rendimiento en batch
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION public.importar_ordenamientos(datos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_insertados integer := 0;
    v_duplicados integer := 0;
BEGIN
    CREATE TEMP TABLE tmp_ordenamientos ON COMMIT DROP AS
    SELECT
        (r->>'fecha')::date AS fecha,
        TRIM(r->>'tipo_id') AS tipo_id,
        TRIM(r->>'id') AS id,
        TRIM(r->>'nombres_completos') AS nombres_completos,
        TRIM(r->>'contrato') AS contrato,
        TRIM(r->>'medico') AS medico,
        TRIM(r->>'especialidad') AS especialidad,
        TRIM(r->>'cups') AS cups,
        (r->>'cantidad')::integer AS cantidad,
        TRIM(r->>'servicio') AS servicio
    FROM jsonb_array_elements(datos) AS r;

    WITH inserted AS (
        INSERT INTO ordenamientos (fecha, tipo_id, id, nombres_completos, contrato, medico, especialidad, cups, cantidad, servicio)
        SELECT fecha, tipo_id, id, nombres_completos, contrato, medico, especialidad, cups, cantidad, servicio
        FROM tmp_ordenamientos
        ON CONFLICT (fecha, id, cups) DO NOTHING
        RETURNING 1
    )
    SELECT count(*) INTO v_insertados FROM inserted;

    v_duplicados := (SELECT count(*) FROM tmp_ordenamientos) - v_insertados;

    RETURN jsonb_build_object(
        'insertados', v_insertados,
        'duplicados', v_duplicados
    );
END;
$$;

-- Permitir ejecución a usuarios autenticados (necesario para el frontend)
GRANT EXECUTE ON FUNCTION public.importar_ordenamientos(jsonb) TO authenticated;

-- ═══════════════════════════════════════
-- DOCUMENTACIÓN
-- ═══════════════════════════════════════

COMMENT ON POLICY "datos_ordenamientos_select_authenticated" ON public.ordenamientos IS
'Permite a cualquier usuario autenticado consultar registros de ordenamientos. Usado en validación de derechos y reportes clínicos.';

COMMENT ON POLICY "service_ordenamientos_all" ON public.ordenamientos IS
'Acceso completo para service_role. Usado por Edge Functions y procesos backend.';

COMMENT ON FUNCTION public.importar_ordenamientos(jsonb) IS
'RPC para importación masiva de ordenamientos. SECURITY DEFINER para bypass de RLS.
Parámetro: datos (jsonb array con objetos OrdenamientoRow).
Retorna: {insertados: int, duplicados: int}.
PK compuesta: (fecha, id, cups). ON CONFLICT DO NOTHING (ordenamientos no cambian una vez registrados).
Usa temp table para alto rendimiento en batch.';
