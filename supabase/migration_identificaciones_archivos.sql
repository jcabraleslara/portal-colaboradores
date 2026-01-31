-- ============================================================================
-- Migración: Agregar campo identificaciones_archivos a soportes_facturacion
-- Fecha: 2026-01-30
-- Propósito: Permitir búsqueda por identificaciones contenidas en nombres de archivos PDF
-- Ejemplo: PDE_900842629_CC1234567.pdf -> almacena CC1234567 y 1234567
-- ============================================================================

-- 1. Agregar columna de array para almacenar identificaciones extraídas de archivos
ALTER TABLE public.soportes_facturacion
ADD COLUMN IF NOT EXISTS identificaciones_archivos TEXT[] DEFAULT '{}';

-- 2. Crear índice GIN para búsqueda eficiente en arrays
-- GIN (Generalized Inverted Index) es óptimo para búsquedas de contenido en arrays
CREATE INDEX IF NOT EXISTS idx_soportes_identificaciones_archivos
ON public.soportes_facturacion USING GIN (identificaciones_archivos);

-- 3. Comentario descriptivo para documentación
COMMENT ON COLUMN public.soportes_facturacion.identificaciones_archivos IS
'Array de identificaciones (CC, TI, etc.) extraídas de los nombres de archivos PDF.
Incluye tanto el formato completo (CC1234567) como solo el número (1234567) para búsqueda flexible.';

-- ============================================================================
-- Verificación post-migración (ejecutar manualmente):
-- ============================================================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'soportes_facturacion'
-- AND column_name = 'identificaciones_archivos';
--
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'soportes_facturacion'
-- AND indexname = 'idx_soportes_identificaciones_archivos';
