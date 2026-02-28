---
description: "Deuda técnica y mejoras pendientes: archivos grandes por refactorizar, state management, cache, testing, accesibilidad, notificaciones in-app, reportes, audit trail y roadmap"
user-invocable: false
---

# Skill: Portal Pending Improvements & Technical Debt

Referencia de deuda técnica, oportunidades de optimización y mejoras pendientes del Portal de Colaboradores. Usa esta guía para priorizar trabajo futuro y entender áreas que necesitan refactoring.

---

## 1. Deuda Técnica

### Archivos Grandes que Necesitan Refactoring
| Archivo | Tamaño | Recomendación |
|---------|--------|---------------|
| Anexo8Page.tsx | 88KB | Extraer secciones en sub-componentes (formulario, medicamentos, resumen) |
| CasoDetallePanel.tsx | 75KB | Separar en tabs/secciones independientes |
| soportesFacturacion.service.ts | 59.8KB | Dividir en upload, query, notification sub-services |
| AdminUsuariosPage.tsx | 558 líneas | Extraer tabla, filtros, modales como componentes |

### State Management
- **Actualmente**: useState + useEffect en cada componente (no hay store global)
- **Problema**: Duplicación de lógica de fetch, cache inconsistente, prop drilling en módulos complejos
- **Oportunidad**: React Query/TanStack Query para cache automático, deduplicación, invalidación coordinada
- **NO se necesita Redux**: La app es page-centric, Context + React Query sería suficiente

### Cache Inconsistente
- Dashboard: sessionStorage 5min
- Auth perfil: sessionStorage + localStorage 24h
- Conteos gestionBack: sessionStorage ad-hoc
- Otros módulos: Sin cache (refetch en cada navegación)
- **Oportunidad**: Unificar con React Query

### Validación de Formularios
- Algunos módulos usan Zod (pacientes, saludOral)
- Otros tienen validación manual inline
- **Oportunidad**: Estandarizar con react-hook-form + Zod en todos los formularios

### Duplicación de Código
- Búsqueda de afiliados repetida en: validacionDerechos, radicacionCasos, soportesFacturacion, saludOral, recobros, anexo8
- Patrón de tabla paginada con filtros repetido en 6+ módulos
- Export (XLSX/CSV) implementado independientemente en cada módulo
- **Oportunidad**: Hook `useAfiliadoSearch()`, componente `DataTable` genérico, util `exportData()`

### Tipos de Retorno Inconsistentes
- Algunos services retornan `ApiResponse<T>`, otros retornan data directamente
- Algunos lanzan excepciones, otros retornan `{success: false}`
- **Oportunidad**: Estandarizar todos los services con ApiResponse<T>

---

## 2. Oportunidades de Optimización

### Performance
- Algunos chunks vendor son grandes (pdf libs). Considerar dynamic imports para funcionalidades menos usadas
- ORDENADORES_LISTA (200+) podría beneficiarse de virtualización
- Refrescos de conteos/métricas podrían ser web workers

### UX
- **Offline support**: PWA configurada pero sin manejo de offline mode real
- **Optimistic updates**: EditableField espera respuesta antes de mostrar cambio
- **Skeleton loaders**: Solo se usa LoadingSpinner, no hay skeleton screens
- **Error boundaries**: No se detectaron React Error Boundaries explícitos
- **Undo/Redo**: Operaciones destructivas no tienen undo

### Testing
- **No hay tests unitarios** en el codebase
- **No hay tests E2E**
- **Prioridad**:
  - Vitest + React Testing Library para componentes
  - Playwright para E2E de flujos críticos (login, radicación, gestión back)

### Accesibilidad
- Componentes comunes tienen buen soporte ARIA
- Feature pages: Falta landmarks, headings hierarchy, skip navigation
- Tablas de datos: Falta role="grid" y aria-sort en columnas ordenables

---

## 3. Mejoras Funcionales Pendientes

### Corto Plazo
1. **Notificaciones in-app**: Ícono campana en Header sin funcionalidad
2. **Dominio personalizado**: colaboradores.gestarsaludips.com.co pendiente
3. **Dashboard configurable**: 4 cards fijas podrían ser por rol
4. **Filtros persistentes**: Se pierden al navegar entre páginas
5. **Bulk operations**: Gestión back y recobros solo operaciones individuales

### Mediano Plazo
6. **Reportes/Analytics**: Sin módulo de reportes visuales (charts, trends)
7. **Audit trail**: Sin log de auditoría de cambios
8. **Búsqueda global**: Sin búsqueda unificada cross-module
9. **Multi-idioma**: Hardcoded español, sin i18n
10. **API rate limiting frontend**: Sin throttling en calls frecuentes

### Largo Plazo
11. **RAG mejorado**: Infraestructura embeddings existe pero sin UI de consulta AI
12. **Mobile app**: PWA básica, app nativa mejoraría UX
13. **Webhooks configurables**: Solo N8N hardcoded para contactos

---

## 4. Seguridad - Puntos de Atención

1. **Signed URLs 1 año**: Validez muy larga (riesgo si se filtran)
2. **VITE_ variables**: API keys Google/Airtable expuestas al frontend
3. **CORS**: Edge Functions permiten all origins (corsHeaders = *)
4. **Error stack traces**: criticalErrorService envía stack traces por email

---

## 5. Infraestructura

- **Vercel /api**: 2 funciones serverless (Document AI, PDF extraction) incompatibles con Deno
- **Airtable**: Parece legacy, evaluar consolidar en Supabase
- **OneDrive sync**: Columnas eliminadas en migración 20260219, verificar funcionalidad activa
- **Cron jobs**: Configurados para BD imports, verificar estado y frecuencia
