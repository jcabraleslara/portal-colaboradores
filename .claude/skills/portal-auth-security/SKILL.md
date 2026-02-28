---
description: "Sistema de autenticación: sesión JWT, fetch interceptor, AuthContext, guards de ruta, rate limiting, timeout inactividad, password policy, RLS y edge cases"
user-invocable: false
---

# Skill: Portal Auth & Security Reference

Referencia del sistema de autenticación, manejo de sesión, seguridad y guards del Portal de Colaboradores. Usa esta guía para entender o modificar el flujo de auth, sesiones, permisos y protección de rutas.

---

## 1. Arquitectura de Sesión (v6.0)

### Estrategia de Tokens
- JWT: 1 semana de validez
- Refresh proactivo: Cada 2 horas via setInterval
- Backup: localStorage con max age 6 días
- Visibilidad: Refresh al volver a pestaña (si >2h inactivo)

### Flujo Login
```
1. Query usuarios_portal por identificacion → valida: existe, activo, tiene email
2. supabase.auth.signInWithPassword(email, password)
3. Extrae metadata: rol, primerLogin, ultimoLogin
4. Update last_sign_in_at fire-and-forget
5. Return AuthUser → context.login() → cache perfil → navigate /dashboard
```

---

## 2. AuthContext (context/AuthContext.tsx)

**Refs de concurrencia** (previenen race conditions):
- `initializationComplete`: Previene múltiples profile fetches
- `processingAuth`: Guard contra handlers concurrentes
- `backgroundFetchDone`: Single background refresh
- `intentionalLogout`: Distingue logout usuario vs expiración
- `signedOutProcessing`: Previene cascadas SIGNED_OUT

**Cache dual**: sessionStorage (rápido) + localStorage (persistente), max 24h

**Safety timeout**: 10s failsafe → usa cache o fuerza logout limpio

---

## 3. Fetch Interceptor (config/supabase.config.ts v4.0)

**Problema resuelto**: Supabase-js pierde sesión → usa anon key → RLS devuelve arrays vacíos (200 OK, no 401)

**Capa proactiva** (antes del request):
- Detecta si Authorization header tiene anon key
- Reemplaza con backup JWT de localStorage

**Capa reactiva** (después de 401):
- Reintenta con backup JWT
- Segunda oportunidad si token expiró entre check y request

**isJwtValid()**: Parsea payload JWT, verifica exp con 30s+ restante

---

## 4. SIGNED_OUT Handling

- **Intencional**: logout() ya limpió estado → ignorar
- **Accidental**: Verificar backup JWT válido localmente
  - Si válido: IGNORAR SIGNED_OUT (supabase-js perdió sesión internamente)
  - Si inválido: Realmente deslogueado, limpiar estado
- NUNCA llama setSession() (causa cascadas adicionales)

---

## 5. Seguridad

### Rate Limiting
- 5 intentos login → lockout 15 minutos
- UI muestra intentos restantes + countdown
- Supabase Auth: 30 sign-ins/5min

### Timeout Inactividad
- **Duración**: 10 horas (SESSION_TIMEOUT_MS en constants.ts)
- **Warning**: 5 minutos antes (configurable)
- **Eventos tracked**: mousedown, mousemove, keydown, scroll, touchstart, click, focus
- **Hook**: useInactivityTimeout en ProtectedRoute

### Password Policy
- Mínimo 8 caracteres, 1+ mayúscula, 1+ número
- Primer login obligatorio: Modal no cerrable, password temporal = identificación
- Bcrypt via Supabase Auth nativo

### RLS (Row-Level Security)
- Habilitado en todas las tablas
- Fetch interceptor previene data loss silenciosa
- Backup JWT llena gaps cuando sesión se pierde

---

## 6. Guards de Ruta

```
BrowserRouter
 └── ThemeProvider
      └── AuthProvider
           └── AppRoutes
                ├── PublicRoute → /login (redirige a dashboard si autenticado)
                └── ProtectedRoute (requiere auth + inactivityTimeout)
                     └── RoleGuard (verifica user.rol vs requiredRoles)
                          └── LazyWrapper (Suspense con spinner)
                               └── Feature Page
```

### ProtectedRoute
- Verifica isAuthenticated, loading spinner mientras inicializa
- Redirige a /login si no autenticado
- Activa useInactivityTimeout

### RoleGuard
- Verifica user.rol contra moduleConfig.requiredRoles
- Sin requiredRoles → permite a todos los autenticados
- Sin permiso → redirige a Dashboard

### PublicRoute
- Si autenticado → redirige a Dashboard

### Provider Hierarchy (orden crítico)
1. BrowserRouter (habilita useNavigate)
2. ThemeProvider (independiente)
3. AuthProvider (depende de router)
4. Content (depende de ambos contexts)

---

## 7. Edge Cases Manejados

1. **New deployment**: lazyWithRetry recarga página en chunk load failure
2. **Network outage**: Fetch interceptor reintenta con backup JWT
3. **Token expiration**: Refresh proactivo 2h + buffer JWT 1 semana
4. **Tab swap**: Visibility handler refresca token si necesario
5. **Session corruption**: forceCleanSession() factory reset sin loops
6. **Primer login**: Flag primer_login → ChangePasswordModal bloquea navegación
7. **Account lock**: LoginForm deshabilita inputs, muestra countdown
8. **Safari/Mobile cache**: window.location.href = '/login' fuerza full page reload
