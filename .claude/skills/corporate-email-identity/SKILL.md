---
description: "Identidad corporativa para correos electrónicos: paleta de colores, tipografía, emojis HTML entities, estructura base de templates, logo inline CID y checklist para nuevos templates"
user-invocable: false
---

# Identidad Corporativa para Correos - Gestar Salud IPS

## Paleta de Colores Corporativa

Importar siempre desde `supabase/functions/_shared/email-templates.ts`:

```typescript
import { COLORS, EMAIL_FONTS, GESTAR_LOGO_BASE64 } from '../_shared/email-templates.ts'
```

### Colores principales

| Token | Hex | Uso |
|-------|-----|-----|
| `primary` | `#0095EB` | Azul principal del logo |
| `primaryDark` | `#0077BC` | Gradientes, hover |
| `primaryLight` | `#E6F4FD` | Fondos claros azul |
| `accent` | `#F3585D` | Coral/Rojo (corazon del logo) |
| `success` | `#85C54C` | Verde (ondas del logo), estados exito |
| `successDark` | `#6BA83B` | Gradiente verde oscuro |
| `warning` | `#F59E0B` | Naranja, estados advertencia |
| `error` | `#DC2626` | Rojo, estados error/rechazo |
| `slate800` | `#1E293B` | Footer oscuro, texto principal |

### Semaforizacion por tipo de correo

| Tipo | Color Header (gradiente) | HTML Entity Icono |
|------|--------------------------|-------------------|
| Radicacion exitosa | Verde `#85C54C` -> `#6BA83B` | `&#9989;` (check) |
| Rechazo | Rojo `#DC2626` -> `#991B1B` | `&#9888;&#65039;` (warning) |
| Devolucion | Naranja `#F59E0B` -> `#D97706` | `&#9888;&#65039;` (warning) |
| No contactable | Gris `#475569` -> `#334155` | `&#128245;` (phone off) |
| Devolucion recobro | Rojo `#DC2626` -> `#991B1B` | `&#128260;` (cycle) |
| Aprobacion recobro | Azul `#0095EB` -> `#0077BC` | `&#9989;` (check) |
| Enrutado | Azul `#0095EB` -> `#0077BC` | (sin icono) |
| Bienvenida interno | Azul `#0095EB` -> `#0077BC` | (sin icono) |
| Bienvenida externo | Verde `#85C54C` -> `#6BA83B` | (sin icono) |
| Error critico | Dinamico por severidad | Dinamico |

## Tipografia

Estandar para todos los correos:
```
font-family: 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
```

Monospace (codigos, contrasenas):
```
font-family: 'JetBrains Mono', 'Consolas', monospace;
```

## Emojis en Correos

**REGLA CRITICA**: NUNCA usar emojis Unicode directos (ej: `⚠️`, `✅`, `📋`).
SIEMPRE usar HTML entities numericos:

| Visual | Entity | Nombre |
|--------|--------|--------|
| check | `&#9989;` | Check verde |
| warning | `&#9888;&#65039;` | Advertencia |
| clipboard | `&#128203;` | Portapapeles |
| hospital | `&#127973;` | Hospital |
| paperclip | `&#128206;` | Clip |
| hourglass | `&#9203;` | Reloj arena |
| speech | `&#128172;` | Burbuja texto |
| calendar | `&#128197;` | Calendario |
| cycle | `&#128260;` | Flechas ciclo |
| no phone | `&#128245;` | Telefono tachado |
| pin | `&#128205;` | Pin ubicacion |
| search | `&#128269;` | Lupa |
| syringe | `&#128137;` | Jeringa |
| star | `&#11088;` | Estrella |
| book | `&#128214;` | Libro |
| document | `&#128196;` | Documento |
| memo | `&#128221;` | Memo/nota |
| lightning | `&#9889;` | Rayo |
| folder | `&#128194;` | Carpeta |
| chart | `&#128202;` | Grafico barras |
| key | `&#128273;` | Llave |
| email | `&#128231;` | Sobre email |
| globe | `&#127760;` | Globo web |
| disk | `&#128190;` | Disquete |
| cabinet | `&#128452;` | Archivador |
| lock | `&#128274;` | Candado |
| plug | `&#128268;` | Enchufe |
| robot | `&#129302;` | Robot |
| question | `&#10067;` | Interrogacion |
| siren | `&#128680;` | Sirena |
| person | `&#128100;` | Persona |
| copyright | `&#169;` | Copyright |

## Estructura Base de un Correo

Todo correo corporativo debe seguir esta estructura:

```html
<div style="font-family: ${EMAIL_FONTS.primary}; color: ${COLORS.slate800}; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- 1. HEADER: Gradiente + Logo inline -->
    <div style="background: linear-gradient(135deg, {colorPrimario} 0%, {colorSecundario} 100%); padding: 24px 30px; text-align: center;">
        <img src="cid:logo-gestar" alt="Gestar Salud IPS" style="height: 50px; margin-bottom: 12px;" />
        <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">
            {icono_entity} {titulo}
        </h1>
    </div>

    <!-- 2. BODY: Contenido del correo -->
    <div style="padding: 30px; background-color: ${COLORS.slate50};">
        <!-- Contenido especifico del template -->
    </div>

    <!-- 3. FOOTER: Oscuro con copyright -->
    <div style="background-color: #1E293B; padding: 20px 30px; text-align: center;">
        <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
            Este es un mensaje automatico generado por el<br />
            <strong style="color: #E2E8F0;">Portal de Colaboradores de Gestar Salud IPS</strong><br />
            No responda a este correo.
        </p>
        <p style="font-size: 11px; color: #64748B; margin: 12px 0 0 0;">
            &#169; ${new Date().getFullYear()} Gestar Salud de Colombia IPS S.A.S.
        </p>
    </div>
</div>
```

## Logo Inline

El logo SIEMPRE se embebe como imagen inline usando CID (Content-ID):
- En el HTML: `<img src="cid:logo-gestar" ...>`
- En el envio: `inlineImages: [{ cid: 'logo-gestar', content: GESTAR_LOGO_BASE64, mimeType: 'image/png' }]`

NUNCA usar URL publica para el logo en correos enviados por Edge Functions.

## Checklist para Nuevos Templates de Correo

- [ ] Usa `EMAIL_FONTS.primary` como font-family
- [ ] Header con gradiente + logo `cid:logo-gestar`
- [ ] Footer oscuro con copyright dinamico
- [ ] Emojis como HTML entities, no Unicode directo
- [ ] Colores importados de `COLORS` compartido, no hardcodeados
- [ ] Semaforizacion correcta segun tipo de notificacion
- [ ] Logo incluido en `inlineImages` al enviar
