# Guía de Configuración: Sincronización de Contactos con n8n

Esta guía detalla los pasos para activar la sincronización bidireccional entre el Portal de Colaboradores, Google Contacts y Microsoft Outlook.

## 1. Preparación de Base de Datos

Ejecuta el siguiente script SQL en tu base de datos Supabase (puedes usar el Editor SQL del dashboard de Supabase):

```sql
-- Ejecutar contenido de scripts/02_add_sync_fields.sql
-- (El archivo ya ha sido creado en tu repositorio)
```

Esto agregará las columnas `google_contact_id`, `outlook_contact_id`, `sync_status` y `last_synced_at`.

## 2. Configuración de Credenciales OAuth2

### A. Google Cloud (Para jhonlara@gmail.com)
1. Ve a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un nuevo proyecto o selecciona uno existente.
3. Ve a **APIs & Services > Library** y habilita **"Google People API"**.
4. Ve a **APIs & Services > OAuth consent screen**.
   - User Type: External (o Internal si tienes Workspace).
   - Info básica requerida.
5. Ve a **APIs & Services > Credentials** > **Create Credentials** > **OAuth client ID**.
   - Type: **Web application**.
   - Name: `N8N Sync`.
   - Authorized redirect URIs: Copia la URL de callback de tu credencial en n8n (o `https://tu-n8n.com/rest/oauth2-credential/callback`).
6. Copia el **Client ID** y **Client Secret**.

### B. Microsoft Azure (Para coordinacionmedica@gestarsaludips.com)
1. Ve a [Azure Portal > App registrations](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps).
2. **New registration**.
   - Name: `N8N Contact Sync`.
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts".
   - Redirect URI: Web - Copia la URL de callback de n8n.
3. En la app creada, ve a **Certificates & secrets** > **New client secret**. Copia el **Secret Value** (solo se muestra una vez).
4. Ve a **API Permissions** > **Add a permission** > **Microsoft Graph**.
   - Delegated permissions: `Contacts.ReadWrite` (y `User.Read`).
   - Grant admin consent si es necesario.
5. Copia el **Application (client) ID** y **Directory (tenant) ID** desde Overview.

## 3. Configuración en n8n

1. Abre tu instancia de n8n.
2. **Credenciales**:
   - Crea nueva credencial "Google Contacts OAuth2 API". Usa ID/Secret de paso 2A.
   - Crea nueva credencial "Microsoft Outlook OAuth2 API". Usa ID/Secret de paso 2B.
   - Crea nueva credencial "Supabase API" con URL y Service Role Key (para poder escribir libremente).
3. **Importar Workflow**:
   - Crea un nuevo workflow.
   - Ve a menú (...) > Import from File.
   - Selecciona `n8n/workflow_sync_push.json`.
4. **Conectar**:
   - Abre los nodos de Google, Microsoft y Supabase.
   - Selecciona las credenciales que acabas de crear.
   - Activa el Workflow.
5. **Obtener Webhook URL**:
   - Abre el nodo "Webhook".
   - Copia la "Production URL".

## 4. Configurar Webhook en Portal

1. Abre el archivo `.env.local` (o crea uno basado en `.env.example`).
2. Agrega/Edita:
   ```env
   VITE_N8N_CONTACTS_WEBHOOK_URL=https://tu-instancia-n8n.com/webhook/tucodigourl
   ```
3. Reinicia el servidor de desarrollo (`npm run dev`).

## 5. Prueba

1. Ve al "Directorio Institucional".
2. Crea un nuevo contacto "Prueba Sync".
3. Revisa n8n: Deberías ver una ejecución exitosa.
4. Revisa Google Contacts y Outlook: El contacto debe aparecer.
5. Revisa Supabase: El contacto debe tener ahora `google_contact_id` y `outlook_contact_id`.
