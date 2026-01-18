/**
 * Modal para crear un nuevo usuario del portal
 * Solo accesible para superadmin
 * Utiliza el endpoint serverless /api/create-user
 */

import { useState, useRef, useEffect } from 'react'
import { X, User, Mail, Key, Shield, Loader2, AlertCircle, CheckCircle, Search, Contact as ContactIcon } from 'lucide-react'
import { UsuarioPortal, CreateUserData } from '@/services/usuariosPortal.service'
import { contactosService } from '@/services/contactos.service'
import { Contacto } from '@/types/contactos.types'
import { supabase } from '@/config/supabase.config'

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
        password: '',
        contacto_id: null
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Estados para búsqueda de contactos
    const [searchTerm, setSearchTerm] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [searchResults, setSearchResults] = useState<Contacto[]>([])
    const [showResults, setShowResults] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)

    // Cerrar resultados al hacer clic fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Búsqueda de contactos
    const handleSearchContact = async (term: string) => {
        setSearchTerm(term)
        if (term.length < 3) {
            setSearchResults([])
            setShowResults(false)
            return
        }

        setIsSearching(true)
        setShowResults(true)

        try {
            const { data, error: _error } = await contactosService.obtenerContactosFiltrados({
                busqueda: term
            }, 0, 5) // Limitar a 5 resultados

            if (data?.contactos) {
                setSearchResults(data.contactos)
            }
        } catch (err) {
            console.error('Error buscando contactos:', err)
        } finally {
            setIsSearching(false)
        }
    }

    // Seleccionar contacto
    const handleSelectContact = (contacto: Contacto) => {
        const nombreCompleto = [
            contacto.primer_nombre,
            contacto.segundo_nombre,
            contacto.apellidos
        ].filter(Boolean).join(' ')

        setFormData(prev => ({
            ...prev,
            identificacion: contacto.identificacion || prev.identificacion,
            nombre_completo: nombreCompleto,
            email_institucional: contacto.email_institucional || prev.email_institucional,
            password: contacto.identificacion || prev.password, // Contraseña temporal = identificación
            contacto_id: contacto.id
        }))

        setSearchTerm('')
        setShowResults(false)
        setError(null) // Limpiar errores previos
    }

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

        try {
            // Obtener el token de sesión actual
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.access_token) {
                setError('No hay sesión activa. Por favor, inicia sesión nuevamente.')
                setIsSubmitting(false)
                return
            }

            // Llamar al API serverless
            const response = await fetch('/api/create-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(formData)
            })

            const result = await response.json()

            if (!response.ok) {
                setError(result.error || 'Error creando usuario')
                setIsSubmitting(false)
                return
            }

            if (result.success && result.usuario) {
                setSuccess(true)
                setTimeout(() => {
                    onCreated(result.usuario)
                }, 1500)
            }
        } catch (err: any) {
            setError(err.message || 'Error de conexión')
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

                    {/* Buscador de Contactos - Feature nueva */}
                    <div className="relative z-20" ref={searchRef}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Buscar en Directorio (Opcional)
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => handleSearchContact(e.target.value)}
                                placeholder="Buscar por nombre o cédula..."
                                className="w-full pl-10 pr-4 py-2 border border-indigo-200 bg-indigo-50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-indigo-300"
                                disabled={isSubmitting || success}
                            />
                            {isSearching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                </div>
                            )}
                        </div>

                        {/* Resultados de búsqueda */}
                        {showResults && searchResults.length > 0 && (
                            <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                {searchResults.map((contacto) => (
                                    <button
                                        key={contacto.id}
                                        type="button"
                                        onClick={() => handleSelectContact(contacto)}
                                        className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors border-b last:border-0 border-gray-100 flex items-start gap-3 group"
                                    >
                                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-200 transition-colors">
                                            <ContactIcon size={16} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-800 text-sm">
                                                {[
                                                    contacto.primer_nombre,
                                                    contacto.segundo_nombre,
                                                    contacto.apellidos
                                                ].filter(Boolean).join(' ')}
                                            </p>
                                            <div className="flex flex-col text-xs text-gray-500 mt-0.5">
                                                <span>CC: {contacto.identificacion || 'N/A'}</span>
                                                <span>{contacto.email_institucional || 'Sin email'}</span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {showResults && searchResults.length === 0 && searchTerm.length >= 3 && !isSearching && (
                            <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-sm text-gray-500">
                                No se encontraron contactos
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

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

                    {/* Nota informativa */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                        <strong>⚡ Creación automática:</strong> El usuario será creado con acceso completo
                        al portal. Podrá iniciar sesión inmediatamente con la contraseña temporal.
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
