/**
 * Componente Header - Diseño Premium
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useRef, useEffect } from 'react'
import { LogOut, Menu, Bell, User, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { ChangePasswordModal } from '@/features/auth'

interface HeaderProps {
    onMenuClick: () => void
    isSidebarOpen: boolean
}

export function Header({ onMenuClick }: HeaderProps) {
    const { user, logout } = useAuth()
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
            <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-white/95 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
                <div className="flex items-center justify-between h-full px-4 lg:px-6">
                    {/* Lado izquierdo: Toggle y Logo */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onMenuClick}
                            className="p-2.5 rounded-xl hover:bg-slate-100 transition-all duration-200 lg:hidden"
                            aria-label="Abrir menú"
                        >
                            <Menu size={22} className="text-slate-600" />
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
                                <p className="text-xs text-slate-400 -mt-0.5">GESTAR SALUD IPS</p>
                            </div>
                        </div>
                    </div>

                    {/* Lado derecho: Notificaciones y Usuario */}
                    <div className="flex items-center gap-3">
                        {/* Notificaciones */}
                        <button className="p-2.5 rounded-xl hover:bg-slate-100 transition-all duration-200 relative">
                            <Bell size={20} className="text-slate-500" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-500 rounded-full" />
                        </button>

                        {/* Separador */}
                        <div className="w-px h-8 bg-slate-200 hidden sm:block" />

                        {/* Usuario Dropdown */}
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-50 transition-all duration-200 border border-transparent hover:border-slate-100"
                            >
                                <div className="hidden sm:block text-right">
                                    <p className="text-sm font-semibold text-slate-700">
                                        {user?.nombreCompleto?.split(' ').slice(0, 2).join(' ') || 'Usuario'}
                                    </p>
                                    <p className="text-xs text-slate-400 capitalize">
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
                                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="px-3 py-2 border-b border-slate-100 sm:hidden">
                                        <p className="text-sm font-semibold text-slate-700">
                                            {user?.nombreCompleto || 'Usuario'}
                                        </p>
                                        <p className="text-xs text-slate-400 capitalize">
                                            {user?.rol || 'Sin rol'}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setShowUserMenu(false)
                                            setShowPasswordModal(true)
                                        }}
                                        className="w-full text-left px-3 py-2.5 text-sm text-slate-600 hover:text-primary-600 hover:bg-primary-50 transition-colors flex items-center gap-2.5"
                                    >
                                        <Lock size={16} />
                                        Cambiar Contraseña
                                    </button>

                                    <div className="h-px bg-slate-100 my-1" />

                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2.5"
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
