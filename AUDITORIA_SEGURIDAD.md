# 🔒 AUDITORÍA DE SEGURIDAD: API Keys Expuestas

## 🚨 Resumen Ejecutivo

Se detectaron **3 API keys sensibles** con prefijo `VITE_` que están configuradas para ser expuestas al navegador, aunque algunas no se usan actualmente en el frontend.

---

## ❌ API Keys que DEBEN Rotarse y Migrarse

### 1. 🔴 **VITE_GOOGLE_CLIENT_SECRET** (CRÍTICO - EN USO)

**Ubicación**: `.env.local` línea 27  
**Valor actual**: `[REDACTED]`  
**Usado en**: `src/services/email.service.ts` línea 16  

**Riesgo**: 
- Permite autenticación en nombre de tu cuenta de Gmail
- Si se filtra, alguien podría leer/enviar correos como tu organización

**Acción Requerida**:
1. ✅ Crear endpoint serverless `/api/send-email.ts`
2. ✅ Migrar lógica de `email.service.ts` al backend
3. ✅ Rotar CLIENT_SECRET en Google Cloud Console
4. ✅ Usar nueva secret solo en backend (sin prefijo VITE_)

---

### 2. 🟡 **VITE_AIRTABLE_API_KEY** (MEDIO - EN USO)

**Ubicación**: `.env.local` línea 13  
**Valor actual**: `[REDACTED]`  
**Usado en**: 
- `src/config/constants.ts` línea 81
- `src/services/airtable.service.ts`

**Riesgo**:
- Acceso completo a tus bases de Airtable
- Podría leer/modificar/eliminar datos

**Acción Requerida**:
1. ✅ Crear endpoint serverless `/api/airtable-proxy.ts`
2. ✅ Migrar llamadas de Airtable al backend
3. ✅ Regenerar token en Airtable
4. ✅ Configurar nueva key en Vercel (sin VITE_)

---

### 3. 🟢 **VITE_SUPABASE_SERVICE_ROLE_KEY** (CRÍTICO - NO USADO)

**Ubicación**: `.env.local` línea 6  
**Valor actual**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`  
**Usado en**: ❌ **NO se usa en `/src`** (buena noticia)

**Riesgo**:
- Si se usara, permitiría bypass total de Row Level Security
- Actualmente solo está en `.env.local` pero NO se compila en el bundle

**Acción Requerida**:
1. ✅ Eliminar `VITE_SUPABASE_SERVICE_ROLE_KEY` de `.env.local`
2. ✅ Solo usarla en backend si es necesario (sin VITE_)
3. ✅ Rotar en Supabase Dashboard por precaución

---

### 4. 🟡 **VITE_JOTFORM_API_KEY** (BAJO - NO USADO)

**Ubicación**: `.env.local` línea 20  
**Valor actual**: `[REDACTED]`  
**Usado en**: ❌ **NO se usa en el código**

**Acción Requerida**:
1. ✅ Rotar en JotForm por precaución
2. ✅ Si no se usa, eliminarla de `.env.local`

---

## ➕ API Keys Adicionales

### 5. **VITE_GOOGLE_REFRESH_TOKEN** (línea 28)
- Permite renovar access tokens de Gmail
- Sensible pero menos crítico que el CLIENT_SECRET
- **Acción**: Migrar junto con Google OAuth al backend

### 6. **DB_DSN** (línea 7) - PostgreSQL Connection String
- **NO tiene prefijo VITE_** ✅ (correcto)
- NO se compila en el bundle del frontend
- Si está en `.env.local` solo para referencia, está OK

---

## ✅ API Keys Seguras (Públicas por Diseño)

Estas SÍ pueden estar con prefijo `VITE_`:

- ✅ `VITE_SUPABASE_ANON_KEY` - Diseñada para ser pública
- ✅ `VITE_GOOGLE_CLIENT_ID` - Público por diseño OAuth
- ✅ `VITE_N8N_CONTACTS_WEBHOOK_URL` - Webhook público
- ✅ `VITE_GCP_PROJECT_ID` - ID público
- ✅ `VITE_GCP_LOCATION` - Región pública
- ✅ `VITE_GCP_PROCESSOR_ID` - ID público

---

## 📋 Checklist de Remediación por Prioridad

### 🔴 Prioridad 1 (HACER HOY):

- [ ] **Google OAuth**: Migrar `email.service.ts` a endpoint serverless
- [ ] **Google OAuth**: Rotar CLIENT_SECRET en Google Cloud Console
- [ ] **Supabase**: Eliminar `VITE_SUPABASE_SERVICE_ROLE_KEY` de `.env.local`
- [ ] **Supabase**: Rotar SERVICE_ROLE_KEY en Supabase Dashboard

### 🟡 Prioridad 2 (ESTA SEMANA):

- [ ] **Airtable**: Crear endpoint serverless para proxy
- [ ] **Airtable**: Rotar Personal Access Token
- [ ] **JotForm**: Rotar o eliminar si no se usa

### 🟢 Prioridad 3 (MEJORA):

- [ ] Auditar historial de Git para claves filtradas
- [ ] Implementar pre-commit hooks para detectar secrets
- [ ] Revisar permisos de APIs (principio de mínimo privilegio)

---

## 🛡️ Prevención Futura

### Regla de Oro:
**Si una variable tiene `VITE_` como prefijo, SE COMPILARÁ en el JavaScript del navegador y será pública.**

### Variables Permitidas con VITE_:
- URLs públicas
- IDs de proyecto/cliente (OAuth)
- Configuración no sensible
- Claves ANON específicamente diseñadas para frontend (como Supabase ANON_KEY)

### Variables PROHIBIDAS con VITE_:
- ❌ API Keys de terceros (Airtable, JotForm, Gmail, etc.)
- ❌ Tokens de refresh
- ❌ Client Secrets
- ❌ Service Role Keys
- ❌ Contraseñas o credenciales

---

## 📞 ¿Necesitas Ayuda?

Si quieres que te ayude a:
1. Migrar Google OAuth a serverless
2. Crear proxy de Airtable
3. Rotar las claves en los dashboards

Solo dímelo y te guío paso a paso.

---

**Fecha de Auditoría**: 2026-01-19  
**Auditor**: Antigravity AI  
**Prioridad General**: 🔴 ALTA
