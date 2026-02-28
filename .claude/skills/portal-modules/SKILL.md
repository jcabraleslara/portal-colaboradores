---
description: "18 módulos funcionales del portal: dashboard, validación derechos, radicación, gestión back, anexo 8, recobros, salud oral, soportes facturación, demanda inducida, importar fuentes, directorio, CUPS/CIE-10, rutas, admin usuarios y sus dependencias"
user-invocable: false
---

# Skill: Portal Feature Modules Reference

Referencia de los 18 módulos funcionales del Portal de Colaboradores. Usa esta guía para entender la lógica de negocio, componentes, y dependencias de cada módulo.

---

## 1. Dashboard (`/`)
- **Archivo**: `features/dashboard/DashboardPage.tsx`
- **Hook**: `useDashboardMetrics` → RPC `get_dashboard_metrics` con cache 5min en sessionStorage
- **Métricas**: casosPendientes, soportesPorRevisar, llamadasMes, recobrosPendientes
- **Especial**: Rol `externo` redirigido automáticamente a radicación

## 2. Validación de Derechos (`/validacion-derechos`)
- **Archivo**: `features/validacionDerechos/ValidacionDerechosPage.tsx`
- **Búsqueda dual**: Numérica → documento exacto | Texto → nombre con debounce 700ms (min 3 chars)
- **Edición inline**: 14 campos editables (teléfono, email, dirección, sexo, EPS, municipio, etc.)
- **Permisos edición**: Solo admin/superadmin
- **Flujo salida**: Botón "Radicar caso" → pasa afiliado a radicación via `location.state`

## 3. Radicación de Casos (`/radicacion-casos`)
- **Archivo**: `features/radicacionCasos/RadicacionCasosPage.tsx`
- **Flujo 3 pasos**: Buscar/crear afiliado → Detalles solicitud + ruta + soportes → Resumen y confirmación
- **Integraciones**: backService.crearRadicacion, emailService, airtableService
- **Acepta**: Pre-fill desde validacionDerechos (`location.state`)
- **Roles**: Todos incluyendo externo

## 4. Gestión Back (`/gestion-back`)
- **Archivos**: `features/gestionBack/GestionBackPage.tsx` + `CasoDetallePanel.tsx` (75KB)
- **Roles**: superadmin, auditor, gerencia
- **UI**: Tarjetas métricas clickeables (filtros) + tabla paginada + panel detalle sticky
- **Estados semaforizado**: Pendiente(rojo) → Autorizado(verde) → Enrutado(azul) → Contrarreferido(negro)
- **Funcionalidades**: Cambio estado, observaciones inline, generar contrarreferencia AI, asignar ruta, eliminar, notificación Teams/Email/SMS

## 5. Anexo 8 (`/anexo-8`)
- **Archivo**: `features/anexo8/Anexo8Page.tsx` (88KB - el más grande)
- **Roles**: superadmin, auditor, asistencial, admin, gerencia
- **Componentes**: PdfExtractDialog (OCR), Cie10Search, Anexo8HistoryTab, Anexo8Template, pdfGenerator
- **OCR**: Gemini Vision para extraer datos de PDFs escaneados
- **Secuencia**: `anexo_8_numero_seq` para numeración automática
- **Posfechado**: Cadenas multi-mes con tracking de parent (`formula_padre_id`)
- **Storage**: Bucket `anexo-8` para PDFs y firmas

## 6. Recobros/Triangulaciones (`/triangulaciones`)
- **Archivo**: `features/recobros/RecobrosPage.tsx`
- **2 tabs**: Radicación (todos) | Gestión (admin/superadmin/gerencia/auditor)
- **Componentes**: RadicacionRecobrosView, GestionRecobrosView, RecobroDetallePanel, CupsSelector
- **Secuencia**: `recobros_consecutivo_seq` → formato TRIAN-XXXX
- **PDF**: pdfAprobacionGenerator para documentos de aprobación
- **Storage**: Bucket `soportes-recobros`

## 7. Salud Oral (`/salud-oral`)
- **Archivo**: `features/saludOral/SaludOralPage.tsx`
- **14 componentes**: RegistroCasoTab, HistoricoTab, MetricCards, IndiceCopFrame, ProcedimientosFrame, PoblacionesEspecialesFrame, etc.
- **Custom hooks**: useSaludOral (list, detail, metrics, CRUD mutations, byPaciente)
- **Validación**: Zod schema
- **Índice COP**: C=caries, O=obturaciones, P=perdidos
- **Poblaciones especiales**: Gestante, niño, geriátrico, discapacidad
- **Export**: CUPS (CSV) + Excel completo, filtrado por IPS primaria GESTAR SALUD CERETE

