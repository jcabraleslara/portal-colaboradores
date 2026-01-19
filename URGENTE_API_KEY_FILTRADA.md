# 🚨 URGENTE: API Key Filtrada - Solución

## Problema Detectado

La API Key actual (`AIzaSyDbZ-npH9r21BiJYD28b9VYUODseCf5cCU`) fue **reportada como filtrada** por Google y está **bloqueada permanentemente**.

Error de Google:
```json
{
  "error": {
    "code": 403,
    "message": "Your API key was reported as leaked. Please use another API key.",
    "status": "PERMISSION_DENIED"
  }
}
```

---

## ✅ Solución: Generar Nueva API Key

### Paso 1: Ir a Google AI Studio

1. Abre: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google

### Paso 2: Crear Nueva API Key

1. Haz clic en **"Create API key"**
2. Selecciona tu proyecto de Google Cloud (o crea uno nuevo si no existe)
3. Espera a que se genere
4. **COPIA LA NUEVA API KEY** (empieza con `AIza...`)

⚠️ **IMPORTANTE**: Esta clave aparece solo UNA VEZ. Si no la copias ahora, tendrás que crear otra.

### Paso 3: Configurar en Vercel (CRÍTICO)

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto **portal-colaboradores**
3. Ve a **Settings** → **Environment Variables**
4. Busca `GEMINI_API_KEY` y haz clic en los 3 puntos (`...`) → **Edit**
5. Pega la **NUEVA API KEY**
6. Asegúrate de que esté marcada para **Production, Preview, Development**
7. Haz clic en **Save**

### Paso 4: Actualizar `.env.local` (Solo para desarrollo local)

1. Abre el archivo `.env.local`
2. Reemplaza la línea:
   ```
   VITE_GEMINI_API_KEY=AIzaSyDbZ-npH9r21BiJYD28b9VYUODseCf5cCU
   ```
   Por:
   ```
   VITE_GEMINI_API_KEY=TU_NUEVA_API_KEY_AQUI
   ```

⚠️ **NUNCA hagas commit de `.env.local`** - Ya está en `.gitignore` pero verifica que no lo subas.

### Paso 5: Re-deployar en Vercel

Opción A (Automática):
```bash
git commit --allow-empty -m "Trigger redeploy con nueva API key"
git push
```

Opción B (Manual):
- En el Dashboard de Vercel, ve a **Deployments**
- Haz clic en los 3 puntos del último deploy → **Redeploy**

### Paso 6: Verificar

Después del redeploy (2-3 minutos):
1. Recarga tu aplicación
2. Prueba generar una contrarreferencia
3. Debería funcionar sin error 403

---

## 🔒 Prevención para el Futuro

### ✅ Cosas que SÍ están bien configuradas:

- ✅ `.env.local` está en `.gitignore`
- ✅ `scripts/` está en `.gitignore`
- ✅ La arquitectura serverless protege la API key (no se expone al navegador)

### ⚠️ Cómo evitar futuras filtraciones:

1. **NUNCA** incluyas API keys directamente en el código fuente
2. **Verifica** antes de cada commit que `.env.local` no esté incluido:
   ```bash
   git status
   ```
3. **Si accidentalmente subes una API key**:
   - Revócala inmediatamente en Google AI Studio
   - Genera una nueva
   - Haz un `git rebase` para borrarla del historial (avanzado)

---

## 📋 Checklist de Recuperación

- [ ] Generar nueva API Key en Google AI Studio
- [ ] Actualizar `GEMINI_API_KEY` en Vercel
- [ ] Actualizar `VITE_GEMINI_API_KEY` en `.env.local`
- [ ] Re-deployar aplicación
- [ ] Probar generación de contrarreferencia
- [ ] Verificar que funcione sin error 403
- [ ] Eliminar/revocar la API key antigua en Google AI Studio

---

## 🆘 Si tienes problemas

1. **Verifica** que la nueva API key esté bien copiada (sin espacios extra)
2. **Confirma** que el proyecto de Google Cloud tenga habilitada la Gemini API
3. **Revisa** los logs de Vercel para ver errores específicos

**¡Importante!** La API key filtrada ya no funcionará NUNCA, debes generar una nueva.
