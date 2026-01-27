/**
 * Dashboard Principal - Diseño Premium
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Métricas dinámicas enfocadas en pendientes
 * 4 Accesos rápidos fijos (módulos más usados)
 */

import { useNavigate } from 'react-router-dom'
import {
    Search,
    ClipboardList,
    Activity,
    Calendar,
    TrendingUp,
    FileText,
    Phone,
    AlertCircle,
    Loader2
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/config/constants'
import { useEffect } from 'react'
import { useDashboardMetrics } from './hooks/useDashboardMetrics'
import { QuickAccessCard } from './components/QuickAccessCard'

// Configuración de los 4 accesos rápidos fijos (módulos más usados)
const QUICK_ACCESS_MODULES = [
    {
        id: 'validacion-derechos',
        title: 'Validación de Derechos',
        description: 'Consulta el estado y datos completos de afiliados',
        path: ROUTES.VALIDACION_DERECHOS,
        icon: Search,
        colorScheme: 'primary' as const
    },
    {
        id: 'radicacion-casos',
        title: 'Radicación de Casos',
        description: 'Registra solicitudes y casos de afiliados',
        path: ROUTES.RADICACION_CASOS,
        icon: ClipboardList,
        colorScheme: 'accent' as const
    },
    {
        id: 'soportes-facturacion',
        title: 'Soportes Facturación',
        description: 'Radica soportes para facturación de servicios',
        path: ROUTES.SOPORTES_FACTURACION,
        icon: FileText,
        colorScheme: 'success' as const
    },
    {
        id: 'demanda-inducida',
        title: 'Demanda Inducida',
        description: 'Gestión y seguimiento de llamadas a afiliados',
        path: ROUTES.DEMANDA_INDUCIDA,
        icon: Phone,
        colorScheme: 'warning' as const
    }
]

export function DashboardPage() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { metrics, isLoading, error } = useDashboardMetrics()

    // Redireccionar usuarios externos a su único módulo permitido
    useEffect(() => {
        if (user?.rol === 'externo') {
            navigate(ROUTES.RADICACION_CASOS, { replace: true })
        }
    }, [user, navigate])

    const firstName = user?.nombreCompleto?.split(' ')[0] || 'Colaborador'

    // Configuración de las métricas (enfocadas en pendientes)
    const statsConfig = [
        {
            label: 'Casos pendientes',
            value: metrics.casosPendientes,
            icon: ClipboardList,
            color: 'primary',
            showAlert: metrics.casosPendientes > 10
        },
        {
            label: 'Soportes por revisar',
            value: metrics.soportesPorRevisar,
            icon: FileText,
            color: 'accent',
            showAlert: metrics.soportesPorRevisar > 20
        },
        {
            label: 'Llamadas hoy',
            value: metrics.llamadasHoy,
            icon: Phone,
            color: 'success',
            showAlert: false
        },
    ]

    // Filtrar accesos rápidos según el rol del usuario
    const filteredQuickAccess = QUICK_ACCESS_MODULES.filter(module => {
        // Usuarios externos solo ven radicación de casos
        if (user?.rol === 'externo') {
            return module.id === 'radicacion-casos'
        }
        return true
    })

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Hero de bienvenida */}
            <div className="relative overflow-hidden rounded-3xl gradient-primary p-8 lg:p-10">
                {/* Decoraciones de fondo */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-700/30 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 text-white/70 mb-2">
                            <Activity size={18} />
                            <span className="text-sm font-medium">Portal Activo</span>
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
                            ¡Bienvenido, {firstName}!
                        </h1>
                        <p className="text-white/80 text-lg">
                            Accede a las herramientas del Portal de Colaboradores
                        </p>
                    </div>

                    <div className="flex items-center gap-3 text-white/80 text-sm">
                        <Calendar size={18} />
                        <span>{new Date().toLocaleDateString('es-CO', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}</span>
                    </div>
                </div>

                {/* Stats dinámicos (métricas de pendientes) */}
                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                    {statsConfig.map((stat, i) => {
                        const Icon = stat.icon
                        return (
                            <div
                                key={i}
                                className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                        <Icon size={20} className="text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            {isLoading ? (
                                                <Loader2 size={20} className="text-white animate-spin" />
                                            ) : (
                                                <p className="text-2xl font-bold text-white">
                                                    {stat.value}
                                                </p>
                                            )}
                                            {stat.showAlert && !isLoading && (
                                                <AlertCircle size={16} className="text-yellow-300" />
                                            )}
                                        </div>
                                        <p className="text-sm text-white/70">{stat.label}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Indicador de error si las métricas fallan */}
                {error && (
                    <div className="relative z-10 mt-4 bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-red-100 text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {/* Accesos rápidos - 4 módulos más usados */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-800">Accesos Rápidos</h2>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <TrendingUp size={16} className="text-success-500" />
                        <span>Módulos más usados</span>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {filteredQuickAccess.map((module) => (
                        <QuickAccessCard
                            key={module.id}
                            title={module.title}
                            description={module.description}
                            path={module.path}
                            icon={module.icon}
                            colorScheme={module.colorScheme}
                        />
                    ))}
                </div>
            </div>

            {/* Info del usuario */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-success-100 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full bg-success-500 animate-pulse" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-600">
                                Sesión activa: <span className="text-slate-800 font-semibold">{user?.nombreCompleto}</span>
                            </p>
                            <p className="text-xs text-slate-400">
                                Último acceso: {user?.ultimoLogin
                                    ? new Date(user.ultimoLogin).toLocaleString('es-CO', {
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })
                                    : 'Primer acceso'}
                            </p>
                        </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 capitalize">
                        {user?.rol}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default DashboardPage
