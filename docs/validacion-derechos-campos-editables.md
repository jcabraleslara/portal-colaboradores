# Validación de Derechos - Campos Editables

## Resumen de Cambios

Se implementó la funcionalidad para que los usuarios con rol **superadmin** y **admin** puedan editar los campos del validador de derechos directamente desde la UI, con persistencia en Supabase.

## Cambios Realizados

### 1. Componente EditableField

**Archivo**: `src/components/common/EditableField.tsx`

Nuevo componente genérico para crear campos editables inline:

- **Características**:
  - Edición inline con confirmación/cancelación
  - Soporte para diferentes tipos de input (text, email, date, number)
  - Formateadores personalizados para display
  - Indicadores visuales de estado (loading, error)
  - Atajos de teclado (Enter para guardar, Escape para cancelar)
  - Botón de edición visible al hover

- **Props**:
  - `value`: Valor actual del campo
  - `onUpdate`: Callback async que retorna boolean (éxito/fallo)
  - `placeholder`: Texto cuando el valor está vacío
  - `type`: Tipo de input (text, email, date, number)
  - `disabled`: Deshabilita la edición
  - `displayFormatter`: Función para formatear el valor en modo display

### 2. Servicio de Afiliados

**Archivo**: `src/services/afiliados.service.ts`

Se agregaron los siguientes métodos al servicio:

- `actualizarEmail(tipoId, id, nuevoEmail)`: Actualiza el email del afiliado
- `actualizarDireccion(tipoId, id, nuevaDireccion)`: Actualiza la dirección
- `actualizarObservaciones(tipoId, id, nuevasObservaciones)`: Actualiza las observaciones

**Nota**: El método `actualizarTelefono` ya existía previamente.

Todos los métodos:
- Actualizan la tabla `bd` en Supabase
- Usan claves compuestas (`tipo_id` + `id`) para identificar el registro
- Retornan `ApiResponse<null>` con éxito/fallo
- Manejan errores con logging apropiado

### 3. Página de Validación de Derechos

**Archivo**: `src/features/validacionDerechos/ValidacionDerechosPage.tsx`

**Cambios implementados**:

- **Control de permisos**: Se agregó verificación `canEdit` basada en el rol del usuario
  ```typescript
  const canEdit = user?.rol === 'superadmin' || user?.rol === 'admin'
  ```

- **Campos editables**:
  - ✅ **Dirección**: Editable para superadmin/admin
  - ✅ **Email**: Editable con validación de tipo email
  - ✅ **Teléfono**: Ya era editable (componente `EditablePhone`)
  - ✅ **Observaciones**: Editable con soporte para texto multilínea

- **Handlers de actualización**:
  - `handleDireccionUpdate`
  - `handleEmailUpdate`
  - `handleObservacionesUpdate`
  - Cada handler actualiza el estado local tras éxito en BD

- **UX**:
  - Los usuarios sin permisos ven los campos en modo solo lectura
  - Feedback visual inmediato en caso de error
  - Actualización optimista del estado local

### 4. RLS (Row Level Security) en Supabase

**Archivo**: `supabase/rls_bd_update_policy.sql`

Se crearon las siguientes políticas de seguridad:

#### Política de UPDATE
```sql
CREATE POLICY "Permitir UPDATE a superadmin y admin" 
ON public.bd
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM public.usuarios_portal 
        WHERE email_institucional = auth.jwt() ->> 'email'
        AND rol IN ('superadmin', 'admin')
        AND activo = true
    )
)
```

**Características**:
- Solo permite UPDATE a usuarios autenticados con rol `superadmin` o `admin`
- Verifica que el usuario esté activo
- Usa el email del JWT de Supabase Auth para identificar al usuario
- Se aplica tanto en `USING` como en `WITH CHECK` para máxima seguridad

#### Política de SELECT
```sql
CREATE POLICY "Permitir SELECT a usuarios autenticados" 
ON public.bd
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM public.usuarios_portal 
        WHERE email_institucional = auth.jwt() ->> 'email'
        AND activo = true
    )
)
```

**Características**:
- Permite SELECT a cualquier usuario autenticado y activo
- Necesario para que todos los roles puedan leer la BD de afiliados

## Instrucciones de Instalación

### 1. Código Frontend

Los cambios en el código ya están aplicados. Asegúrate de que no haya errores de compilación:

```bash
npm run dev
```

### 2. Aplicar RLS en Supabase

**IMPORTANTE**: Debes ejecutar el script SQL en Supabase:

1. Abre Supabase Studio
2. Ve a **SQL Editor**
3. Crea una nueva query
4. Copia y pega el contenido de `supabase/rls_bd_update_policy.sql`
5. Ejecuta el script

