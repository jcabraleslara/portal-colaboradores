/**
 * Modal para crear un nuevo usuario del portal
 * Solo accesible para superadmin
 */

import { useState } from 'react'
import { X, User, Mail, Key, Shield, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { usuariosPortalService, UsuarioPortal, CreateUserData } from '@/services/usuariosPortal.service'

interface CreateUserModalProps {
    onClose: () => void
    onCreated: (user: UsuarioPortal) => void
}

export default function CreateUserModal({ onClose, onCreated }: CreateUserModalProps) {
    const [formData, setFormData] = useState<CreateUserData>({
        identificacion: '',
        nombre_completo: '',
        email_institucional: '',
        rol: 'operativo',
        password: ''
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
        setError(null)
    }

    const validateForm = (): string | null => {
        if (!formData.identificacion.trim()) return 'La identificación es requerida'
        if (!formData.nombre_completo.trim()) return 'El nombre completo es requerido'
        if (!formData.email_institucional.trim()) return 'El email institucional es requerido'
        if (!formData.email_institucional.includes('@')) return 'El email no es válido'
        if (!formData.password.trim()) return 'La contraseña es requerida'
        if (formData.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres'
        return null
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const validationError = validateForm()
        if (validationError) {
            setError(validationError)
            return
        }

        setIsSubmitting(true)
        setError(null)

        // Crear en usuarios_portal
        const { data, error: createError } = await usuariosPortalService.create(formData)

        if (createError) {
            setError(createError)
            setIsSubmitting(false)
            return
        }

        if (data) {
            setSuccess(true)
            setTimeout(() => {
                onCreated(data)
            }, 1500)
        }

        setIsSubmitting(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <User className="w-6 h-6" />
                        Nuevo Usuario
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Identificación */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Identificación *
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                name="identificacion"
                                value={formData.identificacion}
                                onChange={handleChange}
                                placeholder="Número de documento"
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                disabled={isSubmitting || success}
                            />
                        </div>
                    </div>

                    {/* Nombre completo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nombre Completo *
                        </label>
                        <input
                            type="text"
                            name="nombre_completo"
                            value={formData.nombre_completo}
                            onChange={handleChange}
                            placeholder="Nombres y apellidos"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            disabled={isSubmitting || success}
                        />
                    </div>

                    {/* Email institucional */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email Institucional *
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="email"
                                name="email_institucional"
                                value={formData.email_institucional}
                                onChange={handleChange}
                                placeholder="correo@gestarsaludips.com"
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                disabled={isSubmitting || success}
                            />
                        </div>
                    </div>

                    {/* Rol */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Rol *
                        </label>
                        <div className="relative">
                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <select
                                name="rol"
                                value={formData.rol}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none"
                                disabled={isSubmitting || success}
                            >
                                <option value="operativo">Operativo</option>
                                <option value="admin">Admin</option>
                                <option value="superadmin">Super Admin</option>
                            </select>
                        </div>
                    </div>

                    {/* Contraseña temporal */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Contraseña Temporal *
                        </label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Contraseña inicial"
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                disabled={isSubmitting || success}
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            El usuario deberá cambiar esta contraseña en su primer ingreso.
                        </p>
                    </div>

                    {/* Nota importante */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                        <strong>Nota:</strong> Después de crear el usuario aquí, debes ejecutar el script
                        <code className="bg-amber-100 px-1 rounded mx-1">create_user.cjs</code>
                        para crear las credenciales de acceso en Supabase Auth.
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Success */}
                    {success && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-green-700">
                            <CheckCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">Usuario creado exitosamente</span>
                        </div>
                    )}

                    {/* Botones */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || success}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Creando...
                                </>
                            ) : success ? (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    Creado
                                </>
                            ) : (
                                'Crear Usuario'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
