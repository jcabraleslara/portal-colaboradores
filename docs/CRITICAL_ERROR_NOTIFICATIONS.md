# Sistema de Notificación de Errores Críticos

## 📋 Descripción

Sistema automatizado de monitoreo y notificación de errores críticos que requieren intervención técnica inmediata. Cuando ocurre un error grave (API keys inválidas, servicios caídos, correos no enviados), se envía automáticamente una alerta por correo electrónico a **coordinacionmedica@gestarsaludips.com**.

## 🎯 Objetivo

Detectar y notificar proactivamente fallos críticos del sistema para:
- Reducir el tiempo de respuesta ante incidentes
- Evitar que errores silenciosos afecten la operación
- Mantener trazabilidad de problemas técnicos graves

## 🏗️ Arquitectura

### Componentes

1. **API Serverless** (`/api/notify-critical-error.ts`)
   - Recibe reportes de errores críticos desde el frontend
   - Genera templates HTML informativos
   - Envía correos usando Gmail API

2. **Servicio Frontend** (`/src/services/criticalError.service.ts`)
   - Wrapper centralizado para reportar errores
   - Captura automáticamente contexto del usuario
   - Métodos helper para diferentes categorías de errores

3. **Integraciones en Servicios Existentes**
   - `email.service.ts`: Detecta fallos en envío de correos
   - `contrarreferenciaService.ts`: Monitorea errores de Gemini API
   - `soportesFacturacion.service.ts`: Detecta fallos de Storage y OneDrive

## 📊 Categorías de Errores Monitoreadas

| Categoría | Descripción | Severidad Típica |
|-----------|-------------|------------------|
| `API_KEY_FAILURE` | API keys inválidas o expiradas | CRITICAL |
| `EMAIL_FAILURE` | Correos que no se pudieron enviar | HIGH |
| `SERVICE_UNAVAILABLE` | Servicios externos caídos (Gemini, OneDrive) | CRITICAL |
| `STORAGE_FAILURE` | Fallos en Supabase Storage | HIGH |
| `DATABASE_ERROR` | Errores graves en base de datos | CRITICAL |
| `AUTHENTICATION_ERROR` | Problemas de autenticación OAuth2 | CRITICAL |
| `INTEGRATION_ERROR` | Fallos en integraciones (OneDrive, Airtable) | HIGH |
| `GEMINI_API_ERROR` | Errores en APIs de Gemini | HIGH |

## 💡 Niveles de Severidad

- **CRITICAL** 🚨: Requiere acción inmediata. Afecta funcionalidad core.
- **HIGH** ⚠️: Requiere atención pronto. Limita funcionalidad importante.
- **MEDIUM** ⚡: Monitoreado. Puede afectar experiencia del usuario.

## 🚀 Uso

### Reportar Error Crítico (Genérico)

```typescript
import { criticalErrorService } from '@/services/criticalError.service'

try {
  // Operación crítica
  await someApiCall()
} catch (error) {
  await criticalErrorService.reportCriticalError({
    category: 'API_KEY_FAILURE',
    errorMessage: 'Gemini API retornó 401 - API key inválida',
    feature: 'Generación de Contrarreferencias',
    severity: 'CRITICAL',
    metadata: { model: 'gemini-2.5-flash', statusCode: 401 }
  })
  
  // Manejar error localmente...
}
```

### Usar Métodos Helper

```typescript
// Reportar fallo de API key
await criticalErrorService.reportApiKeyFailure(
  'Gemini API',
  'Generación de Contrarreferencias',
  401
)

// Reportar fallo de correo
await criticalErrorService.reportEmailFailure(
  'usuario@example.com',
  'Soportes de Facturación',
  'Confirmación de Radicación'
)

// Reportar servicio no disponible
await criticalErrorService.reportServiceUnavailable(
  'Gemini API',
  'Contrarreferencias',
  503
)

// Reportar fallo de Storage
await criticalErrorService.reportStorageFailure(
  'upload',
  'Soportes de Facturación',
  'soportes-facturacion'
)

// Reportar error de integración
await criticalErrorService.reportIntegrationError(
  'OneDrive',
  'Soportes de Facturación',
  'Sincronización automática'
)
```

## 📧 Formato del Correo de Notificación

Los correos de alerta incluyen:

### Información Principal
- Severidad del error (CRITICAL/HIGH/MEDIUM)
- Categoría del error
- Módulo/funcionalidad afectada
- Timestamp del incidente

### Detalles Técnicos
- Mensaje de error
- Stack trace (si está disponible)
- Metadata adicional del contexto
- Usuario afectado (si aplica)

### Ejemplo de Subject
```
🚨 Error CRITICAL - 🔑 API_KEY_FAILURE - Generación de Contrarreferencias
```

## 🔧 Configuración

### Variables de Entorno

