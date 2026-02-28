-- Función RPC para métricas del dashboard principal
-- Retorna conteos de pendientes y actividad del mes actual

DROP FUNCTION IF EXISTS public.get_dashboard_metrics();

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_casos_pendientes bigint;
  v_soportes_por_revisar bigint;
  v_llamadas_mes bigint;
  v_recobros_pendientes bigint;
  v_primer_dia_mes date;
BEGIN
  -- Primer día del mes actual
  v_primer_dia_mes := date_trunc('month', CURRENT_DATE)::date;

  -- Radicados de back en estado Pendiente
  SELECT COUNT(*)
    INTO v_casos_pendientes
    FROM back
   WHERE estado_radicado = 'Pendiente';

  -- Soportes de facturación en estado Pendiente
  SELECT COUNT(*)
    INTO v_soportes_por_revisar
    FROM soportes_facturacion
   WHERE estado = 'Pendiente';

  -- Registros de demanda inducida del mes actual
  SELECT COUNT(*)
    INTO v_llamadas_mes
    FROM demanda_inducida
   WHERE fecha_gestion >= v_primer_dia_mes;

  -- Solicitudes de recobro en estado Pendiente
  SELECT COUNT(*)
    INTO v_recobros_pendientes
    FROM recobros
   WHERE estado = 'Pendiente';

  RETURN jsonb_build_object(
    'casos_pendientes', COALESCE(v_casos_pendientes, 0),
    'soportes_por_revisar', COALESCE(v_soportes_por_revisar, 0),
    'llamadas_mes', COALESCE(v_llamadas_mes, 0),
    'recobros_pendientes', COALESCE(v_recobros_pendientes, 0)
  );
END;
$$;

-- Permisos para usuarios autenticados
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics() TO authenticated;
