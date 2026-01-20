/**
 * Definición de Rutas
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '@/config/constants'
import { useAuth } from '@/context/AuthContext'
import { useInactivityTimeout } from '@/hooks'
import { MainLayout } from '@/components/layout'
import { LoadingSpinner } from '@/components/common'
import { LoginForm } from '@/features/auth'

// Code splitting - lazy loading de páginas
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const ValidacionDerechosPage = lazy(() => import('@/features/validacionDerechos/ValidacionDerechosPage'))
const RadicacionCasosPage = lazy(() => import('@/features/radicacionCasos/RadicacionCasosPage'))
const GestionBackPage = lazy(() => import('@/features/gestionBack/GestionBackPage'))
const DirectorioPage = lazy(() => import('@/features/directorioInstitucional/DirectorioPage'))
const PlaceholderPage = lazy(() => import('@/features/placeholder/PlaceholderPage'))
const AdminUsuariosPage = lazy(() => import('@/features/admin/AdminUsuariosPage'))
const Anexo8Page = lazy(() => import('@/features/anexo8/Anexo8Page'))
const ConsultarCupsPage = lazy(() => import('@/features/consultarCups/ConsultarCupsPage'))
const SoportesFacturacionPage = lazy(() => import('@/features/soportesFacturacion/SoportesFacturacionPage'))
const GestionDemandaInducidaView = lazy(() => import('@/features/demandaInducida/GestionDemandaInducidaView'))

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
                        <LazyWrapper>
                            <ValidacionDerechosPage />
                        </LazyWrapper>
                    }
                />

                {/* Radicación de Casos */}
                <Route
                    path={ROUTES.RADICACION_CASOS}
                    element={
                        <LazyWrapper>
                            <RadicacionCasosPage />
                        </LazyWrapper>
                    }
                />

                {/* Gestión Back y Auditoría */}
                <Route
                    path={ROUTES.GESTION_BACK}
                    element={
                        <LazyWrapper>
                            <GestionBackPage />
                        </LazyWrapper>
                    }
                />

                {/* Directorio Institucional */}
                <Route
                    path={ROUTES.DIRECTORIO_INSTITUCIONAL}
                    element={
                        <LazyWrapper>
                            <DirectorioPage />
                        </LazyWrapper>
                    }
                />

                {/* Administración de Usuarios (solo superadmin) */}
                <Route
                    path={ROUTES.ADMIN_USUARIOS}
                    element={
                        <LazyWrapper>
                            <AdminUsuariosPage />
                        </LazyWrapper>
                    }
                />

                {/* Soportes de Facturación */}
                <Route
                    path={ROUTES.SOPORTES_FACTURACION}
                    element={
                        <LazyWrapper>
                            <SoportesFacturacionPage />
                        </LazyWrapper>
                    }
                />
                {/* Consultar CUPS */}
                <Route
                    path={ROUTES.CONSULTAR_CUPS}
                    element={
                        <LazyWrapper>
                            <ConsultarCupsPage />
                        </LazyWrapper>
                    }
                />

                <Route
                    path={ROUTES.ANEXO_8}
                    element={
                        <LazyWrapper>
                            <Anexo8Page />
                        </LazyWrapper>
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
                        <LazyWrapper>
                            <GestionDemandaInducidaView />
                        </LazyWrapper>
                    }
                />

                {/* Ruta 404 - redirigir al dashboard */}
                <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
            </Route>
        </Routes>
    )
}

export default AppRoutes
