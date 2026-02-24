/**
 * Página de Administración de Usuarios
 * Solo accesible para superadmin
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useEffect, useCallback } from 'react'
import {
    Users, UserPlus, Search, Shield, ShieldCheck, ShieldX,
    ToggleLeft, ToggleRight, Trash2, RefreshCw, AlertCircle,
    ChevronLeft, ChevronRight, FileUp, FileDown, KeyRound
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { usuariosPortalService, UsuarioPortal } from '@/services/usuariosPortal.service'
import { EDGE_FUNCTIONS, getEdgeFunctionHeaders } from '@/config/api.config'
import CreateUserModal from './components/CreateUserModal'
import ImportUserModal from './components/ImportUserModal'

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
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Filtros y Paginación
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [filterRol, setFilterRol] = useState<string>('all')
    const [filterActivo, setFilterActivo] = useState<string>('all')
    const [page, setPage] = useState(1)
    const [pageSize] = useState(10)
    const [totalRecords, setTotalRecords] = useState(0)
    const [roleStats, setRoleStats] = useState<Record<string, number>>({})

    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm)
            setPage(1) // Reset page on search change
        }, 500)
        return () => clearTimeout(timer)
    }, [searchTerm])

    // Reset page on filter change
    useEffect(() => {
        setPage(1)
    }, [filterRol, filterActivo])

    // Cargar usuarios
    const loadUsuarios = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        const { data, count, error: err } = await usuariosPortalService.getAll(
            page,
            pageSize,
            {
                search: debouncedSearch,
                rol: filterRol,
                activo: filterActivo
            }
        )

        if (err) {
            setError(err)
            setUsuarios([])
            setTotalRecords(0)
        } else {
            setUsuarios(data || [])
            setTotalRecords(count || 0)
        }
        setIsLoading(false)
    }, [page, pageSize, debouncedSearch, filterRol, filterActivo])

    // Cargar estadísticas de roles
    const loadRoleStats = useCallback(async () => {
        const { stats } = await usuariosPortalService.getRoleStats()
        setRoleStats(stats)
    }, [])

    useEffect(() => {
        loadUsuarios()
        loadRoleStats()
    }, [loadUsuarios, loadRoleStats])

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
    const handleChangeRole = async (usuario: UsuarioPortal, newRol: 'operativo' | 'admin' | 'superadmin' | 'gerencia' | 'auditor' | 'asistencial' | 'externo') => {
        if (newRol === usuario.rol) return
        setActionLoading(usuario.id)
        const { success, error: err } = await usuariosPortalService.changeRole(usuario.id, newRol)
        if (success) {
            setUsuarios(prev => prev.map(u =>
                u.id === usuario.id ? { ...u, rol: newRol } : u
            ))
            loadRoleStats() // Recargar estadísticas si cambia el rol
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
            loadRoleStats() // Recargar estadísticas
        } else {
            toast.error(`Error: ${err}`)
        }
        setActionLoading(null)
    }

    // Resetear contraseña
    const handleResetPassword = async (usuario: UsuarioPortal) => {
        if (!confirm(`¿Estás seguro de resetear la contraseña de ${usuario.nombre_completo}?\n\nLa nueva contraseña será su número de identificación: ${usuario.identificacion}`)) {
            return
        }
        setActionLoading(usuario.id)
        try {
            const response = await fetch(EDGE_FUNCTIONS.resetPassword, {
                method: 'POST',
                headers: await getEdgeFunctionHeaders(),
                body: JSON.stringify({ usuario_portal_id: usuario.id })
            })
            const data = await response.json()
            if (response.ok && data.success) {
                toast.success(`Contraseña reseteada para ${usuario.nombre_completo}. Nueva contraseña: su número de identificación.`)
            } else {
                toast.error(data.error || 'Error al resetear la contraseña')
            }
        } catch {
            toast.error('Error de conexión al resetear la contraseña')
        }
        setActionLoading(null)
    }

    // Usuario creado exitosamente
    const handleUserCreated = () => {
        loadUsuarios() // Recargar lista completa
        loadRoleStats() // Recargar estadísticas
        setShowCreateModal(false)
    }

    // Exportar usuarios a Excel
    const handleExport = async () => {
        try {
            const { data, error: err } = await usuariosPortalService.getAllForExport({
                search: debouncedSearch,
                rol: filterRol,
                activo: filterActivo
            })

            if (err || !data) {
                toast.error(`Error al exportar: ${err || 'No data'}`)
                return
            }

            if (data.length === 0) {
                toast.info('No hay usuarios para exportar con los filtros actuales')
                return
            }

            // Transformar datos para Excel
            const exportData = data.map(u => ({
                'Nombre Completo': u.nombre_completo,
                'Identificación': u.identificacion,
                'Email Institucional': u.email_institucional,
                'Rol': ROL_LABELS[u.rol]?.label || u.rol,
                'Estado': u.activo ? 'Activo' : 'Inactivo',
                'Fecha Creación': new Date(u.created_at).toLocaleDateString(),
                'Último Acceso': u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : 'Nunca'
            }))

            // Crear hoja de trabajo
            const ws = XLSX.utils.json_to_sheet(exportData)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, "Usuarios")

            // Generar archivo
            XLSX.writeFile(wb, `Usuarios_Portal_${new Date().toISOString().split('T')[0]}.xlsx`)
            toast.success('Exportación exitosa')

        } catch (e: any) {
            console.error('Error exportando:', e)
            toast.error('Error al generar el archivo Excel')
        }
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
                <div className="flex gap-2">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg shadow-sm hover:bg-gray-50 transition-all hover:scale-105"
                    >
                        <FileDown className="w-5 h-5 text-blue-600" />
                        Exportar
                    </button>
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg shadow-sm hover:bg-gray-50 transition-all hover:scale-105"
                    >
                        <FileUp className="w-5 h-5 text-green-600" />
                        Importar
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                        <UserPlus className="w-5 h-5" />
                        Nuevo Usuario
                    </button>
                </div>
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

            {/* Role Cards - Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
                <div
                    onClick={() => setFilterRol('all')}
                    className={`cursor-pointer rounded-xl p-4 transition-all duration-200 border ${filterRol === 'all'
                        ? 'bg-gradient-to-br from-gray-800 to-gray-900 text-white shadow-lg scale-105 border-transparent'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-100 hover:shadow-md'
                        }`}
                >
                    <div className="flex flex-col items-center justify-center gap-1">
                        <Users className={`w-6 h-6 ${filterRol === 'all' ? 'text-gray-300' : 'text-gray-400'}`} />
                        <span className="text-2xl font-bold">{Object.values(roleStats).reduce((a, b) => a + b, 0)}</span>
                        <span className="text-xs font-medium uppercase tracking-wider">Total</span>
                    </div>
                </div>

                {Object.entries(roleStats)
                    .sort(([, a], [, b]) => b - a)
                    .map(([rol, count]) => {
                        const info = ROL_LABELS[rol] || { label: rol, color: 'bg-gray-100 text-gray-800', icon: Shield }
                        const isActive = filterRol === rol
                        const Icon = info.icon

                        return (
                            <div
                                key={rol}
                                onClick={() => setFilterRol(rol)}
                                className={`cursor-pointer rounded-xl p-3 transition-all duration-200 border flex flex-col items-center justify-center gap-2 ${isActive
                                    ? `bg-white ring-2 ring-indigo-500 shadow-lg scale-105 border-transparent`
                                    : 'bg-white hover:bg-gray-50 border-gray-100 hover:shadow-md'
                                    }`}
                            >
                                <div className={`p-2 rounded-full ${info.color.replace('text-', 'bg-opacity-20 text-')}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="text-center">
                                    <span className="block text-xl font-bold text-gray-800">{count}</span>
                                    <span className="text-xs font-medium text-gray-500 uppercase">{info.label}</span>
                                </div>
                            </div>
                        )
                    })}
            </div>

            {/* Estadísticas (Resultados filtrados) */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-800">{totalRecords}</span>
                    <span className="text-sm text-gray-500">usuarios encontrados</span>
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
            <div className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col">
                {isLoading ? (
                    <div className="p-8 text-center">
                        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
                        <p className="text-gray-500">Cargando usuarios...</p>
                    </div>
                ) : usuarios.length === 0 ? (
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
                                {usuarios.map((usuario) => {
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
                                                        onClick={() => handleResetPassword(usuario)}
                                                        disabled={actionLoading === usuario.id || isCurrentUser}
                                                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Resetear contraseña (será su número de identificación)"
                                                    >
                                                        <KeyRound className="w-4 h-4" />
                                                    </button>
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

                {/* Paginación */}
                {!isLoading && usuarios.length > 0 && (
                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    Mostrando de <span className="font-medium">{(page - 1) * pageSize + 1}</span> a <span className="font-medium">{Math.min(page * pageSize, totalRecords)}</span> de <span className="font-medium">{totalRecords}</span> resultados
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    >
                                        <span className="sr-only">Anterior</span>
                                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                    </button>

                                    <div className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                        Pág {page} de {Math.ceil(totalRecords / pageSize)}
                                    </div>

                                    <button
                                        onClick={() => setPage(p => Math.min(Math.ceil(totalRecords / pageSize), p + 1))}
                                        disabled={page >= Math.ceil(totalRecords / pageSize)}
                                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    >
                                        <span className="sr-only">Siguiente</span>
                                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de creación */}
            {
                showCreateModal && (
                    <CreateUserModal
                        onClose={() => setShowCreateModal(false)}
                        onCreated={handleUserCreated}
                    />
                )
            }

            {/* Modal de importación */}
            {
                showImportModal && (
                    <ImportUserModal
                        onClose={() => setShowImportModal(false)}
                        onCreated={() => {
                            loadUsuarios()
                        }}
                    />
                )
            }
        </div >
    )
}
