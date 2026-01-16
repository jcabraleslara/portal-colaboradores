# Notas de Desarrollo - Portal de Colaboradores

## 📌 Recordatorios Importantes

### Iconos (lucide-react)
**Al agregar nuevos módulos con nuevos iconos:**

1. Importar el icono específico en `src/components/layout/Sidebar.tsx`
2. Agregarlo al `ICON_MAP`

```tsx
// Ejemplo: Agregar icono "Calendar" para nuevo módulo
import { 
    // ... iconos existentes
    Calendar,  // ← Agregar aquí
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
    // ... iconos existentes
    Calendar,  // ← Y agregar aquí
}
```

**¿Por qué?** Usamos importaciones específicas en lugar de `import * as Icons` para reducir el bundle. Esto redujo el tamaño de iconos de **780 KB a 15 KB** (-98%).

---

## 🏗️ Arquitectura del Proyecto

### Tecnologías
- **Frontend:** React 19 + TypeScript + Vite
- **Estilos:** TailwindCSS 4
- **Backend:** Supabase (auto-alojado)
- **Hosting:** Vercel

### Estructura de Carpetas
```
src/
├── components/     # Componentes reutilizables
│   ├── common/     # Input, Button, Card, etc.
│   └── layout/     # Header, Sidebar, MainLayout
├── config/         # Constantes, Supabase config
├── context/        # AuthContext
├── features/       # Módulos por funcionalidad
│   ├── auth/
│   ├── dashboard/
│   ├── validacionDerechos/
│   ├── radicacionCasos/
│   └── gestionBack/
├── hooks/          # Custom hooks
├── routes/         # AppRoutes con lazy loading
├── services/       # Servicios de API
└── types/          # TypeScript types
```

### Variables de Entorno Requeridas
```env
VITE_SUPABASE_URL=https://tu-instancia.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

---

## 🚀 Despliegue

### URLs
- **Producción:** https://portal-colaboradores-flax.vercel.app
- **Dominio personalizado (pendiente):** colaboradores.gestarsaludips.com.co
- **Repositorio:** https://github.com/jcabraleslara/portal-colaboradores

### Comandos útiles
```bash
# Desarrollo local
npm run dev

# Build de producción
npm run build

# Subir cambios a producción
git add . && git commit -m "descripción" && git push
```

---

## 📅 Historial de Optimizaciones

| Fecha | Cambio | Impacto |
|-------|--------|---------|
| 2026-01-16 | Importaciones específicas de iconos | -98% en vendor-icons |
| 2026-01-16 | Code splitting con manualChunks | -74% en bundle principal |
| 2026-01-16 | Lazy loading de rutas | Carga inicial más rápida |

---

*Última actualización: 2026-01-16*
