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
    Route,
    Table,
    ChevronsLeft,
    ChevronsRight,
    type LucideIcon
} from 'lucide-react'

// Icono personalizado de muela con raíces (estilo odontológico)
const ToothIcon = ({ size = 24, className, ...props }: { size?: number | string; className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
    >
        {/* Corona de la muela */}
        <path d="M12 2C8.5 2 5 4.5 5 8c0 2 1 3.5 1 5.5 0 1-.5 2-.5 3.5 0 2 1.5 3 2.5 3s1.5-1 2-3c.3-1.2.5-2 2-2s1.7.8 2 2c.5 2 1 3 2 3s2.5-1 2.5-3c0-1.5-.5-2.5-.5-3.5 0-2 1-3.5 1-5.5 0-3.5-3.5-6-7-6z" />
        {/* Surcos de la corona */}
        <path d="M9 6c0 1.5 1.5 2.5 3 2.5s3-1 3-2.5" />
    </svg>
)
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
    Route,
    Table,
    BarChart3,
    Contact,
    Users,
    Tooth: ToothIcon as unknown as LucideIcon,
    Circle, // Fallback
}

interface SidebarProps {
    isOpen: boolean
    onClose: () => void
    isCollapsed: boolean
    toggleCollapse: () => void
}

// Mapeo dinámico de iconos
function getIcon(iconName: string): LucideIcon {
    return ICON_MAP[iconName] || Circle
}

export function Sidebar({ isOpen, onClose, isCollapsed, toggleCollapse }: SidebarProps) {
    const { user } = useAuth()

    // Filtrar módulos según rol del usuario
    // Filtrar módulos según rol del usuario
    const visibleModules = PORTAL_MODULES.filter(module => {
        // Ocultar si está explícitamente oculto del sidebar
        if (module.showInSidebar === false) return false

        // Ocultar módulos inhabilitados
        if (!module.enabled) return false

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
                    className="fixed inset-0 z-40 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm lg:hidden animate-fade-in"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed top-16 left-0 z-50 h-[calc(100vh-4rem)]
          bg-white/95 dark:bg-black/95 backdrop-blur-xl border-r border-slate-200/50 dark:border-white/10
          transition-[width,transform,background-color] duration-300 ease-out
          lg:translate-x-0 lg:z-30 flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isCollapsed ? 'w-20' : 'w-72'}
        `}
            >
                {/* Botón de colapsar (Desktop) */}
                <button
                    onClick={toggleCollapse}
                    className={`
                        absolute -right-3 top-6
                        bg-white dark:bg-black border border-slate-200 dark:border-white/15 text-slate-400 dark:text-slate-500 hover:text-primary-500
                        p-1 rounded-full shadow-sm dark:shadow-none
                        hidden lg:flex items-center justify-center
                        transition-colors duration-200
                        z-50
                    `}
                    title={isCollapsed ? "Expandir menú" : "Contraer menú"}
                >
                    {isCollapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
                </button>
                {/* Botón cerrar (mobile) */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors lg:hidden z-10"
                    aria-label="Cerrar menú"
                >
                    <X size={20} className="text-slate-400 dark:text-slate-500" />
                </button>

                {/* Navegación Scrollable */}
                <div className="flex-1 overflow-y-auto py-5 lg:pt-5 custom-scrollbar">
                    <nav className="px-5 space-y-2" role="navigation">
                        <p className={`
                            px-3 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2
                            transition-all duration-300
                            ${isCollapsed ? 'justify-center' : ''}
                        `}>
                            <Sparkles size={14} className="text-primary-500" />
                            {!isCollapsed && <span>Módulos</span>}
                        </p>

                        <div className="space-y-1">
                            {visibleModules.map((module, index) => (
                                <SidebarItem
                                    key={module.id}
                                    module={module}
                                    onNavigate={onClose}
                                    index={index}
                                    isCollapsed={isCollapsed}
                                />
                            ))}
                        </div>
                    </nav>
                </div>

                {/* Footer del sidebar (Fijo al fondo) */}
                <div className={`
                    p-4 bg-white/50 dark:bg-black/50 backdrop-blur-sm border-t border-slate-100 dark:border-white/5 overflow-hidden
                    transition-all duration-300
                    ${isCollapsed ? 'p-2' : 'p-4'}
                `}>
                    {!isCollapsed ? (
                        <div className="p-4 bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-800/20 rounded-2xl border border-primary-100 dark:border-primary-800/30 shadow-sm dark:shadow-none">
                            <p className="text-[9px] text-primary-400 font-medium mb-1">
                                Creado con 💖 por Jh Cabrales
                            </p>
                            <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-0.5">
                                Portal Colaboradores
                            </p>
                            <p className="text-[10px] text-primary-500 dark:text-primary-400 mb-0.5">
                                GESTAR SALUD IPS v{BUILD_INFO.version}
                            </p>
                            <p className="text-[9px] text-primary-400 font-mono">
                                {BUILD_INFO.buildDate}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-1 py-2">
                            <span className="text-lg">💖</span>
                            <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400">v{BUILD_INFO.version}</span>
                        </div>
                    )}
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
    isCollapsed
}: {
    module: ModuleConfig
    onNavigate: () => void
    index: number
    isCollapsed: boolean
}) {
    const IconComponent = getIcon(module.icon)

    return (
        <NavLink
            to={module.path}
            onClick={onNavigate}
            style={{ animationDelay: `${index * 50}ms` }}
            className={({ isActive }) =>
                `
          group flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-xl transition-all duration-200
          ${isActive
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
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
                            : 'bg-slate-100 dark:bg-white/10 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 group-hover:text-primary-500'
                        }
          `}>
                        <IconComponent size={20} />
                    </div>
                    <div className={`min-w-0 transition-all duration-300 ${isCollapsed ? 'w-0 overflow-hidden opacity-0 hidden' : 'flex-1 opacity-100'}`}>
                        <p className="text-sm font-semibold truncate">{module.name}</p>
                        <p className={`text-[10px] truncate ${isActive ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
                            {module.description}
                        </p>
                    </div>
                </>
            )}
        </NavLink>
    )
}

export default Sidebar
