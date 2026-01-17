/**
 * Modal para Crear Nuevo Contacto
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useCallback } from 'react'
import {
    X,
    Save,
    User,
    Mail,
    Phone,
    Building2,
    Briefcase,
    MapPin,
    AlertCircle,
    CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/common'
import { contactosService } from '@/services/contactos.service'
import {
    ContactoInput,
    TRATAMIENTO_LISTA,
    ROL_LISTA,
} from '@/types/contactos.types'

interface NuevoContactoModalProps {
    onClose: () => void
    onCreated: () => void
}

export function NuevoContactoModal({ onClose, onCreated }: NuevoContactoModalProps) {
    // ============================================
    // ESTADO
    // ============================================

    const [formData, setFormData] = useState<ContactoInput>({
        primer_nombre: '',
        apellidos: '',
        tratamiento: null,
        segundo_nombre: null,
        identificacion: null,
        email_personal: null,
        email_institucional: null,
        empresa: null,
        puesto: null,
        celular_1: null,
        celular_2: null,
        fecha_nacimiento: null,
        direccion: null,
        ciudad: 'Montería',
        departamento: 'Córdoba',
        pais: 'Colombia',
        notas: null,
        rol: 'operativo',
        area: null,
    })

    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [exito, setExito] = useState(false)

    // ============================================
    // HANDLERS
    // ============================================

    const handleChange = useCallback((campo: keyof ContactoInput, valor: string | null) => {
        setFormData(prev => ({ ...prev, [campo]: valor }))
    }, [])

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()

        // Validación básica
        if (!formData.primer_nombre.trim()) {
            setError('El primer nombre es requerido')
            return
        }
        if (!formData.apellidos.trim()) {
            setError('Los apellidos son requeridos')
            return
        }

        setGuardando(true)
        setError(null)

        const result = await contactosService.crearContacto(formData)

        setGuardando(false)

        if (result.success) {
            setExito(true)
            setTimeout(() => {
                onCreated()
            }, 500)
        } else {
            setError(result.error || 'Error al crear el contacto')
        }
    }, [formData, onCreated])

    // ============================================
    // RENDER
    // ============================================

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-scale-in"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[var(--color-primary-50)] to-white flex items-center justify-between">
                        <h2 className="text-xl font-bold text-[var(--color-primary-700)] flex items-center gap-2">
                            <User size={24} />
                            Nuevo Contacto
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/80 transition-colors"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
                        <div className="p-6 space-y-6">
                            {/* Información Personal */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                                    <User size={16} />
                                    Información Personal
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Tratamiento */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Tratamiento</label>
                                        <select
                                            value={formData.tratamiento || ''}
                                            onChange={(e) => handleChange('tratamiento', e.target.value || null)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                        >
                                            {TRATAMIENTO_LISTA.map(t => (
                                                <option key={t} value={t}>{t || '(ninguno)'}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Identificación */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Identificación</label>
                                        <input
                                            type="text"
                                            value={formData.identificacion || ''}
                                            onChange={(e) => handleChange('identificacion', e.target.value || null)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                            placeholder="Número de documento"
                                        />
                                    </div>

                                    {/* Primer nombre */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Primer Nombre *</label>
                                        <input
                                            type="text"
                                            value={formData.primer_nombre}
                                            onChange={(e) => handleChange('primer_nombre', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                            required
                                        />
                                    </div>

                                    {/* Segundo nombre */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Segundo Nombre</label>
                                        <input
                                            type="text"
                                            value={formData.segundo_nombre || ''}
                                            onChange={(e) => handleChange('segundo_nombre', e.target.value || null)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                        />
                                    </div>

                                    {/* Apellidos */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Apellidos *</label>
                                        <input
                                            type="text"
                                            value={formData.apellidos}
                                            onChange={(e) => handleChange('apellidos', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                            required
                                        />
                                    </div>

                                    {/* Rol */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Rol</label>
                                        <select
                                            value={formData.rol || 'operativo'}
                                            onChange={(e) => handleChange('rol', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] capitalize"
                                        >
                                            {ROL_LISTA.map(r => (
                                                <option key={r} value={r} className="capitalize">{r}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Contacto */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                                    <Phone size={16} />
                                    Contacto
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Celular Principal</label>
                                        <input
                                            type="tel"
                                            value={formData.celular_1 || ''}
                                            onChange={(e) => handleChange('celular_1', e.target.value || null)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                            placeholder="+57 300 000 0000"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                            <Mail size={12} className="inline mr-1" />
                                            Email Personal
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email_personal || ''}
                                            onChange={(e) => handleChange('email_personal', e.target.value || null)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Celular Secundario</label>
                                        <input
                                            type="tel"
                                            value={formData.celular_2 || ''}
                                            onChange={(e) => handleChange('celular_2', e.target.value || null)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                            <Building2 size={12} className="inline mr-1" />
                                            Email Institucional
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email_institucional || ''}
                                            onChange={(e) => handleChange('email_institucional', e.target.value || null)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Trabajo */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                                    <Briefcase size={16} />
                                    Información Laboral
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Empresa</label>
                                        <input
                                            type="text"
                                            value={formData.empresa || ''}
                                            onChange={(e) => handleChange('empresa', e.target.value || null)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Puesto / Cargo</label>
                                        <input
                                            type="text"
                                            value={formData.puesto || ''}
                                            onChange={(e) => handleChange('puesto', e.target.value || null)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Área / Departamento</label>
                                        <input
                                            type="text"
                                            value={formData.area || ''}
                                            onChange={(e) => handleChange('area', e.target.value || null)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Ubicación */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                                    <MapPin size={16} />
                                    Ubicación
                                </h3>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Ciudad</label>
                                        <input
                                            type="text"
                                            value={formData.ciudad || ''}
                                            onChange={(e) => handleChange('ciudad', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Departamento</label>
                                        <input
                                            type="text"
                                            value={formData.departamento || ''}
                                            onChange={(e) => handleChange('departamento', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">País</label>
                                        <input
                                            type="text"
                                            value={formData.pais || ''}
                                            onChange={(e) => handleChange('pais', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Mensajes de estado */}
                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                    <AlertCircle size={18} />
                                    {error}
                                </div>
                            )}

                            {exito && (
                                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 animate-fade-in">
                                    <CheckCircle size={18} />
                                    Contacto creado exitosamente
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
                            <Button variant="ghost" onClick={onClose} type="button">
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                isLoading={guardando}
                                leftIcon={<Save size={18} />}
                            >
                                Crear Contacto
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    )
}

export default NuevoContactoModal
