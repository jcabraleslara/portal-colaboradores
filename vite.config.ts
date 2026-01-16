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
    chunkSizeWarningLimit: 600, // Aumentar límite a 600KB
    rollupOptions: {
      output: {
        // Code splitting optimizado por chunks
        manualChunks: {
          // Frameworks core
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          // Supabase (librería pesada)
          'vendor-supabase': ['@supabase/supabase-js'],
          // Iconos (muchos componentes)
          'vendor-icons': ['lucide-react'],
          // Utilidades CSS
          'vendor-utils': ['clsx', 'tailwind-merge'],
        },
      },
    },
  },
})
