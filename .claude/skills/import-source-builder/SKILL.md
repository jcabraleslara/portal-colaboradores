---
description: "Guía para construir procesadores de importación: arquitectura del módulo importarFuentes, template de servicio, template RPC PostgreSQL, formato archivos fuente, convenciones y checklist"
user-invocable: false
---

# Skill: Import Source Builder

Guía completa para construir procesadores de importación en el módulo `importarFuentes`.

---

## 1. Arquitectura del Módulo

```
src/features/importarFuentes/
├── config/
│   └── importSources.config.ts   # Configuración de las 15 fuentes (id, status, icon, etc.)
├── types/
│   └── import.types.ts            # ImportSourceId, ImportResult, ImportProcessorFn, etc.
├── utils/
│   └── parseSpreadsheet.ts        # Parseo multi-formato (HTML-XLS, XLS binario, XLSX)
├── services/
│   ├── index.ts                   # Registro IMPORT_PROCESSORS (mapa sourceId → función)
│   ├── citasImportService.ts      # Patrón de referencia (379 líneas)
│   └── <fuente>ImportService.ts   # Nuevos procesadores aquí
└── components/                    # UI del módulo (no modificar al agregar fuentes)
```

### Archivos clave fuera del módulo
- `supabase/` → RPCs de importación (alto rendimiento)
- `.temp/` → Scripts SQL temporales para crear RPCs

---

## 2. Checklist de Implementación

Para agregar una nueva fuente de importación:

- [ ] **Definir COLUMN_MAP**: Encabezados del archivo fuente → campos de la tabla BD
- [ ] **Definir transformaciones por campo**: `parseDate()`, `cleanId()`, `parseInt()`, `trim()`, `UPPERCASE`
- [ ] **Definir validaciones FK**: cie10, cups, bd, etc. (batch queries de 1000)
- [ ] **Crear servicio** `services/<fuente>ImportService.ts` con `process<Fuente>File()`
- [ ] **Registrar en `services/index.ts`**: Agregar import + entrada en `IMPORT_PROCESSORS`
- [ ] **Activar en `config/importSources.config.ts`**: `status: 'active'` + `targetTable: '<tabla>'`
- [ ] **Crear RPC en Supabase Cloud** si aplica (alto rendimiento para >500 registros)
- [ ] **Verificar con archivo de prueba** (importación + re-importación dedup)
- [ ] **`npm run build` sin errores**

---

## 3. Template del Servicio

