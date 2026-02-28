# Skill: Portal UI Components Reference

Referencia de los 18 componentes reutilizables y componentes de layout del Portal de Colaboradores. Usa esta guía para entender los componentes disponibles, sus props, y cómo crear nuevos.

---

## 1. Design Patterns

- **Controlled components**: value + onChange en todos los inputs
- **forwardRef**: Button, Input para integración con formularios
- **Compound components**: Card (Header/Body/Footer), LoadingSpinner + LoadingOverlay
- **CSS Variables**: `--color-primary`, `--color-success`, `--color-error`
- **className merge**: `twMerge(clsx(...))` para composición de clases
- **Size variants**: sm/md/lg consistente en Button, Input, LoadingSpinner
- **Dark mode**: Prefijo `dark:` en todos los componentes

---

## 2. Common Components

### Button
- **Variants**: primary, secondary, success, danger, ghost, accent
- **Features**: Loading spinner integrado, iconos izq/derecha, fullWidth
- **Sizes**: sm (text-sm, px-3), md (px-4), lg (px-6, text-lg)

### Input
- **Features**: Label con asterisco required, error/helperText con ARIA, iconos, password toggle (Eye/EyeOff)
- **IDs**: Auto-generados únicos para accesibilidad
- **States**: default, error (red border/bg), disabled

### Card (Compound)
- Card + Card.Header (title + action slot) + Card.Body + Card.Footer
- **Props**: padding (none/sm/md/lg), shadow (none/sm/md/lg), hover, onClick

### LoadingSpinner + LoadingOverlay
- Spinner: SVG animado, sizes sm-xl, colores primary/white/gray
- Overlay: absolute inset-0, bg-white/70, backdrop-blur
- FullScreen: fixed inset-0, z-50, bg-white/80

### Alert
- **Tipos**: success, error, warning, info (colores semánticos)
- **Auto-close**: Default 5s, configurable
- **Iconos**: Unicode (checkmark, X, warning, info)

### Badge
- 7 colores (green, blue, purple, amber, red, slate, cyan)
- Inline: px-2 py-0.5, rounded-full, text-xs

### EditableField
- Inline edit toggle, async update callback
- Keyboard: Enter=save, Escape=cancel
- Detección cambios, loading state, hover-revealed edit button

### EditablePhone
- Especializado para teléfonos, integra afiliadosService
- Toast notifications via sonner

### FileUpload
- Drag-and-drop zone con feedback visual
- Validación: PDF only, max 10MB, max 5 files
- File list con tamaño formateado y remove individual

### Autocomplete
- Fuzzy search con normalización acentos
- Keyboard: Arrow Up/Down, Enter, Escape
- Click-outside, max 10 resultados, scroll to highlighted
- Free text opcional

### MultiSelector
- Tags UI con portal dropdown (createPortal, z-[9999])
- Posición dinámica (useLayoutEffect), resize/scroll detection
- Fuzzy search filtering, keyboard support

### RichTextEditor
- TipTap (ProseMirror-based), Markdown ↔ HTML (markdown-it + turndown)
- Toolbar: Bold, Italic, Bullet/Ordered List, H2
- Character count, keyboard shortcuts (Ctrl+B/I)

### Otros
- **MarkdownRenderer**: Render seguro con useMemo + markdown-it
- **SignaturePad**: Canvas con ResizeObserver, touch+mouse, Base64 PNG export
- **PdfViewerModal**: Modal con iframe PDF, detección móvil (new tab), Escape close
- **PWAUpdatePrompt**: Service worker update cada hora, toast-style notification
- **OrdenadorAutocomplete**: Autocomplete específico para ORDENADORES_LISTA (200+ nombres)

---

## 3. Layout Components

### MainLayout
- Root: Header + Sidebar + `<Outlet />`
- Background: Gradient SVG pattern
- Responsive: Sidebar collapsed → main pl-20 | expanded → pl-72

### Header
- Fixed top, h-16, z-40, glassmorphism (bg-white/95 backdrop-blur-xl)
- Left: Menu button (mobile) + Logo + Branding
- Right: Theme toggle (animated switch) + Notifications + User dropdown
- Dropdown: Change password, Admin Users (superadmin), Import Sources, Logout

### Sidebar
- Fixed left, top-16, w-72 (expanded) / w-20 (collapsed)
- Role-based module filtering via PORTAL_MODULES config
- ICON_MAP: Record<string, LucideIcon> con 15+ iconos
- SidebarItem: NavLink con active gradient, animation delay por índice
- Mobile: Overlay z-40, backdrop blur
- Footer: Version info

---

## 4. Dependencias Externas UI

- clsx + tailwind-merge (className utils)
- lucide-react (iconos selectivos - importar específicos, NO `import *`)
- react-icons (FontAwesome en SignaturePad)
- sonner (toasts)
- @tiptap/react + starter-kit (rich text)
- markdown-it + turndown (markdown processing)
