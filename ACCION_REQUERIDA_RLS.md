# 🔐 ACCIÓN REQUERIDA: Aplicar RLS en Supabase

## ⚠️ IMPORTANTE - EJECUTAR ESTE SCRIPT SQL

Para completar la implementación de campos editables en el Validador de Derechos, **DEBES ejecutar el siguiente script SQL en Supabase**:

### 📍 Ubicación del Script
```
supabase/rls_bd_update_policy.sql
```

### 📋 Instrucciones Paso a Paso

1. **Abre Supabase Studio**
   - Ve a [tu instancia de Supabase](http://192.168.1.2:8000)
   - Inicia sesión con tus credenciales

2. **Abre el SQL Editor**
   - En el menú lateral, click en **"SQL Editor"**
   - Click en **"New query"**

3. **Copia y Pega el Script**
   - Abre el archivo `supabase/rls_bd_update_policy.sql`
   - Copia **TODO** el contenido del archivo
   - Pega en el SQL Editor

4. **Ejecuta el Script**
   - Click en **"Run"** (o presiona `Ctrl + Enter`)
   - Espera la confirmación de éxito

5. **Verifica la Instalación**
   - Ve a **"Authentication"** → **"Policies"**
   - Selecciona la tabla **"bd"**
   - Deberías ver las políticas:
     - ✅ "Permitir UPDATE a superadmin y admin"
     - ✅ "Permitir SELECT a usuarios autenticados"

### ✅ Verificación Rápida

Para verificar que el RLS funciona correctamente:

1. **Como Superadmin o Admin**:
   - Abre el módulo "Validación de Derechos"
   - Consulta un afiliado
   - Deberías ver un ícono de lápiz (✏️) al pasar el mouse sobre:
     - Dirección
     - Email
     - Observaciones
   - Click en el lápiz, edita, guarda
   - El cambio debe persistir

2. **Como Operativo/Asistencial**:
   - Los mismos campos NO deben tener el ícono de lápiz
   - Todo debe verse en modo solo lectura

### 🚨 Si Algo Sale Mal

#### Error: "permission denied for table bd"
**Causa**: Las políticas RLS no se aplicaron o no están activas.

**Solución**:
1. Ejecuta nuevamente el script SQL
2. Verifica que estés conectado como usuario con permisos de administrador en Supabase
3. Revisa que no haya errores de sintaxis en el script

#### Error: "row-level security policy violated"
**Causa**: El usuario no tiene rol superadmin o admin, o está inactivo.

**Solución**:
1. Ve a Supabase → Table Editor → `usuarios_portal`
2. Busca el usuario por email
3. Verifica que:
   - `rol` = 'superadmin' o 'admin' (exactamente así, en minúsculas)
   - `activo` = true

#### Los cambios no se guardan
**Causa**: Posible problema de red o sesión expirada.

**Solución**:
1. Abre DevTools (F12) → Network
2. Intenta editar un campo
3. Busca la request a Supabase
4. Revisa el status code y el mensaje de error

### 📞 Soporte

Si encuentras algún problema, revisa:
- `docs/validacion-derechos-campos-editables.md` (Documentación completa)
- Logs en la consola del navegador (F12)
- Logs de Supabase en SQL Editor → Query History

---

**Autor**: Antigravity AI  
**Fecha**: 2026-01-27  
**Módulo**: Validación de Derechos - Campos Editables  
**Versión**: 1.0
