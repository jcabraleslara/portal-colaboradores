# Portal de Colaboradores - GESTAR SALUD IPS

Aplicación web interna para gestión de colaboradores con autenticación propia contra PostgreSQL/Supabase.

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build producción
npm run build

# Preview del build
npm run preview
```

## 📋 Requisitos

- Node.js 18+
- npm 9+
- Acceso a instancia Supabase (configurado en .env)

## ⚙️ Configuración

1. Copia `.env.example` a `.env.local`
2. Configura las variables de Supabase y Airtable:

```bash
# Supabase
VITE_SUPABASE_URL=https://tu-instancia-supabase.com
VITE_SUPABASE_ANON_KEY=tu_anon_key

# Airtable (para radicación de casos)
VITE_AIRTABLE_API_KEY=tu_api_key
VITE_AIRTABLE_BASE_ID=appXXXXXX
VITE_AIRTABLE_TABLE_NAME=Solicitudes
```

## 🔐 Autenticación

El sistema usa autenticación propia contra la tabla `usuarios_auth`:

- **Login**: Validación con identificación + contraseña
- **Primer Login**: Forzar cambio de contraseña
- **Rate Limiting**: 5 intentos, bloqueo 15 minutos
- **Sesión**: 30 minutos de inactividad = logout

### Crear Usuario de Prueba

```sql
-- 1. El contacto debe existir primero en la tabla contactos
-- 2. Crear usuario auth (contraseña inicial = identificación)
INSERT INTO usuarios_auth (identificacion, password_hash, rol)
VALUES ('1234567890', 'hash_sha256_de_identificacion', 'operativo');
```

## 📦 Módulos

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| Validación de Derechos | ✅ Activo | Consulta datos de afiliados |
| Radicación de Casos | ✅ Activo | Envía solicitudes a Airtable |
| Soportes Facturación | 🚧 Planeación | - |
| Generar Anexo 8 | 🚧 Planeación | - |
| Triangulaciones | 🚧 Planeación | - |
| Gestión Rutas | 🚧 Planeación | - |
| Demanda Inducida | 🚧 Planeación | - |

## 🛠️ Stack Tecnológico

- **Frontend**: React 19 + TypeScript
- **Build**: Vite 7
- **Estilos**: Tailwind CSS 4
- **Routing**: React Router v7
- **Base de Datos**: Supabase (PostgreSQL)
- **Iconos**: Lucide React
- **Validación**: Zod

## 📁 Estructura del Proyecto

```
src/
├── config/          # Configuración (Supabase, constantes, tema)
├── context/         # Contextos React (AuthContext)
├── components/
│   ├── common/      # Button, Input, Card, LoadingSpinner
│   └── layout/      # Header, Sidebar, MainLayout
├── features/
│   ├── auth/        # Login, ChangePassword
│   ├── dashboard/   # Página principal
│   ├── validacionDerechos/
│   ├── radicacionCasos/
│   └── placeholder/ # Módulos futuros
├── services/        # auth, afiliados, airtable
├── routes/          # AppRoutes con lazy loading
├── types/           # TypeScript definitions
└── utils/           # Helpers y formatters
```

## 🎨 Paleta de Colores

| Color | Hex | Uso |
|-------|-----|-----|
| Primario | `#0095EB` | Botones, links, header |
| Acento | `#F3585D` | Destacar, alertas |
| Éxito | `#85C54C` | Confirmaciones |

## 🔒 Seguridad en Producción

- [ ] Habilitar HTTPS
- [ ] Configurar CORS en Supabase
- [ ] Habilitar RLS en tablas
- [ ] Usar hash bcrypt real (via Edge Function)
- [ ] Configurar CSP headers
- [ ] Deshabilitar source maps

## 📝 Licencia

Uso interno - GESTAR SALUD DE COLOMBIA IPS S.A.S
