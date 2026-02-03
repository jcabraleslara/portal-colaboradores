# Documentación del Filtro por IPS Primaria en Exportación CUPS

## Descripción General

Se ha implementado un filtro automático en las funciones de exportación de informes de Salud Oral (tanto CSV como Excel) para incluir únicamente registros de pacientes cuya IPS primaria comience con **"GESTAR SALUD DE COLOMBIA CERETE"**.

## Cambios Realizados

### Archivos Modificados

- `src/features/saludOral/utils/cupsExport.ts`

### Funciones Afectadas

1. **`exportarInformeCups()`** - Exportación en formato CSV
2. **`exportarInformeExcel()`** - Exportación en formato Excel

## Funcionalidad

### Flujo del Filtrado

1. Se obtienen todos los registros de salud oral según los filtros proporcionados
2. Se extraen todos los IDs únicos de pacientes de los registros obtenidos
3. Se consulta la tabla `afiliados` en Supabase para obtener solo aquellos documentos que tengan:
   - `numero_documento IN (ids_de_pacientes)`
   - `ips_primaria ILIKE 'GESTAR SALUD DE COLOMBIA CERETE%'`
4. Se filtran los registros originales para incluir solo aquellos cuyos `pacienteId` estén en la lista de documentos válidos
5. Se generan las filas CUPS/Excel solo con los registros filtrados

### Validaciones

- Si no hay datos para exportar después de aplicar filtros iniciales, se lanza un error: `"No hay datos para exportar"`
- Si hay error al consultar la tabla de afiliados, se lanza: `"Error al filtrar pacientes por IPS primaria"`
- Si después del filtrado no quedan registros válidos, se lanza: `"No hay registros de pacientes con IPS primaria GESTAR SALUD DE COLOMBIA CERETE"`

## Ejemplo de Uso

```typescript
// El filtro se aplica automáticamente al exportar
await exportarInformeCups({
    fechaInicio: '2025-01-01',
    fechaFin: '2025-01-31',
    sede: 'Cereté'
})

// Solo se exportarán registros de pacientes con IPS primaria
// que comience con "GESTAR SALUD DE COLOMBIA CERETE"
```

## Estructura de la Consulta SQL

```sql
SELECT numero_documento 
FROM afiliados 
WHERE numero_documento IN ('1234567890', '0987654321', ...)
  AND ips_primaria ILIKE 'GESTAR SALUD DE COLOMBIA CERETE%'
```

El operador `ILIKE` permite coincidencias insensibles a mayúsculas/minúsculas.

## Consideraciones de Performance

- Se utiliza la operación `IN` con un array de IDs para optimizar la consulta
- Se crea un `Set` con los documentos válidos para filtrado O(1) en memoria
- La consulta solo se realiza una vez por exportación

## Mensajes de Error

| Error | Descripción |
|-------|-------------|
| `No hay datos para exportar` | No se encontraron registros con los filtros iniciales |
| `Error al filtrar pacientes por IPS primaria` | Error al consultar la tabla de afiliados |
| `No hay registros de pacientes con IPS primaria GESTAR SALUD DE COLOMBIA CERETE` | Ningún registro cumple con el criterio de IPS primaria |

## Testing

Para probar la funcionalidad:

1. Navegar a **Salud Oral → Histórico**
2. Aplicar filtros deseados (fecha, sede, etc.)
3. Hacer clic en **Exportar → Informe CUPS (.csv)** o **Excel completo (.xlsx)**
4. Verificar que el archivo generado solo contenga registros de pacientes con IPS primaria correcta

## Mantenimiento Futuro

Si se requiere cambiar el criterio de filtrado de IPS primaria:

1. Modificar la cláusula `.ilike('ips_primaria', 'PATRÓN_DESEADO%')` en ambas funciones
2. Actualizar los mensajes de error correspondientes
3. Actualizar esta documentación

## Query de Verificación

Para verificar manualmente qué pacientes se incluirán:

```sql
SELECT DISTINCT 
    a.numero_documento,
    a.primer_nombre,
    a.primer_apellido,
    a.ips_primaria
FROM afiliados a
INNER JOIN od_salud_oral o ON o.paciente_id = a.numero_documento
WHERE a.ips_primaria ILIKE 'GESTAR SALUD DE COLOMBIA CERETE%'
ORDER BY a.primer_apellido, a.primer_nombre;
```
