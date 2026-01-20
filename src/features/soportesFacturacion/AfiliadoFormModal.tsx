/**
 * Modal para Crear Afiliado
 * Se muestra cuando un afiliado no existe en la BD
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState } from 'react'
import { X, User, Mail, Phone, Building2, FileText } from 'lucide-react'
import { Card, Button, Input } from '@/components/common'
import { supabase } from '@/config/supabase.config'

interface AfiliadoFormModalProps {
    identificacion: string
    onClose: () => void
    onSuccess: (afiliado: AfiliadoCreado) => void
}

interface AfiliadoCreado {
    tipoId: string
    id: string
    nombres: string
    apellido1: string
    apellido2: string
    eps: string
    regimen: string
    telefonoPrincipal?: string
    email?: string
}

const TIPOS_ID = [
    { value: 'CC', label: 'Cédula de Ciudadanía' },
    { value: 'TI', label: 'Tarjeta de Identidad' },
    { value: 'RC', label: 'Registro Civil' },
    { value: 'CE', label: 'Cédula de Extranjería' },
    { value: 'PA', label: 'Pasaporte' },
    { value: 'PT', label: 'Permiso Temporal' },
    { value: 'CN', label: 'Certificado de Nacido Vivo' },
]

const EPS_LISTA = [
    'NUEVA EPS',
    'SALUD TOTAL',
    'MUTUAL SER',
    'FAMILIAR',
    'SANITAS',
    'COMPENSAR',
    'SURA',
    'Otra',
]

export function AfiliadoFormModal({ identificacion, onClose, onSuccess }: AfiliadoFormModalProps) {
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        tipoId: 'CC',
        nombres: '',
        apellido1: '',
        apellido2: '',
        eps: '',
        regimen: 'CONTRIBUTIVO',
        telefonoPrincipal: '',
        email: '',
    })

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setError(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        // Validación
        if (!formData.nombres.trim()) {
            setError('El nombre es requerido')
            return
        }
        if (!formData.apellido1.trim()) {
            setError('El primer apellido es requerido')
            return
        }
        if (!formData.eps) {
            setError('La EPS es requerida')
            return
        }

        setGuardando(true)

        try {
            // Insertar en public.bd
            const { data, error: insertError } = await supabase
                .from('bd')
                .insert({
                    tipo_id: formData.tipoId,
                    id: identificacion,
                    nombres: formData.nombres.trim(),
                    apellido1: formData.apellido1.trim(),
                    apellido2: formData.apellido2.trim() || null,
                    eps: formData.eps,
                    regimen: formData.regimen,
                    telefono: formData.telefonoPrincipal.trim() || null,
                    email: formData.email.trim() || null,
                    fuente: 'PORTAL_COLABORADORES',
                })
                .select()
                .single()

            if (insertError) {
                console.error('Error insertando afiliado:', insertError)
                throw new Error(insertError.message)
            }

            // Retornar datos normalizados
            onSuccess({
                tipoId: data.tipo_id,
                id: data.id,
                nombres: data.nombres,
                apellido1: data.apellido1,
                apellido2: data.apellido2 || '',
                eps: data.eps,
                regimen: data.regimen,
                telefonoPrincipal: data.telefono,
                email: data.email,
            })

        } catch (err) {
            console.error('Error creando afiliado:', err)
            setError(err instanceof Error ? err.message : 'Error creando afiliado')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <Card className="w-full max-w-2xl pointer-events-auto animate-scale-in">
                    <Card.Header className="flex items-center justify-between border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                                <User size={20} className="text-primary-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Crear Nuevo Afiliado</h2>
                                <p className="text-sm text-gray-500">
                                    Identificación: <span className="font-mono font-semibold">{identificacion}</span>
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-gray-400" />
                        </button>
                    </Card.Header>

                    <Card.Body>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Tipo de Identificación */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Tipo de Identificación *
                                </label>
                                <select
                                    value={formData.tipoId}
                                    onChange={(e) => handleChange('tipoId', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-100"
                                    required
                                >
                                    {TIPOS_ID.map(tipo => (
                                        <option key={tipo.value} value={tipo.value}>
                                            {tipo.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Nombres y Apellidos */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nombres *
                                    </label>
                                    <Input
                                        value={formData.nombres}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('nombres', e.target.value)}
                                        placeholder="Ej: Juan Carlos"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Primer Apellido *
                                    </label>
                                    <Input
                                        value={formData.apellido1}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('apellido1', e.target.value)}
                                        placeholder="Ej: Pérez"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Segundo Apellido
                                    </label>
                                    <Input
                                        value={formData.apellido2}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('apellido2', e.target.value)}
                                        placeholder="Ej: García"
                                    />
                                </div>
                            </div>

                            {/* EPS y Régimen */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                        <Building2 size={16} />
                                        EPS *
                                    </label>
                                    <select
                                        value={formData.eps}
                                        onChange={(e) => handleChange('eps', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-100"
                                        required
                                    >
                                        <option value="">Seleccionar EPS...</option>
                                        {EPS_LISTA.map(eps => (
                                            <option key={eps} value={eps}>{eps}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                        <FileText size={16} />
                                        Régimen *
                                    </label>
                                    <select
                                        value={formData.regimen}
                                        onChange={(e) => handleChange('regimen', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-100"
                                        required
                                    >
                                        <option value="CONTRIBUTIVO">CONTRIBUTIVO</option>
                                        <option value="SUBSIDIADO">SUBSIDIADO</option>
                                    </select>
                                </div>
                            </div>

                            {/* Contacto */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                        <Phone size={16} />
                                        Teléfono
                                    </label>
                                    <Input
                                        type="tel"
                                        value={formData.telefonoPrincipal}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('telefonoPrincipal', e.target.value)}
                                        placeholder="Ej: 3001234567"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                        <Mail size={16} />
                                        Email
                                    </label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('email', e.target.value)}
                                        placeholder="Ej: correo@ejemplo.com"
                                    />
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                                    <p className="text-sm text-red-600">{error}</p>
                                </div>
                            )}

                            {/* Botones */}
                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={onClose}
                                    className="flex-1"
                                    disabled={guardando}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1"
                                    disabled={guardando}
                                >
                                    {guardando ? 'Guardando...' : 'Crear Afiliado'}
                                </Button>
                            </div>
                        </form>
                    </Card.Body>
                </Card>
            </div>
        </>
    )
}
