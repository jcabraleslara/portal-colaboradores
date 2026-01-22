import { useState, useEffect } from 'react'
import { Edit2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './Button'
import { Input } from './Input'
import { afiliadosService } from '@/services/afiliados.service'

interface EditablePhoneProps {
    initialValue: string | null
    tipoId: string
    id: string
    onUpdate: (newValue: string) => void
}

export function EditablePhone({
    initialValue,
    tipoId,
    id,
    onUpdate
}: EditablePhoneProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [value, setValue] = useState(initialValue || '')
    const [isLoading, setIsLoading] = useState(false)

    // Actualizar valor local si cambia el prop (ej: nueva búsqueda)
    useEffect(() => {
        setValue(initialValue || '')
    }, [initialValue])

    const handleSave = async () => {
        if (isLoading) return

        setIsLoading(true)
        const result = await afiliadosService.actualizarTelefono(tipoId, id, value)
        setIsLoading(false)

        if (result.success) {
            setIsEditing(false)
            onUpdate(value)
        } else {
            toast.error('Error al actualizar teléfono')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave()
        } else if (e.key === 'Escape') {
            setIsEditing(false)
            setValue(initialValue || '')
        }
    }

    if (isEditing) {
        return (
            <div className="flex items-center gap-1">
                <Input
                    className="h-8 py-0 px-2 text-sm w-full min-w-[120px]"
                    value={value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    disabled={isLoading}
                />
                <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                    <Check size={16} />
                </Button>
                <Button
                    onClick={() => {
                        setIsEditing(false)
                        setValue(initialValue || '')
                    }}
                    disabled={isLoading}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                    <X size={16} />
                </Button>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
            <span className={!initialValue ? 'text-gray-400 italic' : ''}>
                {initialValue || 'Sin teléfono'}
            </span>
            <button
                className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-600 p-0.5"
                title="Editar teléfono"
            >
                <Edit2 size={14} />
            </button>
        </div>
    )
}
