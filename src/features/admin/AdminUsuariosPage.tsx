/**
 * Página de Administración de Usuarios
 * Solo accesible para superadmin
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useEffect, useCallback } from 'react'
import {
    Users, UserPlus, Search, Shield, ShieldCheck, ShieldX,
    ToggleLeft, ToggleRight, Trash2, RefreshCw, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { usuariosPortalService, UsuarioPortal } from '@/services/usuariosPortal.service'
import CreateUserModal from './components/CreateUserModal'

// Constantes de roles para display
const ROL_LABELS: Record<string, { label: string; color: string; icon: typeof Shield }> = {
    operativo: { label: 'Operativo', color: 'bg-blue-100 text-blue-800', icon: Shield },
    admin: { label: 'Admin', color: 'bg-purple-100 text-purple-800', icon: ShieldCheck },
    superadmin: { label: 'Super Admin', color: 'bg-red-100 text-red-800', icon: ShieldX },
    gerencia: { label: 'Gerencia', color: 'bg-slate-100 text-slate-800', icon: ShieldCheck },
    auditor: { label: 'Auditor', color: 'bg-orange-100 text-orange-800', icon: ShieldCheck },
    asistencial: { label: 'Asistencial', color: 'bg-green-100 text-green-800', icon: ShieldCheck },
    externo: { label: 'Externo', color: 'bg-gray-100 text-gray-800', icon: Shield }
}

export default function AdminUsuariosPage() {
    const { user } = useAuth()
    const [usuarios, setUsuarios] = useState<UsuarioPortal[]>([])
    const [filteredUsuarios, setFilteredUsuarios] = useState<UsuarioPortal[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterRol, setFilterRol] = useState<string>('all')
    const [filterActivo, setFilterActivo] = useState<string>('all')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Cargar usuarios
    const loadUsuarios = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        const { data, error: err } = await usuariosPortalService.getAll()
        if (err) {
            setError(err)
        } else {
            setUsuarios(data || [])
        }
        setIsLoading(false)
    }, [])

    useEffect(() => {
        loadUsuarios()
    }, [loadUsuarios])

    // Filtrar usuarios
    useEffect(() => {
        let filtered = [...usuarios]

        // Filtro por búsqueda
        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            filtered = filtered.filter(u =>
                u.nombre_completo.toLowerCase().includes(term) ||
                u.identificacion.toLowerCase().includes(term) ||
                u.email_institucional.toLowerCase().includes(term)
            )
        }

        // Filtro por rol
        if (filterRol !== 'all') {
            filtered = filtered.filter(u => u.rol === filterRol)
        }

        // Filtro por estado activo
        if (filterActivo !== 'all') {
            filtered = filtered.filter(u => u.activo === (filterActivo === 'active'))
        }

        setFilteredUsuarios(filtered)
    }, [usuarios, searchTerm, filterRol, filterActivo])

    // Verificar acceso (rol como string para compatibilidad)
    if ((user?.rol as string) !== 'superadmin') {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center p-8 bg-red-50 rounded-xl">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-red-800">Acceso Denegado</h2>
                    <p className="text-red-600">Solo superadmin puede acceder a esta sección.</p>
                </div>
            </div>
        )
    }

    // Toggle estado activo
    const handleToggleActive = async (usuario: UsuarioPortal) => {
        setActionLoading(usuario.id)
        const { success, error: err } = await usuariosPortalService.toggleActive(usuario.id, !usuario.activo)
        if (success) {
            setUsuarios(prev => prev.map(u =>
                u.id === usuario.id ? { ...u, activo: !u.activo } : u
            ))
        } else {
            toast.error(`Error: ${err}`)
        }
        setActionLoading(null)
    }

    // Cambiar rol
    const handleChangeRole = async (usuario: UsuarioPortal, newRol: 'operativo' | 'admin' | 'superadmin') => {
        if (newRol === usuario.rol) return
        setActionLoading(usuario.id)
        const { success, error: err } = await usuariosPortalService.changeRole(usuario.id, newRol)
        if (success) {
            setUsuarios(prev => prev.map(u =>
                u.id === usuario.id ? { ...u, rol: newRol } : u
            ))
        } else {
            toast.error(`Error: ${err}`)
        }
        setActionLoading(null)
    }

    // Eliminar usuario
    const handleDelete = async (usuario: UsuarioPortal) => {
        if (!confirm(`¿Estás seguro de eliminar a ${usuario.nombre_completo}? Esta acción no se puede deshacer.`)) {
            return
        }
        setActionLoading(usuario.id)
        const { success, error: err } = await usuariosPortalService.delete(usuario.id)
        if (success) {
            setUsuarios(prev => prev.filter(u => u.id !== usuario.id))
        } else {
            toast.error(`Error: ${err}`)
        }
        setActionLoading(null)
    }

    // Usuario creado exitosamente
    const handleUserCreated = (newUser: UsuarioPortal) => {
        setUsuarios(prev => [newUser, ...prev])
        setShowCreateModal(false)
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <div className="flex items-center gap-3 mb-4 md:mb-0">
                    <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                        <Users className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Administración de Usuarios</h1>
                        <p className="text-gray-500 text-sm">Gestiona los usuarios del portal</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
                >
                    <UserPlus className="w-5 h-5" />
                    Nuevo Usuario
                </button>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-xl shadow-md p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Búsqueda */}
                    <div className="md:col-span-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, identificación o email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Filtro por rol */}
                    <select
                        value={filterRol}
                        onChange={(e) => setFilterRol(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="all">Todos los roles</option>
                        <option value="operativo">Operativo</option>
                        <option value="admin">Admin</option>
                        <option value="gerencia">Gerencia</option>
                        <option value="auditor">Auditor</option>
                        <option value="asistencial">Asistencial</option>
                        <option value="externo">Externo</option>
                        <option value="superadmin">Super Admin</option>
                    </select>

                    {/* Filtro por estado */}
                    <select
                        value={filterActivo}
                        onChange={(e) => setFilterActivo(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                    </select>
                </div>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-md p-4 text-center">
                    <div className="text-3xl font-bold text-indigo-600">{usuarios.length}</div>
                    <div className="text-sm text-gray-500">Total Usuarios</div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{usuarios.filter(u => u.activo).length}</div>
                    <div className="text-sm text-gray-500">Activos</div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-4 text-center">
                    <div className="text-3xl font-bold text-red-600">{usuarios.filter(u => !u.activo).length}</div>
                    <div className="text-sm text-gray-500">Inactivos</div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-4 text-center">
                    <div className="text-3xl font-bold text-purple-600">{usuarios.filter(u => u.rol === 'superadmin').length}</div>
                    <div className="text-sm text-gray-500">Super Admins</div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-700">{error}</span>
                    <button onClick={loadUsuarios} className="ml-auto text-red-600 hover:text-red-800">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Tabla de usuarios */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center">
                        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
                        <p className="text-gray-500">Cargando usuarios...</p>
                    </div>
                ) : filteredUsuarios.length === 0 ? (
                    <div className="p-8 text-center">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">No se encontraron usuarios</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Usuario</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Identificación</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Rol</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Estado</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredUsuarios.map((usuario) => {
                                    const rolInfo = ROL_LABELS[usuario.rol] || ROL_LABELS.operativo
                                    const isCurrentUser = usuario.email_institucional === user?.email

                                    return (
                                        <tr
                                            key={usuario.id}
                                            className={`hover:bg-gray-50 transition-colors ${!usuario.activo ? 'opacity-60' : ''}`}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${usuario.activo ? 'bg-indigo-500' : 'bg-gray-400'}`}>
                                                        {usuario.nombre_completo.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-800">{usuario.nombre_completo}</div>
                                                        {isCurrentUser && (
                                                            <span className="text-xs text-indigo-600">(Tú)</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 font-mono text-sm">{usuario.identificacion}</td>
                                            <td className="px-4 py-3 text-gray-600 text-sm">{usuario.email_institucional}</td>
                                            <td className="px-4 py-3 text-center">
                                                <select
                                                    value={usuario.rol}
                                                    onChange={(e) => handleChangeRole(usuario, e.target.value as any)}
                                                    disabled={actionLoading === usuario.id || isCurrentUser}
                                                    className={`px-2 py-1 rounded-full text-xs font-medium ${rolInfo.color} border-0 cursor-pointer disabled:cursor-not-allowed`}
                                                >
                                                    <option value="operativo">Operativo</option>
                                                    <option value="admin">Admin</option>
                                                    <option value="gerencia">Gerencia</option>
                                                    <option value="auditor">Auditor</option>
                                                    <option value="asistencial">Asistencial</option>
                                                    <option value="externo">Externo</option>
                                                    {usuario.rol === 'superadmin' && <option value="superadmin">Super Admin</option>}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleToggleActive(usuario)}
                                                    disabled={actionLoading === usuario.id || isCurrentUser}
                                                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${usuario.activo
                                                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                >
                                                    {usuario.activo ? (
                                                        <><ToggleRight className="w-4 h-4" /> Activo</>
                                                    ) : (
                                                        <><ToggleLeft className="w-4 h-4" /> Inactivo</>
                                                    )}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleDelete(usuario)}
                                                        disabled={actionLoading === usuario.id || isCurrentUser}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Eliminar usuario"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de creación */}
            {showCreateModal && (
                <CreateUserModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={handleUserCreated}
                />
            )}
        </div>
    )
}
