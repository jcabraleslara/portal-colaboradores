import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
// Configuración del Portal de Colaboradores GESTAR SALUD IPS
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon_gestar.png', 'logo_gestar.png'],
      manifest: {
        name: 'Portal Colaboradores - GESTAR SALUD IPS',
        short_name: 'Portal Gestar',
        description: 'Portal de Colaboradores - GESTAR SALUD IPS. Acceso a herramientas internas para el equipo de trabajo.',
        theme_color: '#0095EB',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        categories: ['medical', 'business', 'productivity'],
        icons: [
          {
            src: 'icons/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
          },
          {
            src: 'icons/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
          },
          {
            src: 'icons/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png',
          },
          {
            src: 'icons/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
          },
          {
            src: 'icons/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
          },
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/maskable-icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precachear assets estáticos generados por Vite
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // No precachear archivos grandes (PDFs, templates, etc.)
        globIgnores: ['**/templates/**'],
        // Estrategias de cache para recursos en runtime
        runtimeCaching: [
          {
            // Cache para llamadas a Supabase Auth
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-auth',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Cache para fuentes de Google
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true, // Permitir acceso desde red local para testing
  },
  build: {
    sourcemap: false, // Desactivar en producción por seguridad
    chunkSizeWarningLimit: 800, // Vendor chunks grandes (lucide, fontkit) son lazy-loaded y cached
    rollupOptions: {
      output: {
        // Code splitting granular por tipo de librería
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // Frameworks core (react + react-dom + scheduler)
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
            return 'vendor-react'
          }
          if (id.includes('react-router')) return 'vendor-router'

          // Backend
          if (id.includes('@supabase')) return 'vendor-supabase'

          // Iconos
          if (id.includes('lucide-react')) return 'vendor-icons'
          if (id.includes('react-icons')) return 'vendor-react-icons'

          // PDF generación - separar fontkit (pesado) de pdf-lib
          if (id.includes('@pdf-lib/fontkit') || id.includes('fontkit')) return 'vendor-fontkit'
          if (id.includes('pdf-lib')) return 'vendor-pdf-gen'

          // PDF lectura (pdfjs-dist)
          if (id.includes('pdfjs-dist')) return 'vendor-pdfjs'

          // HTML a PDF (html2pdf + html2canvas + jspdf)
          if (id.includes('html2pdf') || id.includes('html2canvas') || id.includes('jspdf')) {
            return 'vendor-html2pdf'
          }

          // Editor de texto enriquecido (TipTap + ProseMirror)
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'vendor-editor'

          // Procesamiento de Markdown
          if (id.includes('markdown-it') || id.includes('turndown')) return 'vendor-markdown'

          // Excel
          if (id.includes('/xlsx')) return 'vendor-xlsx'

          // Utilidades CSS
          if (id.includes('clsx') || id.includes('tailwind-merge')) return 'vendor-utils'

          // Sonner (toasts)
          if (id.includes('sonner')) return 'vendor-sonner'
        },
      },
    },
  },
})
