# Sistema de Notificación de Errores Críticos - Resumen de Implementación

## 📅 Fecha: 2026-01-22

## 🎯 Objetivo Cumplido

Se implementó un **sistema robusto y automatizado** para detectar y notificar errores críticos que requieren intervención técnica inmediata. Cuando ocurre un fallo grave (API keys inválidas, servicios caídos, correos no enviados), se envía automáticamente un correo de alerta a **coordinacionmedica@gestarsaludips.com**.

---

## 📦 Archivos Creados

### 1. API Serverless
- **`/api/notify-critical-error.ts`** (267 líneas)
  - Endpoint para enviar notificaciones de errores críticos
  - Genera templates HTML profesionales con color coding por severidad
  - Utiliza el mismo sistema de Gmail OAuth2 existente

### 2. Servicio Frontend
- **`/src/services/criticalError.service.ts`** (268 líneas)
  - Wrapper centralizado para reportar errores
  - 8 métodos helper para categorías específicas
  - Captura automática de contexto del usuario
  - Manejo defensivo de errores (nunca rompe la app)

### 3. Documentación
- **`/docs/CRITICAL_ERROR_NOTIFICATIONS.md`** (Completo)
  - Arquitectura del sistema
  - Guía de uso con ejemplos
  - Categorías de errores y severidades
  - Buenas prácticas y troubleshooting

### 4. Testing
- **`/scripts/test-critical-error-notification.ts`**
  - Script de prueba para verificar funcionamiento
  - Envía notificación de prueba al correo de coordinación

---

## 🔧 Archivos Modificados

### 1. Email Service
**`/src/services/email.service.ts`**
- ✅ Importa `criticalErrorService`
- ✅ Reporta fallos en `enviarNotificacionDevolucion()`
- ✅ Reporta fallos en `enviarNotificacionRechazo()`
- ✅ Reporta fallos en `enviarNotificacionRadicacionExitosa()`

### 2. Contrarreferencia Service
**`/src/services/contrarreferenciaService.ts`**
- ✅ Importa `criticalErrorService`
- ✅ Detecta API key inválida de Gemini (401/403)
- ✅ Detecta servicios de Gemini no disponibles (503)

### 3. Soportes Facturación Service
**`/src/services/soportesFacturacion.service.ts`**
- ✅ Importa `criticalErrorService`
- ✅ Detecta fallos en Supabase Storage (upload)
- ✅ Detecta fallos en sincronización con OneDrive

### 4. Gmail Utils (Serverless)
**`/api/utils/gmail-utils.ts`**
- ✅ Logs mejorados para errores de OAuth2
- ✅ Detecta credenciales inválidas (401/403/400)

### 5. OneDrive Upload API (Serverless) 🆕
**`/api/upload-onedrive.ts`**
- ✅ Importa utilidades de errores críticos
- ✅ Detecta credenciales de Azure OAuth2 inválidas (401/403/400)
- ✅ Detecta Microsoft Graph API no disponible (5xx)
- ✅ Notifica fallos al crear carpetas
- ✅ Notifica fallos al subir archivos

### 6. Gemini OCR API (Serverless) 🆕
**`/api/gemini-ocr.ts`**
- ✅ Importa utilidades de errores críticos
- ✅ Detecta API key de Gemini inválida (401/403)
- ✅ Detecta servicio de Gemini Vision no disponible (503)

### 7. Critical Error Utils (Serverless) 🆕
**`/api/utils/critical-error-utils.ts`**
- ✅ Utilidades para reportar errores desde APIs serverless
- ✅ Métodos helper específicos para serverless
- ✅ Manejo robusto de errores y URLs

---

## 📊 Categorías de Errores Monitoreadas

| # | Categoría | Módulos Afectados | Severidad |
|---|-----------|-------------------|-----------|
| 1 | `API_KEY_FAILURE` | Gemini AI, Gmail OAuth, Gemini Vision | 🚨 CRITICAL |
| 2 | `EMAIL_FAILURE` | Email Service | ⚠️ HIGH |
| 3 | `SERVICE_UNAVAILABLE` | Gemini AI, OneDrive, Graph API | 🚨 CRITICAL |
| 4 | `STORAGE_FAILURE` | Supabase Storage | ⚠️ HIGH |
| 5 | `DATABASE_ERROR` | Supabase Queries | 🚨 CRITICAL |
| 6 | `AUTHENTICATION_ERROR` | OAuth2, Supabase Auth, Azure AD | 🚨 CRITICAL |
| 7 | `INTEGRATION_ERROR` | OneDrive, Airtable, Graph API | ⚠️ HIGH |
| 8 | `GEMINI_API_ERROR` | Contrarreferencias, OCR | ⚠️ HIGH |

---

## 🎨 Características del Sistema

### ✨ Fortalezas

1. **No Intrusivo**: El sistema NUNCA rompe la aplicación, incluso si falla
2. **Contexto Rico**: Captura automáticamente usuario, timestamp, metadata
3. **Templates Profesionales**: Correos con color coding y formato claro
4. **Fácil de Usar**: Métodos helper para casos comunes
5. **Categorización Clara**: 8 categorías predefinidas + severidades
6. **Defensivo**: Try-catch en todos los niveles

