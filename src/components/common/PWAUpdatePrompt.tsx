import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Componente que muestra un prompt cuando hay una nueva versión de la PWA disponible.
 * Permite al usuario actualizar o descartar la notificación.
 */
export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Verificar actualizaciones cada hora
      if (registration) {
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.error('Error registrando SW:', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm animate-in slide-in-from-bottom-4">
      <div className="rounded-lg border border-blue-200 bg-white p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
            <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              Nueva versión disponible
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Actualiza para obtener las últimas mejoras.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => updateServiceWorker(true)}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Actualizar
              </button>
              <button
                onClick={() => setNeedRefresh(false)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Después
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
