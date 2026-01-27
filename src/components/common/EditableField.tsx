/**
 * Componente EditableField - Campo editable genérico
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Permite la edición inline de campos de texto con permisos para superadmin y admin
 */

import { useState, useEffect } from 'react'
import { Check, X, Edit2 } from 'lucide-react'

interface EditableFieldProps {
    value: string | null | undefined
    onUpdate: (newValue: string) => Promise<boolean>
    placeholder?: string
    type?: 'text' | 'email' | 'date' | 'number'
    disabled?: boolean
    className?: string
    displayFormatter?: (value: string) => React.ReactNode
}

export function EditableField({
    value,
    onUpdate,
    placeholder = '',
    type = 'text',
    disabled = false,
    className = '',
    displayFormatter
}: EditableFieldProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(value || '')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        setEditValue(value || '')
    }, [value])

    const handleSave = async () => {
        // Validar que haya cambios
        if (editValue === (value || '')) {
            setIsEditing(false)
            return
        }

        setIsLoading(true)
        setError('')

        try {
            const success = await onUpdate(editValue)

            if (success) {
                setIsEditing(false)
            } else {
                setError('Error al actualizar')
            }
        } catch (err) {
            console.error('Error actualizando campo:', err)
            setError('Error al actualizar')
        } finally {
            setIsLoading(false)
        }
    }

    const handleCancel = () => {
        setEditValue(value || '')
        setError('')
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSave()
        } else if (e.key === 'Escape') {
            handleCancel()
        }
    }

    if (disabled) {
        return (
            <span className={className}>
                {displayFormatter ? displayFormatter(value || '') : (value || placeholder)}
            </span>
        )
    }

    if (isEditing) {
        return (
            <div className="flex items-center gap-2 min-w-0">
                <input
                    type={type}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                    placeholder={placeholder}
                    autoFocus
                    disabled={isLoading}
                />
                <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                    title="Guardar"
                >
                    <Check size={16} />
                </button>
                <button
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    title="Cancelar"
                >
                    <X size={16} />
                </button>
                {error && (
                    <span className="text-xs text-red-600">{error}</span>
                )}
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2 group min-w-0">
            <span className={`flex-1 truncate ${className}`}>
                {displayFormatter ? displayFormatter(value || '') : (value || placeholder)}
            </span>
            <button
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-50 rounded transition-all flex-shrink-0"
                title="Editar"
            >
                <Edit2 size={14} />
            </button>
        </div>
    )
}

export default EditableField
