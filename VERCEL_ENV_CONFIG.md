# 🔧 Configuración de Variables de Entorno en Vercel

## 📋 Variables CRÍTICAS que deben configurarse

Para que la aplicación funcione correctamente en producción (Vercel), es **OBLIGATORIO** configurar las siguientes variables de entorno:

### 1. **GEMINI_API_KEY** (SIN prefijo VITE_) ⚠️

```
GEMINI_API_KEY=AIzaSyDbZ-npH9r21BiJYD28b9VYUODseCf5cCU
```

**Importante:**
- Esta variable **NO** debe tener el prefijo `VITE_` 
- Es utilizada **exclusivamente en el backend** (endpoints serverless en `/api/`)
- **NUNCA** se expone al navegador (seguridad)
- Se usa en:
  - `/api/generate-embedding.ts` (Embeddings)
  - `/api/gemini-ocr.ts` (OCR fallback)
  - `/api/generar-contrarreferencia.ts` (Auditoría IA)

### 2. **Otras Variables Backend (sin VITE_)**

```bash
# LabsMobile SMS
LABSMOBILE_USERNAME=coordinacionmedica@gestarsaludips.com
LABSMOBILE_TOKEN=dxCsG0W0gXGT5D9tVgXMH2cZGWCbQPBU

# Google Cloud (para Document AI - endpoint serverless)
GCP_SERVICE_ACCOUNT_KEY={"type":"service_account",...} # Ver archivo JSON
```

### 3. **Variables Frontend (con VITE_)**

Estas SÍ se pueden incluir con prefijo `VITE_` porque se exponen al navegador:

```bash
# Supabase
VITE_SUPABASE_URL=https://supabase.gestarsaludips.com
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# N8N Webhook
VITE_N8N_CONTACTS_WEBHOOK_URL=https://n8n.gestarsaludips.com/webhook/sync-contactos

# Google Cloud Document AI (IDs públicos)
VITE_GCP_PROJECT_ID=gestar-salud-contactos
VITE_GCP_LOCATION=us
VITE_GCP_PROCESSOR_ID=f59453255feb1e3f
```

---

## 🚀 Cómo Configurar en Vercel

### Opción A: Desde el Dashboard Web

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona el proyecto **"portal-colaboradores"**
3. Ve a **Settings** → **Environment Variables**
4. Agrega cada variable una por una:
   - **Key**: Nombre de la variable (ej: `GEMINI_API_KEY`)
   - **Value**: Valor de la variable
   - **Environment**: Selecciona **Production**, **Preview**, **Development** (según necesites)
5. Haz clic en **Save**

### Opción B: Desde Vercel CLI

```bash
# Instalar Vercel CLI si no la tienes
npm i -g vercel

# Login
vercel login

# Link al proyecto
vercel link

# Agregar variables
vercel env add GEMINI_API_KEY production
# Pega el valor cuando te lo pida

# Verificar variables configuradas
vercel env ls
```

### Opción C: Importar desde archivo `.env`

⚠️ **NO RECOMENDADO** para claves sensibles (mejor agregar manualmente)

```bash
# Solo para development/preview
vercel env pull .env.local
```

---

## 🔄 Después de Configurar

Una vez agregadas las variables, debes:

1. **Re-deployar** la aplicación para que tome las nuevas variables:
   ```bash
   vercel --prod
   ```

   O hacer push a `main`:
   ```bash
   git add .
   git commit -m "Configurar variables de entorno"
   git push
   ```

2. **Verificar** en los logs de Vercel:
   - Ve a **Deployments** → Último deploy → **Function Logs**
   - Busca mensajes como:
     ```
     [API Embedding] ✅ Embedding generado (dimensión: 768)
     ```

---

## ✅ Checklist de Verificación

Marca cuando hayas configurado cada una:

- [ ] `GEMINI_API_KEY` (sin VITE_)
- [ ] `LABSMOBILE_USERNAME`
- [ ] `LABSMOBILE_TOKEN`
- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] `VITE_N8N_CONTACTS_WEBHOOK_URL`
- [ ] `VITE_GCP_PROJECT_ID`
- [ ] `VITE_GCP_LOCATION`
- [ ] `VITE_GCP_PROCESSOR_ID`
- [ ] Re-deploy completado
- [ ] Logs verificados sin errores

---

## 🐛 Troubleshooting

### Error: "GEMINI_API_KEY no configurada"

**Causa:** La variable no está en Vercel o tiene el prefijo `VITE_` (incorrecto)

**Solución:**
1. Verifica que en Vercel esté configurada como `GEMINI_API_KEY` (SIN VITE_)
2. Re-deploya la aplicación

### Error 503 en `/api/generar-contrarreferencia`

**Causa:** Gemini API rechazando la request (cuota excedida, API key inválida, servicio caído)

**Solución:**
1. Verifica que la API key sea válida en [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Revisa límites de cuota en [Google Cloud Console](https://console.cloud.google.com/)

### Error: "VITE_GEMINI_API_KEY no configurada" en frontend

**Causa:** El código del frontend intenta usar directamente la API (ya corregido en este PR)

**Solución:**
- Asegúrate de tener la última versión del código
- Verifica que `embedding.service.ts` y `rag.service.ts` usen los endpoints `/api/*`

---

## 📚 Recursos

- [Vercel Environment Variables Docs](https://vercel.com/docs/projects/environment-variables)
- [Google AI Studio](https://aistudio.google.com/app/apikey)
- [Gemini API Docs](https://ai.google.dev/docs)
