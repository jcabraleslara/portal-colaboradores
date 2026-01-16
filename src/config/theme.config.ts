/**
 * Configuración de tema visual - GESTAR SALUD IPS
 * Paleta de colores extraída del sitio web corporativo
 * Tipografía: Inter
 */

// ========================================
// PALETA DE COLORES CORPORATIVOS
// ========================================
export const COLORS = {
    // Color primario - Azul GESTAR
    primary: {
        DEFAULT: '#0095EB',
        50: '#E6F4FD',
        100: '#CCE9FB',
        200: '#99D3F7',
        300: '#66BDF3',
        400: '#33A7EF',
        500: '#0095EB', // Base
        600: '#0077BC',
        700: '#00598D',
        800: '#003B5E',
        900: '#001D2F',
    },

    // Color de acento - Rosa/Coral (Botón Colaboradores)
    accent: {
        DEFAULT: '#F3585D',
        50: '#FEF0F0',
        100: '#FDE1E2',
        200: '#FBC3C5',
        300: '#F9A5A8',
        400: '#F7878B',
        500: '#F3585D', // Base
        600: '#E82D33',
        700: '#BE1E23',
        800: '#931719',
        900: '#680F11',
    },

    // Color funcional - Verde
    success: {
        DEFAULT: '#85C54C',
        50: '#F4FAF0',
        100: '#E9F5E1',
        200: '#D3EBC3',
        300: '#BDE1A5',
        400: '#A7D787',
        500: '#85C54C', // Base
        600: '#6BA83B',
        700: '#517F2D',
        800: '#37561E',
        900: '#1D2D0F',
    },

    // Navegación - Azul cielo
    navigation: {
        DEFAULT: '#05B0EF',
        light: '#7DD6F7',
        dark: '#0389BA',
    },

    // Fondos y grises
    background: {
        DEFAULT: '#FFFFFF',
        secondary: '#F8FAFC',
        tertiary: '#E3E2E5', // Footer gris
    },

    // Textos
    text: {
        primary: '#1E293B',
        secondary: '#64748B',
        muted: '#94A3B8',
        inverse: '#FFFFFF',
    },

    // Estados
    error: {
        DEFAULT: '#DC2626',
        light: '#FEF2F2',
    },
    warning: {
        DEFAULT: '#F59E0B',
        light: '#FFFBEB',
    },
    info: {
        DEFAULT: '#0EA5E9',
        light: '#F0F9FF',
    },
} as const

// ========================================
// TIPOGRAFÍA
// ========================================
export const TYPOGRAPHY = {
    fontFamily: {
        sans: ['Inter', 'Helvetica Neue', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
    fontSize: {
        xs: '0.75rem',    // 12px
        sm: '0.875rem',   // 14px
        base: '1rem',     // 16px
        lg: '1.125rem',   // 18px
        xl: '1.25rem',    // 20px
        '2xl': '1.5rem',  // 24px
        '3xl': '1.875rem', // 30px
        '4xl': '2.25rem', // 36px
    },
    fontWeight: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
    },
} as const

// ========================================
// ESPACIADO Y BORDES
// ========================================
export const SPACING = {
    borderRadius: {
        none: '0',
        sm: '0.25rem',    // 4px
        DEFAULT: '0.5rem', // 8px
        md: '0.75rem',    // 12px
        lg: '1rem',       // 16px
        xl: '1.5rem',     // 24px
        full: '9999px',
    },
    shadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    },
} as const

// ========================================
// BREAKPOINTS (Mobile First)
// ========================================
export const BREAKPOINTS = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
} as const

// ========================================
// CSS CUSTOM PROPERTIES
// Para usar en Tailwind v4+ sin configuración externa
// ========================================
export const CSS_VARIABLES = `
  :root {
    /* Colores primarios */
    --color-primary: ${COLORS.primary.DEFAULT};
    --color-primary-50: ${COLORS.primary[50]};
    --color-primary-100: ${COLORS.primary[100]};
    --color-primary-200: ${COLORS.primary[200]};
    --color-primary-500: ${COLORS.primary[500]};
    --color-primary-600: ${COLORS.primary[600]};
    --color-primary-700: ${COLORS.primary[700]};
    
    /* Colores de acento */
    --color-accent: ${COLORS.accent.DEFAULT};
    --color-accent-500: ${COLORS.accent[500]};
    --color-accent-600: ${COLORS.accent[600]};
    
    /* Colores de éxito */
    --color-success: ${COLORS.success.DEFAULT};
    --color-success-500: ${COLORS.success[500]};
    
    /* Fondos */
    --color-background: ${COLORS.background.DEFAULT};
    --color-background-secondary: ${COLORS.background.secondary};
    --color-background-tertiary: ${COLORS.background.tertiary};
    
    /* Textos */
    --color-text-primary: ${COLORS.text.primary};
    --color-text-secondary: ${COLORS.text.secondary};
    --color-text-muted: ${COLORS.text.muted};
    
    /* Estados */
    --color-error: ${COLORS.error.DEFAULT};
    --color-warning: ${COLORS.warning.DEFAULT};
    --color-info: ${COLORS.info.DEFAULT};
    
    /* Tipografía */
    --font-sans: ${TYPOGRAPHY.fontFamily.sans.join(', ')};
    
    /* Espaciado */
    --radius-default: ${SPACING.borderRadius.DEFAULT};
    --radius-lg: ${SPACING.borderRadius.lg};
  }
`

export default {
    COLORS,
    TYPOGRAPHY,
    SPACING,
    BREAKPOINTS,
    CSS_VARIABLES,
}
