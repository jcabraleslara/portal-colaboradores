# Skill: Portal Architecture Reference

Referencia completa de la arquitectura del Portal de Colaboradores de Gestar Salud IPS. Usa esta guía para entender el stack, estructura, build system, patrones de diseño y dependencias del proyecto.

---

## 1. Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React + TypeScript (strict) | 19 + 5.7 |
| Build | Vite | 6 |
| Estilos | Tailwind CSS (class-based dark mode) | 4 |
| Base de datos | PostgreSQL (Supabase) | 17 |
| Edge Functions | Deno | 2 |
| Hosting Frontend | Vercel | - |
| Hosting Backend | Supabase Cloud | - |
| PWA | vite-plugin-pwa + Workbox | 1.2.0 |

---

## 2. Estructura de Carpetas

```
src/
├── config/           # supabase.config, constants, api.config, theme.config
├── context/          # AuthContext (sesión), ThemeContext (dark/light)
├── components/
│   ├── common/       # 18 componentes reutilizables
│   └── layout/       # Header, Sidebar, MainLayout
├── features/         # 18 módulos auto-contenidos
├── services/         # 22 servicios API especializados
├── hooks/            # useInactivityTimeout
├── routes/           # AppRoutes con lazy loading + guards
├── types/            # 9 archivos de tipos TypeScript
└── utils/            # date, device, clipboard, numeroALetras

supabase/
├── functions/        # 17 Edge Functions
│   └── _shared/      # cors, gmail-utils, email-templates, file-naming-utils, critical-error-utils
└── migrations/       # 28+ migraciones SQL
```

---

## 3. Code Splitting (manualChunks en vite.config.ts)

Chunks vendor separados: react, router, supabase, icons, fontkit, pdf-gen, pdfjs, html2pdf, editor (TipTap), markdown, xlsx, utils (clsx+tw-merge), sonner.
Límite de warning: 800KB por chunk.

---

## 4. PWA

- Nombre: "Portal Colaboradores - GESTAR SALUD IPS"
- Íconos: 72x72 a 512x512 + maskable
- Caching: NetworkFirst para Supabase auth, CacheFirst para Google Fonts
- PWAUpdatePrompt: Verifica actualizaciones cada hora

---

## 5. Routing

- `lazyWithRetry()`: Lazy loading con auto-reload si falla carga de chunk (post-deploy)
- Guards: `ProtectedRoute` (auth) → `RoleGuard` (permisos) → `LazyWrapper` (suspense)
- `PublicRoute`: Redirige a dashboard si ya autenticado
- 404 → Dashboard

---

## 6. Integraciones Externas

| Servicio | Uso | Ubicación |
|----------|-----|-----------|
| Supabase | BD + Auth + Storage + Edge Functions | Backend principal |
| Airtable | Radicación casos (legacy) | Frontend service |
| Google Gmail | Envío emails (OAuth2) | Edge Function send-email |
| Google Gemini 2.0 Flash | OCR + contrarreferencia + embeddings | Edge Functions |
| Google Cloud Document AI | OCR (SDK incompatible Deno) | Vercel /api/ocr |
| Azure AD + OneDrive | Archivos billing | Edge Functions |
| LabsMobile | SMS | Edge Function sms |
| Microsoft Teams | Notificaciones devoluciones | Edge Function teams-notify |
| N8N | Sync contactos (webhook) | Frontend fire-and-forget |

---

## 7. Dependencias Producción Clave (35)

- React 19, React Router 7, Supabase JS 2.93
- Lucide React (iconos selectivos), React Icons, Sonner (toasts)
- pdf-lib, pdfjs-dist, html2pdf.js (PDF gen/read)
- TipTap 3 + markdown-it + turndown (rich text)
- xlsx, csv-parse (importación datos)
- Zod 4 (validación schemas)
- @google/generative-ai (Gemini)
- clsx + tailwind-merge (className utils)

---

## 8. Vercel Config

```json
{ "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
]}
```
SPA routing + funciones serverless en /api/* (OCR Document AI, PDF extraction).

---

## 9. Design System

- **Font**: Plus Jakarta Sans (sans), JetBrains Mono (mono)
- **Primary**: #0095EB (Gestar Blue) con escalas 50-900
- **Accent**: #F3585D (Coral)
- **Success**: #85C54C
- **Dark mode**: class-based con CSS variables
- **Tailwind theme**: definido en src/index.css con @theme

---

## 10. Patrones Clave

- **Lazy Loading con Reintento**: `lazyWithRetry()` recarga página si chunk falla post-deploy
- **Fire-and-forget**: SMS, emails, updates secundarios → `.then().catch()` sin await
- **Cache dual**: sessionStorage (rápido, 5min métricas) + localStorage (persistente, 24h perfil)
- **ApiResponse<T>**: Wrapper estándar `{success, data?, error?, message?}`
- **Date handling**: `parseDateLocal()` para evitar offset UTC-5 Colombia
- **Iconos**: Importar específicos de lucide-react, NUNCA `import *`. Agregar al ICON_MAP en Sidebar.tsx
- **Fetch interceptor**: Inyecta JWT backup cuando supabase-js pierde sesión (previene data loss silenciosa)

---

## 11. Agregar Nuevos Módulos - Checklist

1. Crear feature en `src/features/<nombre>/`
2. Agregar a `PORTAL_MODULES` en `config/constants.ts`
3. Importar icono específico en `Sidebar.tsx` y agregar a `ICON_MAP`
4. Agregar ruta lazy en `AppRoutes.tsx` con `lazyWithRetry()`
5. Configurar `requiredRoles` y `showInSidebar`

---

## 12. Información de Producción

- **URL**: https://portal-colaboradores-flax.vercel.app
- **Repo**: https://github.com/jcabraleslara/portal-colaboradores
- **Dominio pendiente**: colaboradores.gestarsaludips.com.co
- **Deploy**: Push a main → Vercel auto-deploy
