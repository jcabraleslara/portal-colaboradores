# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos de Desarrollo

```bash
# Desarrollo local (genera version.ts + inicia Vite)
npm run dev

# Build de producción (genera version.ts + TypeScript + Vite build)
npm run build

# Linting
npm run lint

# Preview del build
npm run preview
```

### Supabase CLI

```bash
# Iniciar Supabase local (PostgreSQL 17, puerto 54322)
supabase start

# Ejecutar migraciones
supabase db push

# Desplegar Edge Functions
supabase functions deploy <nombre-funcion>

# Ver logs de funciones
supabase functions logs <nombre-funcion>
```

## Arquitectura del Proyecto

### Stack Principal
- **Frontend**: React 19 + TypeScript 5.7 (modo estricto) + Vite 6
- **Estilos**: Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL 17) + Edge Functions (Deno 2)
- **Hosting**: Vercel

### Estructura de Carpetas

```
src/
├── config/           # Supabase client, constantes, tema
├── context/          # AuthContext (sesión persistente 24h)
├── components/
│   ├── common/       # Button, Input, Card, LoadingSpinner, etc.
│   └── layout/       # Header, Sidebar, MainLayout
├── features/         # Módulos por funcionalidad (auto-contenidos)
│   ├── auth/
│   ├── dashboard/
│   ├── validacionDerechos/
│   ├── gestionBack/
│   ├── anexo8/
│   └── ...
├── services/         # Servicios de API (20 especializados)
├── hooks/            # Custom hooks (useInactivityTimeout)
├── routes/           # AppRoutes con lazy loading y guards
├── types/            # TypeScript definitions
└── utils/            # Helpers y formatters

supabase/
├── functions/        # 10 Edge Functions (Deno)
│   ├── _shared/      # Código compartido
│   ├── create-user/
│   ├── send-email/
│   ├── sms/
│   └── ...
└── migrations/       # SQL migrations
```

### Patrones Clave

**Lazy Loading con Reintento**: Las rutas usan `lazyWithRetry()` que recarga automáticamente cuando falla la carga de chunks (común después de deployments).

**Protección de Rutas**:
- `ProtectedRoute`: Requiere autenticación + timeout de inactividad
- `RoleGuard`: Verifica permisos por rol de usuario
- `PublicRoute`: Redirige a dashboard si ya está autenticado

**Code Splitting**: Chunks manuales en `vite.config.ts`:
- `vendor-react`, `vendor-router`, `vendor-supabase`, `vendor-icons`, `vendor-utils`

**Iconos Optimizados**: Importar iconos específicos de `lucide-react`, NO usar `import * as Icons`. Agregar nuevos iconos al `ICON_MAP` en `src/components/layout/Sidebar.tsx`.

## Integraciones Externas

| Servicio | Propósito | Variables de Entorno |
|----------|-----------|---------------------|
| Supabase | BD + Auth | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Airtable | Radicación de casos | `VITE_AIRTABLE_*` |
| Google Gmail | Emails | `VITE_GOOGLE_*` |
| LabsMobile | SMS | `LABSMOBILE_*` (backend) |
| Azure AD | OneDrive | `AZURE_*` (backend) |
| Google Gemini | OCR/AI | `GEMINI_API_KEY` (backend) |

## Roles de Usuario

```typescript
const USER_ROLES = {
    ADMINISTRADOR: 'administrador',  // Control total
    ASISTENCIAL: 'asistencial',      // Clínico
    OPERATIVO: 'operativo',          // Administrativo
    EXTERNO: 'externo',              // Usuarios externos
}
```

Los permisos de módulos se configuran en `config/constants.ts` → `PORTAL_MODULES`.

## Seguridad

- **Rate Limiting**: 5 intentos de login, bloqueo 15 minutos
- **Timeout de Sesión**: 1 hora de inactividad (configurable en `SESSION_TIMEOUT_MS`)
- **RLS**: Row-Level Security habilitado en Supabase
- **Passwords**: Hash bcrypt via Edge Function `create-user`

## Edge Functions (Supabase)

Las funciones serverless están en `supabase/functions/`. Cada una tiene su propia carpeta con `index.ts` (Deno).

Funciones disponibles:
- `create-user`: Crear usuarios con bcrypt
- `send-email`: Envío de emails (Google Gmail)
- `sms`: Envío de SMS (LabsMobile)
- `upload-onedrive`, `delete-onedrive`: Gestión OneDrive
- `gemini-ocr`: OCR con Google Gemini
- `generate-embedding`: Embeddings para RAG
- `generar-contrarreferencia`: Generación de PDFs clínicos
- `notify-critical-error`: Alertas de errores críticos
- `populate-identificaciones`: Poblar tabla de identificaciones

## Notas Importantes

- Al agregar nuevos módulos, actualizar `PORTAL_MODULES` en `config/constants.ts` y el `ICON_MAP` en `Sidebar.tsx`
- Variables de entorno con prefijo `VITE_` son expuestas al frontend
- Variables sin `VITE_` son solo para Edge Functions (backend)
- Los scripts temporales van en `.temp/` y deben eliminarse después de uso