```typescript
/**
 * Servicio de importación para <Fuente>
 * Procesa archivos XLS/XLSX del sistema <origen>
 */

import { supabase } from '@/config/supabase.config'
import type { ImportResult, ImportProgressCallback } from '../types/import.types'
import { parseSpreadsheetFile } from '../utils/parseSpreadsheet'

export interface <Fuente>Row {
    // Campos que mapean 1:1 con la tabla destino
    campo1: string
    campo2: string | null
    // ...
}

/** Mapeo de encabezados HTML a columnas de BD */
const COLUMN_MAP: Record<string, keyof <Fuente>Row> = {
    'ENCABEZADO_HTML': 'campo_bd',
    // ...
}

/** Normaliza encabezados (elimina acentos, espacios extra) */
const normalizeHeader = (h: string): string => {
    return h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase()
}

/** Parsea fechas en múltiples formatos */
const parseDate = (val: string): string | null => {
    if (!val || !val.trim()) return null
    const trimmed = val.trim()
    // YYYY/MM/DD
    const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/)
    if (slashMatch) return `${slashMatch[1]}-${slashMatch[2].padStart(2,'0')}-${slashMatch[3].padStart(2,'0')}`
    // DD/MM/YYYY
    const legacyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (legacyMatch) return `${legacyMatch[3]}-${legacyMatch[2].padStart(2,'0')}-${legacyMatch[1].padStart(2,'0')}`
    // YYYY-MM-DD (ISO)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    return null
}

/** Limpia identificación: trim + quitar .0 de Excel */
const cleanId = (val: string): string => {
    return val.trim().replace(/\.0$/, '')
}

/** Parsea entero, retorna null si no es número */
const parseInteger = (val: string): number | null => {
    const n = parseInt(val, 10)
    return isNaN(n) ? null : n
}

/**
 * Procesa archivo de <fuente> (XLS/HTML)
 */
export async function process<Fuente>File(
    file: File,
    onProgress: ImportProgressCallback
): Promise<ImportResult> {
    const startTime = performance.now()

    // ═══ Fase 1: Leer archivo (0-5%) ═══
    // parseSpreadsheetFile detecta automáticamente HTML vs Excel binario
    onProgress('Leyendo archivo...', 0)
    const doc = await parseSpreadsheetFile(file)

    // ═══ Fase 2: Detectar tabla + mapear columnas (5-10%) ═══
    onProgress('Analizando estructura...', 5)
    // ... (buscar tabla, mapear headers con COLUMN_MAP)

    // ═══ Fase 3: Extraer filas + pre-filtrar (10-15%) ═══
    onProgress('Extrayendo datos...', 10)
    // ... (iterar filas, dedup con Map, filtrar sin PK)

    // ═══ Fase 4: Validar FK batch (15-45%) ═══
    onProgress('Validando referencias...', 15)
    // Queries batch de 1000 contra tablas maestras

    // ═══ Fase 5: Separar válidos de inválidos (45-50%) ═══
    // ... registros con FK inválido van al reporte

    // ═══ Fase 6: Enviar a BD (50-90%) ═══
    // Opción A: RPC (rendimiento) → supabase.rpc('importar_<fuente>', { datos })
    // Opción B: Upsert client-side → batches de 100

    // ═══ Fase 7: Generar reporte CSV (90-95%) ═══
    // Secciones: FK inválidos, advertencias BD nominal

    // ═══ Fase 8: Registrar en import_history (95-100%) ═══

    // return ImportResult
}
```

---

## 4. Template RPC PostgreSQL

```sql
CREATE OR REPLACE FUNCTION public.importar_<fuente>(datos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_insertados integer := 0;
  v_duplicados integer := 0;
  v_fk_invalidos integer := 0;
  v_total integer;
  v_fk_erroneos jsonb := '[]'::jsonb;
BEGIN
  -- Tabla temporal desde JSONB
  CREATE TEMP TABLE tmp_<fuente> ON COMMIT DROP AS
  SELECT
    (r->>'campo_pk')::tipo AS campo_pk,
    r->>'campo' AS campo
    -- ... más campos
  FROM jsonb_array_elements(datos) AS r;

  SELECT count(*) INTO v_total FROM tmp_<fuente>;

  -- Validar FK (ej: cie10, cups)
  SELECT count(*), jsonb_agg(DISTINCT jsonb_build_object('campo_fk', t.campo_fk))
  INTO v_fk_invalidos, v_fk_erroneos
  FROM tmp_<fuente> t
  LEFT JOIN tabla_maestra m ON m.pk = t.campo_fk
  WHERE t.campo_fk IS NOT NULL AND t.campo_fk <> '' AND m.pk IS NULL;

  -- Eliminar filas con FK inválido
  DELETE FROM tmp_<fuente> t
  WHERE t.campo_fk IS NOT NULL AND t.campo_fk <> ''
    AND NOT EXISTS (SELECT 1 FROM tabla_maestra m WHERE m.pk = t.campo_fk);

  -- INSERT ON CONFLICT
  WITH inserted AS (
    INSERT INTO <tabla_destino> (col1, col2, ..., updated_at)
    SELECT col1, col2, ..., now()
    FROM tmp_<fuente>
    ON CONFLICT (<pk_columns>) DO UPDATE SET
      col2 = EXCLUDED.col2,
      -- ... más campos
      updated_at = now()
    RETURNING xmax
  )
  SELECT
    count(*) FILTER (WHERE xmax = 0),
    count(*) FILTER (WHERE xmax <> 0)
  INTO v_insertados, v_duplicados
  FROM inserted;

  RETURN jsonb_build_object(
    'insertados', v_insertados,
    'actualizados', v_duplicados,
    'fk_invalidos', v_fk_invalidos,
    'fk_erroneos', v_fk_erroneos,
    'total_recibidos', v_total
  );
END;
$$;
```

