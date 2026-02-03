# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Agregado
- Filtro automático por IPS primaria en exportaciones de Salud Oral
  - Solo se exportan registros de pacientes con IPS primaria que comience con "GESTAR SALUD DE COLOMBIA CERETE"
  - Aplica tanto a exportación CUPS (CSV) como Excel completo
  - Validaciones de error específicas si no hay datos después del filtrado

### Modificado
- `src/features/saludOral/utils/cupsExport.ts`:
  - `exportarInformeCups()`: Agregado filtro por IPS primaria
  - `exportarInformeExcel()`: Agregado filtro por IPS primaria
- `src/features/saludOral/components/HistoricoTab.tsx`:
  - Grid de métricas PyM reducido de 5 a 4 columnas
  - Ajustada nomenclatura de "% Finalizados ST" a "% Finalizados"
- `src/features/saludOral/services/saludOral.service.ts`:
  - Eliminado cálculo de `terminadosST` (líneas 405-423)
  - Removida propiedad del objeto de retorno de métricas
- `src/types/saludOral.types.ts`:
  - Removida propiedad `terminadosST` de interfaz `OdMetrics`

### Eliminado
- Tarjeta de métrica "Terminados ST" en el histórico de Salud Oral
- Lógica de cálculo de pacientes terminados con IPS primaria CERETE

### Documentación
- Agregada documentación técnica en `docs/salud-oral-filtro-ips-cerete.md`

## [1.0.0] - YYYY-MM-DD

### Agregado
- Sistema de gestión de Salud Oral
- Registro de casos odontológicos
- Histórico con filtros y métricas
- Exportación de informes CUPS y Excel