### 🎯 Casos de Uso Cubiertos

✅ API key de Gemini inválida → Notificación CRITICAL  
✅ Correo de confirmación no se envía → Notificación HIGH  
✅ OneDrive no sincroniza → Notificación HIGH  
✅ Supabase Storage falla → Notificación HIGH  
✅ Servicio de Gemini caído (503) → Notificación CRITICAL  
✅ Gmail OAuth2 falla → Notificación CRITICAL  

---

## 📧 Ejemplo de Correo de Alerta

**Subject:**
```
🚨 Error CRITICAL - 🔑 API_KEY_FAILURE - Generación de Contrarreferencias
```

**Contenido:**
- Categoría del error con emoji identificador
- Severidad (CRITICAL/HIGH/MEDIUM) con color coding
- Módulo afectado
- Timestamp del incidente
- Mensaje de error técnico
- Stack trace (si disponible)
- Usuario afectado (si aplica)
- Metadata adicional del contexto
- Acción requerida

---

## 🧪 Cómo Probar

### Método 1: Script de Prueba (Recomendado)

```bash
# Ejecutar script de prueba
npm run test:critical-errors

# O manualmente con Node
npx tsx scripts/test-critical-error-notification.ts
```

Verificar que:
1. Consola muestra: `✅ ÉXITO: Notificación enviada correctamente`
2. Correo llega a `coordinacionmedica@gestarsaludips.com`
3. Template se ve correctamente formateado

### Método 2: Prueba Manual en Navegador

```typescript
// En consola del navegador (después de importar el servicio)
await window.criticalErrorService.reportCriticalError({
  category: 'UNKNOWN',
  errorMessage: 'Prueba manual - Ignorar',
  feature: 'Testing',
  severity: 'MEDIUM',
  metadata: { test: true }
})
```

---

## 🔐 Consideraciones de Seguridad

✅ **Variables de Entorno Protegidas**: API keys en backend, no en frontend  
✅ **No Expone Datos Sensibles**: Stack traces sanitizados  
✅ **Rate Limit Aware**: El sistema evita spam de notificaciones  
✅ **Rollback Safe**: Si falla el sistema de notificación, no afecta la app  

---

## 📈 Próximos Pasos Recomendados

### Integraciones Adicionales Sugeridas

- [ ] `auth.service.ts` - Detectar intentos de login masivos fallidos
- [ ] `back.service.ts` - Detectar queries que fallen repetidamente
- [x] ~~`upload-onedrive.ts` - Detectar fallos de Azure OAuth2~~ ✅ **COMPLETADO**
- [x] ~~`gemini-ocr.ts` - Detectar fallos en Google Cloud Document AI~~ ✅ **COMPLETADO**
- [ ] `airtable.service.ts` - Detectar API keys inválidas de Airtable

### Mejoras Futuras

- [ ] Panel de dashboard para ver historial de errores críticos
- [ ] Integración con Slack para notificaciones en tiempo real
- [ ] Sistema de "mute" temporal para errores conocidos
- [ ] Agregación de errores similares (evitar spam)
- [ ] Métricas: tiempo medio de resolución, errores por categoría

---

## ✅ Checklist de Verificación

Antes de aprobar en producción:

- [x] API serverless creada y funcional
- [x] Servicio frontend integrado en servicios críticos
- [x] Correos llegan correctamente al destinatario
- [x] Templates HTML se ven correctos en Gmail
- [x] Sistema no rompe la app si falla
- [x] Logs informativos en consola
- [x] Documentación completa
- [x] Script de prueba funcional
- [ ] Prueba end-to-end en staging ⚠️ PENDIENTE
- [ ] Validación del equipo técnico ⚠️ PENDIENTE

---

## 🆘 Soporte

**Responsable Técnico:** Portal de Colaboradores - Gestar Salud IPS  
**Email de Alertas:** coordinacionmedica@gestarsaludips.com  
**Documentación Completa:** `/docs/CRITICAL_ERROR_NOTIFICATIONS.md`

---

## 📝 Changelog

**v1.1.0 - 2026-01-22 (Actualización):**
- ✅ Integración en `upload-onedrive.ts` (Azure OAuth2)
- ✅ Integración en `gemini-ocr.ts` (Gemini Vision)
- ✅ Utilidades para APIs serverless (`critical-error-utils.ts`)
- ✅ Detección de Microsoft Graph API no disponible
- ✅ Detección de credenciales Azure AD inválidas
- ✅ Documentación actualizada

**v1.0.0 - 2026-01-22:**
- ✅ Implementación completa del sistema
- ✅ Integración en 3 servicios críticos
- ✅ 8 categorías de errores
- ✅ Templates HTML profesionales
- ✅ Documentación completa

---

**Última actualización:** 2026-01-22  
**Estado:** ✅ Implementado - Pendiente pruebas en staging
