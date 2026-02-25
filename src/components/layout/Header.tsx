/**
 * Componente Header - Diseño Premium
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Menu, Bell, User, Lock, UploadCloud, Users, Sun, Moon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { ChangePasswordModal } from '@/features/auth'

interface HeaderProps {
    onMenuClick: () => void
    isSidebarOpen: boolean
}

export function Header({ onMenuClick }: HeaderProps) {
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const { isDark, toggleTheme } = useTheme()
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Cerrar menú al hacer click fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const handleLogout = () => {
        setShowUserMenu(false)
        if (confirm('¿Estás seguro de cerrar sesión?')) {
            logout()
        }
    }

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .slice(0, 2)
            .map(n => n[0])
            .join('')
            .toUpperCase()
    }

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/10 shadow-sm dark:shadow-none transition-colors duration-300">
                <div className="flex items-center justify-between h-full px-4 lg:px-6">
                    {/* Lado izquierdo: Toggle y Logo */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onMenuClick}
                            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-200 lg:hidden"
                            aria-label="Abrir menú"
                        >
                            <Menu size={22} className="text-slate-600 dark:text-slate-300" />
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary-500/20 blur-lg rounded-full" />
                                <img
                                    src="/logo_gestar.png"
                                    alt="GESTAR SALUD IPS"
                                    className="relative h-10 w-auto"
                                />
                            </div>
                            <div className="hidden sm:block">
                                <h1 className="text-lg font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
                                    Portal Colaboradores
                                </h1>
                                <p className="text-xs text-slate-400 dark:text-slate-500 -mt-0.5">GESTAR SALUD IPS</p>
                            </div>
                        </div>
                    </div>

                    {/* Lado derecho: Tema, Notificaciones y Usuario */}
                    <div className="flex items-center gap-3">
                        {/* Toggle Dark Mode */}
                        <button
                            onClick={toggleTheme}
                            className={`
                                relative w-14 h-7 rounded-full transition-all duration-300 flex-shrink-0
                                ${isDark
                                    ? 'bg-primary-600 shadow-lg shadow-primary-500/30'
                                    : 'bg-slate-200'
                                }
                            `}
                            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                            title={isDark ? 'Modo claro' : 'Modo oscuro'}
                        >
                            <div className={`
                                absolute top-0.5 w-6 h-6 rounded-full bg-white dark:bg-black shadow-md
                                flex items-center justify-center
                                transition-all duration-300 ease-out
                                ${isDark ? 'left-[30px]' : 'left-0.5'}
                            `}>
                                <Sun size={13} className={`absolute text-amber-500 transition-all duration-300 ${isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}`} />
                                <Moon size={13} className={`absolute text-primary-400 transition-all duration-300 ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`} />
                            </div>
                        </button>

                        {/* Notificaciones */}
                        <button className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-200 relative">
                            <Bell size={20} className="text-slate-500 dark:text-slate-400" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-500 rounded-full" />
                        </button>

                        {/* Separador */}
                        <div className="w-px h-8 bg-slate-200 dark:bg-white/10 hidden sm:block" />

                        {/* Usuario Dropdown */}
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-200 border border-transparent hover:border-slate-100 dark:hover:border-white/10"
                            >
                                <div className="hidden sm:block text-right">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        {user?.nombreCompleto?.split(' ').slice(0, 2).join(' ') || 'Usuario'}
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">
                                        {user?.rol || 'Sin rol'}
                                    </p>
                                </div>

                                {/* Avatar */}
                                <div className="relative group">
                                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white font-semibold text-sm shadow-lg shadow-primary-500/30">
                                        {user?.nombreCompleto ? getInitials(user.nombreCompleto) : <User size={18} />}
                                    </div>
                                </div>
                            </button>

                            {/* Menú Desplegable */}
                            {showUserMenu && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-black rounded-xl shadow-lg dark:shadow-2xl border border-slate-100 dark:border-white/10 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="px-3 py-2 border-b border-slate-100 dark:border-white/10 sm:hidden">
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                            {user?.nombreCompleto || 'Usuario'}
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">
                                            {user?.rol || 'Sin rol'}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setShowUserMenu(false)
                                            setShowPasswordModal(true)
                                        }}
                                        className="w-full text-left px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors flex items-center gap-2.5"
                                    >
                                        <Lock size={16} />
                                        Cambiar Contraseña
                                    </button>

                                    <div className="h-px bg-slate-100 dark:bg-white/10 my-1" />

                                    {user?.rol === 'superadmin' && (
                                        <button
                                            onClick={() => {
                                                setShowUserMenu(false)
                                                navigate('/admin/usuarios')
                                            }}
                                            className="w-full text-left px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors flex items-center gap-2.5"
                                        >
                                            <Users size={16} />
                                            Administrar Usuarios
                                        </button>
                                    )}

                                    {(user?.rol === 'superadmin' || user?.rol === 'auditor') && (
                                        <button
                                            onClick={() => {
                                                setShowUserMenu(false)
                                                navigate('/importar-fuentes')
                                            }}
                                            className="w-full text-left px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors flex items-center gap-2.5"
                                        >
                                            <UploadCloud size={16} />
                                            Importar Fuentes
                                        </button>
                                    )}

                                    <div className="h-px bg-slate-100 dark:bg-white/10 my-1" />

                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2.5"
                                    >
                                        <LogOut size={16} />
                                        Cerrar Sesión
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Modal de Cambio de Contraseña */}
            {showPasswordModal && user?.identificacion && (
                <ChangePasswordModal
                    identificacion={user.identificacion}
                    isFirstLogin={false}
                    onSuccess={() => {
                        setShowPasswordModal(false)
                        // Aquí podríamos mostrar una notificación toast si existiera el sistema
                        toast.success('¡Tu contraseña ha sido actualizada correctamente!')
                    }}
                    onClose={() => setShowPasswordModal(false)}
                />
            )}
        </>
    )
}

export default Header