**Verificación**:
- Ve a **Authentication** → **Policies** → Tabla `bd`
- Deberías ver las políticas:
  - ✅ "Permitir UPDATE a superadmin y admin"
  - ✅ "Permitir SELECT a usuarios autenticados"

## Campos Editables por Rol

| Campo | Superadmin | Admin | Otros Roles |
|-------|------------|-------|-------------|
| Dirección | ✅ Editable | ✅ Editable | ❌ Solo lectura |
| Email | ✅ Editable | ✅ Editable | ❌ Solo lectura |
| Teléfono | ✅ Editable | ✅ Editable | ❌ Solo lectura |
| Observaciones | ✅ Editable | ✅ Editable | ❌ Solo lectura |

## Validaciones

### Frontend
- Validación de tipo email en campo Email
- Prevención de actualización si el valor no cambió
- Indicadores de loading durante la actualización
- Mensajes de error en caso de fallo

### Backend (Supabase)
- RLS verifica permisos antes de permitir UPDATE
- Constraint de unicidad en `tipo_id + id` previene duplicados
- Usuarios inactivos no pueden actualizar datos

## Seguridad

### Arquitectura de Seguridad Multi-Capa

1. **Capa de UI**: 
   - Solo muestra controles de edición si `canEdit === true`
   - Basado en `user.rol` del contexto de autenticación

2. **Capa de Servicio**:
   - Los métodos del servicio usan el cliente de Supabase autenticado
   - El JWT del usuario se envía automáticamente en cada request

3. **Capa de Base de Datos (RLS)**:
   - Última línea de defensa
   - Incluso si alguien bypasea el frontend, RLS bloqueará el UPDATE
   - Verifica rol y estado activo del usuario

### Flujo de Seguridad

```
Usuario intenta editar
    ↓
¿Es superadmin o admin? (Frontend)
    ↓ SÍ
Mostrar botón de edición
    ↓
Usuario hace cambio y guarda
    ↓
Servicio envía UPDATE con JWT
    ↓
¿JWT válido? (Supabase Auth)
    ↓ SÍ
¿Rol = superadmin/admin? (RLS)
    ↓ SÍ
¿Usuario activo? (RLS)
    ↓ SÍ
✅ UPDATE exitoso
```

## Testing

### Casos de Prueba Recomendados

1. **Como Superadmin**:
   - ✅ DEBE poder editar dirección
   - ✅ DEBE poder editar email
   - ✅ DEBE poder editar observaciones
   - ✅ DEBE poder editar teléfono
   - ✅ Los cambios DEBEN persistir en la BD

2. **Como Admin**:
   - ✅ DEBE poder editar dirección
   - ✅ DEBE poder editar email
   - ✅ DEBE poder editar observaciones
   - ✅ DEBE poder editar teléfono
   - ✅ Los cambios DEBEN persistir en la BD

3. **Como Operativo/Asistencial/Externo**:
   - ❌ NO DEBE ver botones de edición
   - ✅ DEBE ver todos los campos en modo solo lectura

4. **Validaciones**:
   - ✅ Email inválido DEBE mostrar error visual
   - ✅ Cancelar edición DEBE restaurar valor original
   - ✅ Enter DEBE guardar cambios
   - ✅ Escape DEBE cancelar edición

5. **Seguridad**:
   - ❌ Intentar UPDATE directo a BD con usuario no autorizado DEBE fallar (RLS)
   - ✅ Token expirado DEBE rechazar UPDATE

## Notas Técnicas

### Actualización Optimista
- El estado local se actualiza inmediatamente tras éxito en BD
- Esto mejora la percepción de velocidad de la aplicación
- Si el UPDATE falla, el campo vuelve al valor anterior

### Performance
- Los UPDATE son individuales (no batch)
- Se usa debounce implícito al requerir confirmación manual (botón ✓)
- No hay polling ni subscripciones en tiempo real

### Extensibilidad
- Para agregar más campos editables:
  1. Crear método `actualizar[Campo]` en el servicio
  2. Crear handler `handle[Campo]Update` en el componente
  3. Reemplazar el `DataItem` value con `<EditableField>`
  4. El RLS ya cubre todos los campos de la tabla `bd`

## Troubleshooting

### "Error al actualizar" en la UI
- Verificar que el usuario tenga rol superadmin o admin
- Verificar en Supabase que las políticas RLS estén activas
- Revisar Network tab para ver error específico de Supabase

### Los cambios no persisten
- Verificar que el método de actualización esté actualizando el estado local
- Verificar en Supabase → Table Editor que el UPDATE se ejecutó

### Usuario admin no puede editar
- Verificar que el email del usuario en `usuarios_portal` coincida con el del JWT
- Verificar que `activo = true` en la tabla `usuarios_portal`
- Verificar que el rol sea exactamente 'admin' (case-sensitive)
