/**
 * Dashboard Principal - Diseño Premium
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { Link, useNavigate } from 'react-router-dom'
import { Search, ClipboardList, ArrowRight, Activity, Users, Calendar, TrendingUp } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/config/constants'
import { useEffect } from 'react'

export function DashboardPage() {
    const { user } = useAuth()
    const navigate = useNavigate()

    // Redireccionar usuarios externos a su único módulo permitido
    useEffect(() => {
        if (user?.rol === 'externo') {
            navigate(ROUTES.RADICACION_CASOS, { replace: true })
        }
    }, [user, navigate])

    const firstName = user?.nombreCompleto?.split(' ')[0] || 'Colaborador'

    // Stats simulados
    const stats = [
        { label: 'Consultas hoy', value: '24', icon: Search, color: 'primary' },
        { label: 'Casos radicados', value: '12', icon: ClipboardList, color: 'accent' },
        { label: 'Afiliados atendidos', value: '156', icon: Users, color: 'success' },
    ]

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

                {/* Stats mini */}
                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                    {stats.map((stat, i) => {
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
                                    <div>
                                        <p className="text-2xl font-bold text-white">{stat.value}</p>
                                        <p className="text-sm text-white/70">{stat.label}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Accesos rápidos */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-800">Accesos Rápidos</h2>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <TrendingUp size={16} className="text-success-500" />
                        <span>Módulos más usados</span>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Validación de Derechos */}
                    <Link to={ROUTES.VALIDACION_DERECHOS} className="group h-full">
                        <div className="relative overflow-hidden bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-300 hover:-translate-y-1 h-full">
                            {/* Decoración */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />

                            <div className="relative z-10 flex items-start gap-4">
                                <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary-500/30 group-hover:scale-110 transition-transform duration-300">
                                    <Search size={26} className="text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg text-slate-800 mb-1 group-hover:text-primary-600 transition-colors">
                                        Validación de Derechos
                                    </h3>
                                    <p className="text-sm text-slate-500 mb-4">
                                        Consulta el estado y datos completos de afiliados
                                    </p>
                                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-500 group-hover:gap-3 transition-all">
                                        Ir al módulo
                                        <ArrowRight size={16} />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Link>

                    {/* Radicación de Casos */}
                    <Link to={ROUTES.RADICACION_CASOS} className="group h-full">
                        <div className="relative overflow-hidden bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-accent-500/10 transition-all duration-300 hover:-translate-y-1 h-full">
                            {/* Decoración */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />

                            <div className="relative z-10 flex items-start gap-4">
                                <div className="w-14 h-14 rounded-2xl gradient-accent flex items-center justify-center shadow-lg shadow-accent-500/30 group-hover:scale-110 transition-transform duration-300">
                                    <ClipboardList size={26} className="text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg text-slate-800 mb-1 group-hover:text-accent-600 transition-colors">
                                        Radicación de Casos
                                    </h3>
                                    <p className="text-sm text-slate-500 mb-4">
                                        Registra solicitudes y casos de afiliados
                                    </p>
                                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-500 group-hover:gap-3 transition-all">
                                        Ir al módulo
                                        <ArrowRight size={16} />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Link>
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
