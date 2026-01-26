/**
 * Definición de Rutas
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES, PORTAL_MODULES } from '@/config/constants'
import { useAuth } from '@/context/AuthContext'
import { useInactivityTimeout } from '@/hooks'
import { MainLayout } from '@/components/layout'
import { LoadingSpinner } from '@/components/common'
import { LoginForm } from '@/features/auth'

// Helper para lazy loading con reintento automático en fallos de descarga de chunks
// Esto ocurre comúnmente cuando se despliega una nueva versión y los hashes antiguos ya no existen
const lazyWithRetry = (componentImport: () => Promise<any>) =>
    lazy(async () => {
        const pageHasAlreadyBeenForceRefreshed = JSON.parse(
            window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
        )

        try {
            const component = await componentImport()
            window.sessionStorage.setItem('page-has-been-force-refreshed', 'false')
            return component
        } catch (error) {
            if (!pageHasAlreadyBeenForceRefreshed) {
                // El error suele ser "Failed to fetch dynamically imported module"
                console.warn('Fallo en la carga del módulo (posible despliegue nuevo). Reintentando...', error)
                window.sessionStorage.setItem('page-has-been-force-refreshed', 'true')
                return window.location.reload()
            }

            // Si ya refrescamos y sigue fallando, es un error fatal de red/servidor
            console.error('Error crítico al cargar módulo después de refrescar:', error)
            throw error
        }
    })

// Code splitting - lazy loading de páginas con reintento
const DashboardPage = lazyWithRetry(() => import('@/features/dashboard/DashboardPage'))
const ValidacionDerechosPage = lazyWithRetry(() => import('@/features/validacionDerechos/ValidacionDerechosPage'))
const RadicacionCasosPage = lazyWithRetry(() => import('@/features/radicacionCasos/RadicacionCasosPage'))
const GestionBackPage = lazyWithRetry(() => import('@/features/gestionBack/GestionBackPage'))
const DirectorioPage = lazyWithRetry(() => import('@/features/directorioInstitucional/DirectorioPage'))
const PlaceholderPage = lazyWithRetry(() => import('@/features/placeholder/PlaceholderPage'))
const AdminUsuariosPage = lazyWithRetry(() => import('@/features/admin/AdminUsuariosPage'))
const Anexo8Page = lazyWithRetry(() => import('@/features/anexo8/Anexo8Page'))
const ConsultarCupsPage = lazyWithRetry(() => import('@/features/consultarCups/ConsultarCupsPage'))
const SoportesFacturacionPage = lazyWithRetry(() => import('@/features/soportesFacturacion/SoportesFacturacionPage'))
const GestionDemandaInducidaView = lazyWithRetry(() => import('@/features/demandaInducida/GestionDemandaInducidaView'))

/**
 * Componente de protección de rutas
 * Incluye timeout de inactividad para cerrar sesión automáticamente
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth()

    // Activar timeout de inactividad (configurable en constants.ts -> SESSION_TIMEOUT_MS)
    // Muestra advertencia 1 minuto antes de cerrar sesión
    useInactivityTimeout({
        enabled: isAuthenticated,
        warningTimeMs: 60000, // 1 minuto de advertencia
    })

    if (isLoading) {
        return <LoadingSpinner fullScreen label="Cargando sesión..." />
    }

    if (!isAuthenticated) {
        return <Navigate to={ROUTES.LOGIN} replace />
    }

    return <>{children}</>
}

/**
 * Componente de protección basada en roles
 * Verifica si el usuario tiene permiso para acceder al módulo
 */
function RoleGuard({ moduleId, children }: { moduleId: string, children: React.ReactNode }) {
    const { user } = useAuth()

    const moduleConfig = PORTAL_MODULES.find(m => m.id === moduleId)

    // Si el módulo no existe o no tiene roles requeridos, permitir acceso
    if (!moduleConfig?.requiredRoles || moduleConfig.requiredRoles.length === 0) {
        return <>{children}</>
    }

    // Verificar si el usuario tiene el rol requerido
    if (user && moduleConfig.requiredRoles.includes(user.rol)) {
        return <>{children}</>
    }

    // Si no tiene permiso, redirigir
    // Si es externo intentando acceder a algo no permitido, el DashboardPage lo redirigirá a Radicación
    return <Navigate to={ROUTES.DASHBOARD} replace />
}

/**
 * Componente de ruta pública (redirige si ya está autenticado)
 */
function PublicRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth()

    if (isLoading) {
        return <LoadingSpinner fullScreen label="Verificando sesión..." />
    }

    if (isAuthenticated) {
        return <Navigate to={ROUTES.DASHBOARD} replace />
    }

    return <>{children}</>
}

/**
 * Wrapper de suspense para lazy loading
 */
function LazyWrapper({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<LoadingSpinner fullScreen label="Cargando módulo..." />}>
            {children}
        </Suspense>
    )
}

/**
 * Componente principal de rutas
 */
export function AppRoutes() {
    return (
        <Routes>
            {/* Ruta de login - pública */}
            <Route
                path={ROUTES.LOGIN}
                element={
                    <PublicRoute>
                        <LoginForm />
                    </PublicRoute>
                }
            />

            {/* Rutas protegidas con layout */}
            <Route
                element={
                    <ProtectedRoute>
                        <MainLayout />
                    </ProtectedRoute>
                }
            >
                {/* Dashboard */}
                <Route
                    path={ROUTES.DASHBOARD}
                    element={
                        <LazyWrapper>
                            <DashboardPage />
                        </LazyWrapper>
                    }
                />

                {/* Validación de Derechos */}
                <Route
                    path={ROUTES.VALIDACION_DERECHOS}
                    element={
                        <RoleGuard moduleId="validacion-derechos">
                            <LazyWrapper>
                                <ValidacionDerechosPage />
                            </LazyWrapper>
                        </RoleGuard>
                    }
                />

                {/* Radicación de Casos */}
                <Route
                    path={ROUTES.RADICACION_CASOS}
                    element={
                        <RoleGuard moduleId="radicacion-casos">
                            <LazyWrapper>
                                <RadicacionCasosPage />
                            </LazyWrapper>
                        </RoleGuard>
                    }
                />

                {/* Gestión Back y Auditoría */}
                <Route
                    path={ROUTES.GESTION_BACK}
                    element={
                        <RoleGuard moduleId="gestion-back">
                            <LazyWrapper>
                                <GestionBackPage />
                            </LazyWrapper>
                        </RoleGuard>
                    }
                />

                {/* Directorio Institucional */}
                <Route
                    path={ROUTES.DIRECTORIO_INSTITUCIONAL}
                    element={
                        <RoleGuard moduleId="directorio-institucional">
                            <LazyWrapper>
                                <DirectorioPage />
                            </LazyWrapper>
                        </RoleGuard>
                    }
                />

                {/* Administración de Usuarios (solo superadmin) */}
                <Route
                    path={ROUTES.ADMIN_USUARIOS}
                    element={
                        <RoleGuard moduleId="admin-usuarios">
                            <LazyWrapper>
                                <AdminUsuariosPage />
                            </LazyWrapper>
                        </RoleGuard>
                    }
                />

                {/* Soportes de Facturación */}
                <Route
                    path={ROUTES.SOPORTES_FACTURACION}
                    element={
                        <RoleGuard moduleId="soportes-facturacion">
                            <LazyWrapper>
                                <SoportesFacturacionPage />
                            </LazyWrapper>
                        </RoleGuard>
                    }
                />
                {/* Consultar CUPS */}
                <Route
                    path={ROUTES.CONSULTAR_CUPS}
                    element={
                        <RoleGuard moduleId="consultar-cups">
                            <LazyWrapper>
                                <ConsultarCupsPage />
                            </LazyWrapper>
                        </RoleGuard>
                    }
                />

                <Route
                    path={ROUTES.ANEXO_8}
                    element={
                        <RoleGuard moduleId="anexo-8">
                            <LazyWrapper>
                                <Anexo8Page />
                            </LazyWrapper>
                        </RoleGuard>
                    }
                />
                <Route
                    path={ROUTES.TRIANGULACIONES}
                    element={
                        <LazyWrapper>
                            <PlaceholderPage moduleName="Gestión de Triangulaciones" />
                        </LazyWrapper>
                    }
                />
                <Route
                    path={ROUTES.RUTAS}
                    element={
                        <LazyWrapper>
                            <PlaceholderPage moduleName="Gestión de Rutas" />
                        </LazyWrapper>
                    }
                />
                <Route
                    path={ROUTES.DEMANDA_INDUCIDA}
                    element={
                        <RoleGuard moduleId="demanda-inducida">
                            <LazyWrapper>
                                <GestionDemandaInducidaView />
                            </LazyWrapper>
                        </RoleGuard>
                    }
                />

                {/* Ruta 404 - redirigir al dashboard */}
                <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
            </Route>
        </Routes>
    )
}

export default AppRoutes
