# Sistema de Versionado Automático

Este proyecto utiliza un sistema automático de versionado basado en Git que actualiza la información de versión con cada build y push.

## ¿Cómo funciona?

1. **Generación de Versión**: El archivo `src/version.ts` se genera automáticamente con información del último commit de Git.

2. **Scripts Disponibles**:
   - `npm run version:generate` - Genera manualmente el archivo de versión
   - `npm run dev` - Genera la versión antes de iniciar el servidor de desarrollo
   - `npm run build` - Genera la versión antes de compilar para producción

3. **Git Hooks**: Se instala automáticamente un hook `pre-push` que actualiza la versión antes de cada push.

## Información de Versión

El archivo generado contiene:
- **version**: Versión del proyecto (ej: "1.0")
- **commitHash**: Hash corto del último commit
- **buildDate**: Fecha y hora del build en formato DD/MM/YYYY HH:mm (GMT-5)
- **buildTimestamp**: ISO timestamp del build

## Uso en la Aplicación

```typescript
import BUILD_INFO from '@/version'

// Ejemplo de uso:
console.log(`v${BUILD_INFO.version} - ${BUILD_INFO.buildDate}`)
// Output: v1.0 - 21/01/2026 07:17
```

## Zona Horaria

Todas las fechas se muestran en **GMT-5 (Colombia/Bogotá)**.

## Instalación de Hooks

Los hooks se instalan automáticamente después de `npm install` mediante el script `prepare`.

Para reinstalar manualmente:
```bash
npm run prepare
```

## Archivos Importantes

- `scripts/generate-version.js` - Generador de versión
- `scripts/install-hooks.js` - Instalador de Git hooks
- `scripts/pre-push.js` - Hook pre-push para actualización automática
- `src/version.ts` - Archivo generado (NO EDITAR MANUALMENTE)

## Notas

- El archivo `src/version.ts` **NO debe editarse manualmente**, se regenera automáticamente.
- En entornos sin Git (ej: producción), usa valores por defecto basados en la fecha actual.