## 8. Soportes Facturación (`/soportes-facturacion`)
- **Archivo**: `features/soportesFacturacion/SoportesFacturacionPage.tsx`
- **Roles**: superadmin, operativo, admin
- **Upload flow**: init-radicacion → signed URLs → upload → finalizar-radicacion → verificar-uploads (safety net)
- **9 categorías archivos**: validación derechos, autorización, soporte clínico, comprobante recibo, orden médica, descripción quirúrgica, registro anestesia, hoja medicamentos, notas enfermería
- **OneDrive sync**: Fire-and-forget via upload-onedrive Edge Function

## 9. Demanda Inducida (`/demanda-inducida`)
- **Archivo**: `features/demandaInducida/GestionDemandaInducidaView.tsx`
- **Métricas**: Top colaborador (efectividad%), llamadas efectivas/no efectivas, casos mes
- **Filtros**: fecha inicio/fin, colaborador, programa, clasificación, búsqueda
- **Paginación**: 10 items/página con sorting multi-columna
- **Export**: CSV/XLSX/TXT

## 10. Importar Fuentes (`/importar-fuentes`)
- **Archivo**: `features/importarFuentes/ImportarFuentesPage.tsx`
- **Roles**: superadmin, auditor (hidden from sidebar)
- **9 fuentes activas**: BdNepsCloud, SaludTotal, SigiresST, Cirugías, Citas, Imágenes, Incapacidades, Ordenamientos, SigiresNeps
- **Componentes**: ImportSourceSelector, GenericImportForm, FileDropzone, ImportProgress, ImportResults, ImportHistoryTable
- **Utils**: divipolaLookup (códigos geográficos), parseSpreadsheet (XLSX/CSV)
- **Edge Function**: import-bd-neps para descarga automática desde OneDrive

## 11. Directorio Institucional (`/directorio-institucional`)
- **Archivo**: `features/directorioInstitucional/DirectorioPage.tsx`
- **Roles**: superadmin only
- **Métricas**: 6 tarjetas por empresa con colores
- **Búsqueda**: nombre, identificación, puesto, empresa, área (RPC `buscar_contactos` con unaccent)
- **Storage**: Buckets `hojas-vida`, `firmas`
- **N8N**: Webhook fire-and-forget en create/update/delete

## 12. Consultar CUPS/CIE-10/Medicamentos (`/consultar-tablas`)
- **Archivo**: `features/consultarCups/ConsultarCupsPage.tsx`
- **3 tabs**: CUPS (procedimientos), CIE-10 (diagnósticos), Medicamentos (MAPIISS)
- **Búsqueda**: Por código o descripción con debounce

## 13. Rutas Clínicas (`/rutas`)
- **Archivo**: `features/rutas/RutasPage.tsx`
- **Componentes**: RutasTable, RutasFilters, RutasStats, RutasConfig
- **24 rutas definidas** en back.types (RutaBack enum)

## 14. Admin Usuarios (`/admin/usuarios`)
- **Archivo**: `features/admin/AdminUsuariosPage.tsx` (558 líneas)
- **Roles**: superadmin only (hidden from sidebar)
- **Funciones**: CRUD usuarios, toggle activo, cambiar rol, reset password (→ identificación), export Excel
- **Componentes**: CreateUserModal (→ Edge Function create-user), ImportUserModal

## 15. Pacientes
- **Archivo**: `features/pacientes/components/NuevoPacienteForm.tsx`
- **Service**: pacientesService.crearPacienteSeguro (previene duplicados tipo_id+id, validación Zod)

## 16. Auth
- **Archivos**: `features/auth/components/LoginForm.tsx` + `ChangePasswordModal.tsx`
- **Login**: Tema dark premium, validación tiempo real, contador intentos, lockout timer
- **ChangePassword**: Primer login obligatorio (modal no cerrable) + cambio voluntario

## 17. Placeholder
- **Archivo**: `features/placeholder/PlaceholderPage.tsx`
- **Template** para módulos futuros

---

## Dependencias entre Módulos

```
validacionDerechos ──(location.state)──→ radicacionCasos
radicacionCasos ──(backService)──→ gestionBack (crea casos)
gestionBack ──(contrarreferenciaService)──→ Gemini AI
gestionBack ──(emailService/smsService/teamsService)──→ Notificaciones
anexo8 ──(afiliadosService)──→ validacionDerechos (búsqueda paciente)
soportesFacturacion ──(Edge Functions)──→ init/finalizar-radicacion → OneDrive
importarFuentes ──(9 services)──→ Tablas BD (bd, cirugias, ordenamientos, etc.)
saludOral ──(afiliadosService)──→ Búsqueda pacientes
recobros ──(cupsService)──→ Selección procedimientos
```

---

## Roles y Acceso por Módulo

| Rol | Módulos |
|-----|---------|
| superadmin | TODO + admin usuarios + importar fuentes + directorio |
| admin | Similar a superadmin sin admin usuarios |
| gerencia | Gestión back, recobros, reportes |
| auditor | Gestión back, anexo 8, importar fuentes |
| asistencial | Anexo 8, validación derechos, radicación |
| operativo | Soportes facturación, validación, radicación |
| externo | Solo radicación de casos |
