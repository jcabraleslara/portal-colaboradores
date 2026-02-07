import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
// Configuración del Portal de Colaboradores GESTAR SALUD IPS
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
