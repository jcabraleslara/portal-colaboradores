/**
 * Constantes y utilidades para templates de correo electronico
 * Portal de Colaboradores - Gestar Salud IPS
 *
 * Este archivo centraliza la paleta de colores, URLs, logo y estilos
 * para mantener consistencia visual en todos los correos.
 */

// ==========================================
// LOGO GESTAR SALUD (Base64)
// ==========================================
export const GESTAR_LOGO_BASE64 = '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'

// ==========================================
// PALETA DE COLORES GESTAR SALUD
// ==========================================
export const COLORS = {
    // Primarios (Azul - color principal del logo)
    primary: '#0095EB',
    primaryDark: '#0077BC',
    primaryDarker: '#00598D',
    primaryLight: '#E6F4FD',
    primaryLighter: '#CCE9FB',

    // Acento (Coral/Rojo - corazon del logo)
    accent: '#F3585D',
    accentDark: '#E82D33',
    accentLight: '#FEF0F0',

    // Exito (Verde - ondas del logo)
    success: '#85C54C',
    successDark: '#6BA83B',
    successLight: '#F4FAF0',
    successLighter: '#E9F5E1',

    // Grises y neutros
    slate50: '#F8FAFC',
    slate100: '#F1F5F9',
    slate200: '#E2E8F0',
    slate300: '#CBD5E1',
    slate400: '#94A3B8',
    slate500: '#64748B',
    slate600: '#475569',
    slate700: '#334155',
    slate800: '#1E293B',
    slate900: '#0F172A',

    // Estados
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    error: '#DC2626',
    errorLight: '#FEF2F2',
    info: '#0EA5E9',
    infoLight: '#E0F2FE',
} as const

// ==========================================
// URLs
// ==========================================
export const PORTAL_URL = 'https://colaboradores.gestarsaludips.com.co'
export const LOGO_URL = `${PORTAL_URL}/logo_gestar.png`

// ==========================================
// HELPERS PARA TEMPLATES
// ==========================================

/**
 * Genera el header estandar con logo para correos
 */
export function generarHeaderEmail(
    titulo: string,
    subtitulo?: string,
    colorPrimario: string = COLORS.primary,
    colorSecundario: string = COLORS.primaryDark
): string {
    return `
        <div style="background: linear-gradient(135deg, ${colorPrimario} 0%, ${colorSecundario} 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <img src="${LOGO_URL}" alt="Gestar Salud IPS" style="max-width: 200px; height: auto; margin-bottom: 15px;" />
            <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: white;">${titulo}</h1>
            ${subtitulo ? `<p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; color: white;">${subtitulo}</p>` : ''}
        </div>
    `
}

/**
 * Genera el footer estandar para correos
 */
export function generarFooterEmail(
    mensaje: string = 'Este es un mensaje automatico del Portal de Colaboradores.',
    submensaje: string = 'Gestar Salud IPS - Comprometidos con tu bienestar'
): string {
    return `
        <div style="background-color: ${COLORS.slate800}; color: ${COLORS.slate500}; padding: 25px; text-align: center; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #94A3B8;">
                ${mensaje}
            </p>
            <p style="margin: 0; font-size: 12px; color: ${COLORS.slate500};">
                <strong style="color: ${COLORS.primary};">${submensaje}</strong>
            </p>
        </div>
    `
}

/**
 * Genera un boton CTA (Call to Action) estandar
 */
export function generarBotonCTA(
    texto: string,
    url: string,
    colorPrimario: string = COLORS.primary,
    colorSecundario: string = COLORS.primaryDark
): string {
    const shadowColor = colorPrimario.replace('#', '')
    return `
        <div style="text-align: center; margin: 30px 0;">
            <a href="${url}"
               style="display: inline-block; background: linear-gradient(135deg, ${colorPrimario} 0%, ${colorSecundario} 100%); color: white; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 15px rgba(${parseInt(shadowColor.slice(0, 2), 16)}, ${parseInt(shadowColor.slice(2, 4), 16)}, ${parseInt(shadowColor.slice(4, 6), 16)}, 0.35);">
                ${texto}
            </a>
        </div>
    `
}

/**
 * Genera una caja de alerta/aviso
 */
export function generarAlerta(
    mensaje: string,
    tipo: 'info' | 'warning' | 'error' | 'success' = 'warning'
): string {
    const config = {
        info: { bg: COLORS.infoLight, border: COLORS.primary, text: COLORS.primaryDark },
        warning: { bg: COLORS.warningLight, border: COLORS.warning, text: '#92400E' },
        error: { bg: COLORS.errorLight, border: COLORS.accent, text: '#991B1B' },
        success: { bg: COLORS.successLight, border: COLORS.success, text: COLORS.successDark },
    }
    const { bg, border, text } = config[tipo]

    return `
        <div style="background-color: ${bg}; border: 1px solid ${bg}; border-left: 4px solid ${border}; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0;">
            <p style="margin: 0; color: ${text}; font-size: 14px;">
                ${mensaje}
            </p>
        </div>
    `
}

/**
 * Formatea fecha a formato colombiano
 */
export function formatearFecha(fecha: string | Date): string {
    return new Date(fecha).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
}

/**
 * Formatea fecha y hora a formato colombiano
 */
export function formatearFechaHora(fecha: string | Date): string {
    return new Date(fecha).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}