**Nota sobre `xmax`**: Cuando `xmax = 0` el registro fue insertado (nuevo). Cuando `xmax <> 0` fue actualizado (ya existía).

---

## 5. Formato de Archivos Fuente

### Soporte multi-formato (HTML, XLS, XLSX)

La utilidad `parseSpreadsheetFile()` en `utils/parseSpreadsheet.ts` detecta automáticamente el formato:
- **HTML disfrazado de XLS**: Detecta `<` en los primeros bytes → parsea como HTML
- **XLS binario / XLSX**: Usa SheetJS (`xlsx`) → convierte la primera hoja a HTML → parsea como Document

Todos los servicios reciben un `Document` HTML uniforme, sin importar el formato original del archivo.

### HTML disfrazado (formato más común)

Los archivos `.xls` del sistema clínico son **HTML disfrazados** (no binarios Excel). Patrón:

```html
<div class="block">
<table width="100%" border="0">
  <tr>
    <td>&nbsp;</td>           <!-- Columna índice (ignorar) -->
    <td class="head">
      <label><b>&nbsp;&nbsp;NombreColumna&nbsp;&nbsp;</b></label>
    </td>
    <!-- ... más headers -->
  </tr>
  <tr height="20px">
    <td class="head" align="center"><label>1</label></td>  <!-- Índice fila -->
    <td bgColor="#EFEFEF" class="letraDisplay tdHover">valor</td>
    <!-- ... más celdas -->
  </tr>
```

**Importante**: La primera `<td>` de cada fila es un **contador** (1, 2, 3...) y NO es dato real. El COLUMN_MAP debe ignorar esa columna.

### Encabezados
- Están dentro de `<b>&nbsp;&nbsp;Nombre&nbsp;&nbsp;</b>` → usar `textContent.trim()` para extraer
- Nombres sin espacios (PascalCase): `FechaAtencion`, `TipoIdentificacion`, etc.

---

## 6. Referencia de Archivos Clave

| Archivo | Rol | Líneas aprox. |
|---------|-----|---------------|
| `citasImportService.ts` | Patrón de referencia completo | 379 |
| `services/index.ts` | Registro de procesadores (`IMPORT_PROCESSORS`) | 37 |
| `config/importSources.config.ts` | Config de 15 fuentes (status, icon, gradient) | 300 |
| `types/import.types.ts` | Tipos compartidos (ImportResult, ImportProcessorFn) | 100 |

---

## 7. Convenciones

### Progreso (porcentajes)
| Rango | Fase |
|-------|------|
| 0-5% | Leer + parsear archivo |
| 5-10% | Detectar tabla + mapear columnas |
| 10-15% | Extraer filas + dedup |
| 15-45% | Validar FK (cie10, cups, bd, etc.) |
| 45-50% | Separar válidos / inválidos |
| 50-90% | Insert/Upsert a BD |
| 90-95% | Generar reporte CSV |
| 95-100% | Registrar en import_history |

### Batch sizes
- **Queries de validación FK**: 1000 registros por batch
- **Upsert client-side**: 100 registros por batch
- **RPC server-side**: Sin límite (todo en un solo call, max ~5000)

### Deduplicación
- Usar `Map<string, Row>` con la PK como key antes de enviar a BD
- Contar duplicados del archivo para el reporte

### import_history
- Siempre registrar al final del proceso
- Campos: `usuario`, `archivo_nombre`, `tipo_fuente`, `total_registros`, `exitosos`, `fallidos`, `duplicados`, `duracion`, `detalles`

### Error Report (CSV multi-sección)
```
=== SECCION: <TIPO_ERROR> ===
COLUMNA1,COLUMNA2
"valor1","valor2"

=== SECCION: <ADVERTENCIAS> ===
COLUMNA1,COLUMNA2
"valor1","valor2"
```