El sistema usa las mismas credenciales de Gmail configuradas en `.env.local`:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_USER_EMAIL=info@gestarsaludips.com.co
```

### Email de Destino

El correo de destino para alertas críticas está hardcodeado en el API serverless:

```typescript
// api/notify-critical-error.ts
const CRITICAL_ERRORS_EMAIL = 'coordinacionmedica@gestarsaludips.com'
```

Para cambiarlo, editar la constante en `/api/notify-critical-error.ts` línea 222.

## 🛡️ Buenas Prácticas

### ✅ Cuándo Usar el Sistema

- API keys que retornan 401/403
- Servicios externos que retornan 503
- Fallos críticos de Storage (Supabase)
- Errores de autenticación OAuth2
- Fallos en correos importantes (confirmaciones, rechazos)
- Errores en integraciones externas (OneDrive, Airtable)

### ❌ Cuándo NO Usar el Sistema

- Errores de validación de formularios
- Errores de usuario (contraseña incorrecta)
- Errores esperados del flujo de negocio
- Rate limits transitorios (429) que se resuelven con retry
- Errores de red temporales

### 🎯 Principios

1. **No romper la app**: El sistema de notificación NUNCA debe lanzar excepciones que rompan la aplicación
2. **Ser específico**: Incluir metadata útil para debugging
3. **Evitar spam**: Solo notificar errores que requieren intervención técnica
4. **Capturar contexto**: Incluir información del usuario y módulo afectado

## 📈 Monitoreo

### Logs del Sistema

Todos los reportes se registran en la consola:

```
[CRITICAL ERROR SERVICE] ✅ Notificación enviada exitosamente: {
  category: 'EMAIL_FAILURE',
  feature: 'Soportes de Facturación'
}
```

### Verificar Envío

Revisar la bandeja de entrada de **coordinacionmedica@gestarsaludips.com** para confirmar que las alertas llegan correctamente.

## 🧪 Testing

### Prueba Manual

```typescript
// En cualquier componente o servicio
import { criticalErrorService } from '@/services/criticalError.service'

// Ejecutar en consola del navegador
await criticalErrorService.reportCriticalError({
  category: 'UNKNOWN',
  errorMessage: 'Test de notificación - Ignorar',
  feature: 'Testing',
  severity: 'MEDIUM',
  metadata: { test: true }
})
```

Verificar que:
1. Se registra en consola: `[CRITICAL ERROR SERVICE] ✅ Notificación enviada exitosamente`
2. Llega correo a coordinacionmedica@gestarsaludips.com
3. El correo tiene formato correcto y es legible

## 🔄 Integración Actual

### Servicios Integrados

✅ **Email Service** (`email.service.ts`)
- Detecta fallos en envío de correos de confirmación
- Detecta fallos en envío de correos de rechazo
- Detecta fallos en envío de correos de devolución

✅ **Contrarreferencia Service** (`contrarreferenciaService.ts`)
- Detecta API keys inválidas de Gemini (401/403)
- Detecta servicios de Gemini no disponibles (503)

✅ **Soportes Facturación Service** (`soportesFacturacion.service.ts`)
- Detecta fallos en Supabase Storage
- Detecta fallos en sincronización con OneDrive

✅ **OneDrive Upload API** (`api/upload-onedrive.ts`)
- Detecta credenciales de Azure OAuth2 inválidas o expiradas (401/403/400)
- Detecta cuando Microsoft Graph API no está disponible (5xx)
- Notifica fallos al crear carpetas o subir archivos

✅ **Gemini OCR API** (`api/gemini-ocr.ts`)
- Detecta API key de Gemini inválida (401/403)
- Detecta cuando el servicio de Gemini Vision no está disponible (503)

### Próximas Integraciones Recomendadas

- [ ] `auth.service.ts`: Errores de autenticación críticos
- [ ] `back.service.ts`: Fallos en queries críticas
- [ ] `upload-onedrive.ts`: Errores de Azure OAuth2
- [ ] `gemini-ocr.ts`: Fallos en OCR con Google Cloud

## 🆘 Troubleshooting

### El correo no llega

1. Verificar logs en consola del navegador
2. Verificar logs del API serverless en Vercel
3. Revisar spam/promociones de coordinacionmedica@gestarsaludips.com
4. Verificar credenciales de Gmail OAuth2 en `.env.local`

### Error al reportar

Si `criticalErrorService.reportCriticalError` falla:
1. NO rompe la aplicación (try-catch interno)
2. Se registra en consola: `[CRITICAL ERROR SERVICE] Error enviando notificación...`
3. El error original sigue siendo manejado por el servicio que lo llamó

## 📝 Changelog

### v1.0.0 - 2026-01-22

**Características Iniciales:**
- ✅ API serverless de notificación (`/api/notify-critical-error.ts`)
- ✅ Servicio frontend con métodos helper
- ✅ Integración en servicios de email
- ✅ Integración en servicio de contrarreferencias
- ✅ Integración en servicio de soportes de facturación
- ✅ Templates HTML para correos de alerta
- ✅ 8 categorías de errores predefinidas
- ✅ 3 niveles de severidad
- ✅ Captura automática de contexto de usuario

---

**Documentación actualizada:** 2026-01-22  
**Responsable Técnico:** Portal de Colaboradores - Gestar Salud IPS
