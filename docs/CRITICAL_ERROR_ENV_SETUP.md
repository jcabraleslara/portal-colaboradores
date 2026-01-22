# Variables de Entorno Requeridas para Sistema de Notificación de Errores Críticos

## 📋 Resumen

El sistema de notificación de errores críticos reutiliza las credenciales de Gmail OAuth2 
que ya están configuradas en el proyecto. **No se requieren nuevas variables de entorno**.

## ✅ Variables Existentes Utilizadas

Las siguientes variables ya están configuradas en `.env.local` y son utilizadas por el sistema:

```bash
# Gmail OAuth2 (Backend - API Serverless)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_USER_EMAIL=info@gestarsaludips.com.co
```

## 📧 Configuración del Destinatario

El correo de destino para alertas críticas está **hardcodeado** en el API serverless por seguridad:

```typescript
// /api/notify-critical-error.ts - Línea 222
const CRITICAL_ERRORS_EMAIL = 'coordinacionmedica@gestarsaludips.com'
```

### Cambiar el Destinatario

Si necesitas cambiar el email de destino:

1. Editar `/api/notify-critical-error.ts`
2. Buscar la línea 222:
```typescript
const CRITICAL_ERRORS_EMAIL = 'coordinacionmedica@gestarsaludips.com'
```
3. Reemplazar con el nuevo email:
```typescript
const CRITICAL_ERRORS_EMAIL = 'nuevo-email@gestarsaludips.com'
```
4. Hacer commit y deployar

## 🔐 Seguridad

### ¿Por qué hardcodear el email?

1. **Seguridad**: Evita que se pueda cambiar el destinatario vía variables de entorno
2. **Confiabilidad**: Garantiza que las alertas siempre lleguen al destinatario correcto
3. **Simplicidad**: No requiere configuración adicional en cada ambiente

### ¿Por qué no usar variables de entorno para el destinatario?

Si el destinatario estuviera en `.env`, un atacante que compromet las variables de entorno podría:
- Redirigir alertas críticas a su propio correo
- Silenciar alertas cambiando a un email inválido
- Filtrar información sensible del sistema

## ✨ Verificación de Configuración

### 1. Verificar que Gmail OAuth2 esté configurado

```bash
# Verificar que existan las variables
grep "GOOGLE_" .env.local
```

Debe mostrar:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_USER_EMAIL=info@gestarsaludips.com.co
```

### 2. Probar el sistema

```bash
# Ejecutar script de prueba
npx tsx scripts/test-critical-error-notification.ts
```

### 3. Verificar correo

Revisar que el correo de prueba llegó a `coordinacionmedica@gestarsaludips.com`

## 🚨 Troubleshooting

### El correo no llega

#### Opción 1: Verificar credenciales de Gmail

```bash
# Ver si las variables están definidas
echo $GOOGLE_CLIENT_ID
echo $GOOGLE_REFRESH_TOKEN
```

#### Opción 2: Verificar logs del API serverless

En Vercel Dashboard:
1. Ir a Functions
2. Buscar `/api/notify-critical-error`
3. Ver logs de ejecución

#### Opción 3: Verificar que el refresh token sigue válido

Los refresh tokens de Google pueden expirar si:
- No se usan por 6 meses
- El usuario revoca el acceso
- Se cambia la contraseña de la cuenta de Google

**Solución:** Regenerar el refresh token siguiendo la guía de OAuth2 de Gmail.

### El sistema reporta "Faltan credenciales"

```
Error: Faltan credenciales de Google OAuth2 en variables de entorno
```

**Solución:**
1. Verificar que `.env.local` tiene las variables `GOOGLE_*`
2. Si estás en producción (Vercel), verificar que las Environment Variables estén configuradas
3. Las variables en Vercel NO deben tener el prefijo `VITE_`

### El correo va a spam

**Solución:**
1. Añadir `info@gestarsaludips.com.co` a contactos seguros
2. Marcar un correo de prueba como "No es spam"
3. Crear regla de filtro para mover correos a bandeja principal

## 📝 Checklist de Deployment

Antes de deployar a producción:

- [ ] Variables `GOOGLE_*` configuradas en Vercel
- [ ] Verificar que `GOOGLE_USER_EMAIL` es correcto
- [ ] Probar envío en ambiente de staging
- [ ] Verificar que el correo llega a `coordinacionmedica@gestarsaludips.com`
- [ ] Verificar que el formato del correo es correcto
- [ ] Añadir email a contactos seguros para evitar spam
- [ ] Documentar en onboarding de nuevos devs

## 🔄 Ambientes

### Development
- ✅ Variables en `.env.local`
- ✅ Correos se envían normalmente

### Staging
- ✅ Variables en Vercel Environment Variables (Preview)
- ✅ Correos se envían normalmente

### Production
- ✅ Variables en Vercel Environment Variables (Production)
- ✅ Correos se envían normalmente

## ⚙️ Configuración en Vercel

Si despliegas en Vercel, asegúrate de configurar estas variables de entorno:

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Añade las siguientes variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `GOOGLE_CLIENT_ID` | `[tu-client-id]` | Production, Preview, Development |
| `GOOGLE_CLIENT_SECRET` | `[tu-client-secret]` | Production, Preview, Development |
| `GOOGLE_REFRESH_TOKEN` | `[tu-refresh-token]` | Production, Preview, Development |
| `GOOGLE_USER_EMAIL` | `info@gestarsaludips.com.co` | Production, Preview, Development |

**IMPORTANTE:** Las variables en las APIs serverless NO llevan el prefijo `VITE_`

---

**Última actualización:** 2026-01-22  
**Documentación relacionada:** `/docs/CRITICAL_ERROR_NOTIFICATIONS.md`
