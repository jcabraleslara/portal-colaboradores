/**
 * Componente Sidebar - Diseño Premium
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { NavLink } from 'react-router-dom'
import {
    X,
    Sparkles,
    Search,
    ClipboardList,
    ClipboardCheck,
    FileText,
    FileSpreadsheet,
    FileSearch,
    RefreshCw,
    Car,
    BarChart3,
    Circle,
    Contact,
    Users,
    type LucideIcon
} from 'lucide-react'
import { PORTAL_MODULES, ModuleConfig } from '@/config/constants'
import { useAuth } from '@/context/AuthContext'
import BUILD_INFO from '@/version'

// Mapa de iconos específicos (tree-shaking friendly)
const ICON_MAP: Record<string, LucideIcon> = {
    Search,
    ClipboardList,
    ClipboardCheck,
    FileText,
    FileSpreadsheet,
    FileSearch,
    RefreshCw,
    Car,
    BarChart3,
    Contact,
    Users,
    Circle, // Fallback
}

interface SidebarProps {
    isOpen: boolean
    onClose: () => void
}

// Mapeo dinámico de iconos
function getIcon(iconName: string): LucideIcon {
    return ICON_MAP[iconName] || Circle
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { user } = useAuth()

    // Filtrar módulos según rol del usuario
    const visibleModules = PORTAL_MODULES.filter(module => {
        // Si no hay restricción de roles, el módulo es visible para todos
        if (!module.requiredRoles || module.requiredRoles.length === 0) {
            return true
        }
        // Verificar si el rol del usuario está incluido en los roles permitidos
        return module.requiredRoles.includes(user?.rol as string)
    })

    return (
        <>
            {/* Overlay para mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden animate-fade-in"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed top-16 left-0 z-50 h-[calc(100vh-4rem)] w-72 
          bg-white/95 backdrop-blur-xl border-r border-slate-200/50
          transition-transform duration-300 ease-out
          lg:translate-x-0 lg:z-30
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
            >
                {/* Botón cerrar (mobile) */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-xl hover:bg-slate-100 transition-colors lg:hidden"
                    aria-label="Cerrar menú"
                >
                    <X size={20} className="text-slate-400" />
                </button>

                {/* Navegación */}
                <nav className="p-5 pt-8 lg:pt-5 space-y-2" role="navigation">
                    <p className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles size={14} className="text-primary-500" />
                        Módulos
                    </p>

                    <div className="space-y-1">
                        {visibleModules.map((module, index) => (
                            <SidebarItem
                                key={module.id}
                                module={module}
                                onNavigate={onClose}
                                index={index}
                            />
                        ))}
                    </div>
                </nav>

                {/* Footer del sidebar */}
                <div className="absolute bottom-4 left-4 right-4">
                    <div className="p-4 bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-2xl border border-primary-100">
                        <p className="text-[9px] text-primary-400 font-medium mb-1">
                            Creado con 💖 por Jh Cabrales
                        </p>
                        <p className="text-xs font-semibold text-primary-700 mb-0.5">
                            Portal Colaboradores
                        </p>
                        <p className="text-[10px] text-primary-500 mb-0.5">
                            GESTAR SALUD IPS v{BUILD_INFO.version}
                        </p>
                        <p className="text-[9px] text-primary-400 font-mono">
                            {BUILD_INFO.buildDate}
                        </p>
                    </div>
                </div>
            </aside>
        </>
    )
}

// Item de navegación
function SidebarItem({
    module,
    onNavigate,
    index,
}: {
    module: ModuleConfig
    onNavigate: () => void
    index: number
}) {
    const IconComponent = getIcon(module.icon)

    if (!module.enabled) {
        return (
            <div
                className="group flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 cursor-not-allowed opacity-60"
                title={module.description || 'En planeación'}
                style={{ animationDelay: `${index * 50}ms` }}
            >
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <IconComponent size={20} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{module.name}</p>
                    <p className="text-[10px] text-slate-400">Próximamente</p>
                </div>
            </div>
        )
    }

    return (
        <NavLink
            to={module.path}
            onClick={onNavigate}
            style={{ animationDelay: `${index * 50}ms` }}
            className={({ isActive }) =>
                `
          group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
          ${isActive
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
                    : 'text-slate-600 hover:bg-slate-50'
                }
        `
            }
        >
            {({ isActive }) => (
                <>
                    <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200
            ${isActive
                            ? 'bg-white/20'
                            : 'bg-slate-100 group-hover:bg-primary-50 group-hover:text-primary-500'
                        }
          `}>
                        <IconComponent size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{module.name}</p>
                        <p className={`text-[10px] truncate ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                            {module.description}
                        </p>
                    </div>
                </>
            )}
        </NavLink>
    )
}

export default Sidebar
