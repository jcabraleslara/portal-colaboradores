/**
 * Aplicación Principal
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'
import { AppRoutes } from '@/routes/AppRoutes'
import { PWAUpdatePrompt } from '@/components/common/PWAUpdatePrompt'
import { ErrorBoundary } from '@/components/common'
import { Toaster } from 'sonner'
import './index.css'

function AppContent() {
  const { isDark } = useTheme()

  return (
    <>
      <AppRoutes />
      <PWAUpdatePrompt />
      <Toaster
        theme={isDark ? 'dark' : 'light'}
        richColors
        position="top-right"
        expand={true}
        closeButton
        style={{
          fontFamily: 'inherit'
        }}
      />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary variant="full" featureName="App">
            <AppContent />
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
