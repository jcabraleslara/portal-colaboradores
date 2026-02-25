/**
 * Aplicación Principal
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { AppRoutes } from '@/routes/AppRoutes'
import { PWAUpdatePrompt } from '@/components/common/PWAUpdatePrompt'
import { Toaster } from 'sonner'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <PWAUpdatePrompt />
        <Toaster
          richColors
          position="top-right"
          expand={true}
          closeButton
          style={{
            fontFamily: 'inherit'
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
