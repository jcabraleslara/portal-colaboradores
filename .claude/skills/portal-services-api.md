# Skill: Portal Services & API Layer Reference

Referencia de los 22 servicios, tipos TypeScript, utilidades y patrones de API del Portal de Colaboradores. Usa esta guía para entender la capa de servicios y cómo conectan frontend con backend.

---

## 1. Patrones Generales

- **Response wrapper**: `ApiResponse<T>` → `{success, data?, error?, message?}`
- **Error handling**: Console error + return error response; errores críticos → criticalErrorService
- **Data transform**: snake_case (DB) → camelCase (frontend)
- **Date handling**: `parseDateLocal()` para evitar offset UTC-5 Colombia
- **Búsqueda**: Min 3 chars, case-insensitive ilike con tokenización
- **Paginación**: offset/limit consistente
- **Fire-and-forget**: SMS, emails, updates secundarios → `.then().catch()` sin await
- **Retry**: Exponential backoff para rate limits (429)
- **Timeout**: Promise.race() con 15s máximo

---

## 2. Servicios por Categoría

### Auth & Usuarios
| Servicio | Tabla(s) | Funciones Clave |
|----------|----------|-----------------|
| auth.service | usuarios_portal, Supabase Auth | login, changePassword, validatePasswordStrength, logout, getSession |
| usuariosPortal.service | usuarios_portal | getAll, create, update, toggleActive, changeRole, delete, getRoleStats |

### Pacientes/Afiliados
| Servicio | Tabla(s) | Funciones Clave |
|----------|----------|-----------------|
| pacientes.service | bd | crearPacienteSeguro (Zod validation, dedup tipo_id+id) |
| afiliados.service | afiliados (view), bd (updates) | buscarPorDocumento, buscarPorTexto, 14 métodos actualizar* |

### Radicación & Casos
| Servicio | Tabla(s) | Funciones Clave |
|----------|----------|-----------------|
| back.service | back, afiliados, contactos, red | crearRadicacion, obtenerCasosFiltrados, obtenerConteos, actualizarCaso, subirSoportes |
| soportesFacturacion.service | soportes_facturacion, bd | CRUD completo + PDF management, rejection workflows, email notifications |

### Prescripciones & Recobros
| Servicio | Tabla(s) | Funciones Clave |
|----------|----------|-----------------|
| anexo8.service | anexo_8, usuarios_portal, contactos | crearAnexo8, crearAnexos8Multiples, obtenerDatosMedico, subirPdf, subirFirma |
| pdfExtractAnexo8.service | - (PDF parsing) | extraerDatosPdf (regex patterns), pdfToBase64, confidence score |
| recobros.service | recobros | generarConsecutivo (TRIAN-XXXX), crearRecobro, subirPdfAprobacion |

### Tablas Referencia
| Servicio | Tabla | Funciones Clave |
|----------|-------|-----------------|
| cie10.service | cie10 | buscarCie10, buscarCie10Avanzado (código o descripción tokenizada) |
| cups.service | cups | buscar, obtenerPorCodigo, actualizar |
| medicamentos.service | medicamentos | buscar (MAPIISS codes) |

### Integraciones Externas
| Servicio | Destino | Funciones Clave |
|----------|---------|-----------------|
| airtable.service | Airtable REST API | crearRadicacion, testConnection |
| email.service | Edge Function send-email | 7 tipos: devolucion, rechazo, radicacion, no_contactable, devolucion_recobro, aprobacion_recobro, fallo_subida |
| sms.service | Edge Function sms | enviarNotificacionEstado (solo Autorizado/Contrarreferido, cel colombiano 10 digs) |
| teams.service | Edge Function teams-notify | notificar (tipo: devolucion_back) |
| contactos.service | contactos, RPC buscar_contactos | CRUD + hojas-vida/firmas storage + N8N webhook sync |

### AI & Documentos
| Servicio | Destino | Funciones Clave |
|----------|---------|-----------------|
| contrarreferenciaService | Edge Function generar-contrarreferencia | Cache check → Gemini → fire-and-forget cache save (min 400 chars) |
| embedding.service | Edge Function generate-embedding | Gemini 768-dim, batch sequential 50ms delay |
| rag.service | pdf_embeddings | vectorizarPdf (3 métodos: native, Document AI, Gemini Vision fallback) |

### Errores & Monitoreo
| Servicio | Destino | Funciones Clave |
|----------|---------|-----------------|
| criticalErrorService | Edge Function notify-critical-error | 3 severidades, 9 categorías, 7 métodos wrapper |
| demandaInducidaService | demanda_inducida | getAll, getMetrics (effectiveness%, top colaborador), RPC unique lists |

---

## 3. Storage Buckets

| Bucket | Uso | Signed URL Validity |
|--------|-----|-------------------|
| soportes-back | PDFs casos radicados | 1 año |
| soportes-facturacion | Documentos billing | 1 año |
| soportes-recobros | Documentos recobros | 1 año |
| anexo-8 | PDFs prescripciones + firmas | 1 año |
| hojas-vida | CVs contactos | 1 año |
| firmas | Firmas digitales contactos | 1 año |

---

## 4. API Config (api.config.ts)

### Edge Functions
sms, createUser, geminiOcr, sendEmail, resetPassword, notifyCriticalError, initRadicacion, finalizarRadicacion, generateEmbedding, generarContrarreferencia, teamsNotify, verificarUploads, importBdNeps

### Vercel Serverless (/api/*)
- `/api/ocr` - Document AI (SDK incompatible Deno)
- `/api/pdf-extract-anexo8` - pdf-lib (Node-only deps)

### Helper: `fetchEdgeFunction<T>`
Wrapper con headers JWT automáticos + error handling

---

## 5. Tipos TypeScript (9 archivos)

- **index.ts**: UserRole (8 roles), AuthUser, Afiliado/AfiliadoRaw, ApiResponse<T>, Cups, Medicamento
- **back.types.ts**: TipoSolicitudBack (7), EstadoRadicado (8 con colores), RutaBack (24), ORDENADORES_LISTA (200+)
- **anexo8.types.ts**: MEDICAMENTOS_CONTROLADOS (31), FORMAS_FARMACEUTICAS (10), Anexo8Record/FormData/OcrResult
- **recobros.types.ts**: EstadoRecobro (4), CupsSeleccionado
- **contactos.types.ts**: Contacto (38 campos), ROL_LISTA (7)
- **demandaInducida.ts**: DemandaInducida, DemandaMetrics, PaginatedResponse<T>
- **soportesFacturacion.types.ts**: EpsFacturacion (15), CategoriaArchivo (3), ServicioPrestado (10+)
- **saludOral.types.ts**: OdMetrics, COP index types, CUPS procedures mapping

---

## 6. Utilidades (4 archivos)

- **date.utils.ts**: parseDateLocal, formatDateForDB, getFechaHoyColombia, calcularEdad
- **device.utils.ts**: isMobileOrTablet (UA detection)
- **clipboard.ts**: copyRichText (markdown → HTML clipboard para Word/Outlook)
- **numeroALetras.ts**: 0-999999 → español ("treinta", "ciento ochenta")
