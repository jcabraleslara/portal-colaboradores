/**
 * Componente FileUpload
 * Drag and drop para archivos PDF con preview
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useCallback, useState } from 'react'
import { Upload, File, X, AlertCircle } from 'lucide-react'

interface FileUploadProps {
    files: File[]
    onChange: (files: File[]) => void
    maxSizeMB?: number
    maxFiles?: number
    disabled?: boolean
}

export function FileUpload({
    files,
    onChange,
    maxSizeMB = 10,
    maxFiles = 5,
    disabled = false,
}: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const maxSizeBytes = maxSizeMB * 1024 * 1024

    const validateFile = useCallback((file: File): string | null => {
        // Validar tipo
        if (file.type !== 'application/pdf') {
            return `${file.name}: Solo se permiten archivos PDF`
        }
        // Validar tamaño
        if (file.size > maxSizeBytes) {
            return `${file.name}: Excede el límite de ${maxSizeMB}MB`
        }
        return null
    }, [maxSizeBytes, maxSizeMB])

    const addFiles = useCallback((newFiles: FileList | File[]) => {
        setError(null)
        const fileArray = Array.from(newFiles)

        // Validar cantidad máxima
        if (files.length + fileArray.length > maxFiles) {
            setError(`Máximo ${maxFiles} archivos permitidos`)
            return
        }

        const validFiles: File[] = []
        const errors: string[] = []

        for (const file of fileArray) {
            const validationError = validateFile(file)
            if (validationError) {
                errors.push(validationError)
            } else {
                // Evitar duplicados
                const isDuplicate = files.some(f => f.name === file.name && f.size === file.size)
                if (!isDuplicate) {
                    validFiles.push(file)
                }
            }
        }

        if (errors.length > 0) {
            setError(errors[0])
        }

        if (validFiles.length > 0) {
            onChange([...files, ...validFiles])
        }
    }, [files, maxFiles, onChange, validateFile])

    const removeFile = useCallback((index: number) => {
        const newFiles = files.filter((_, i) => i !== index)
        onChange(newFiles)
        setError(null)
    }, [files, onChange])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (disabled) return
        addFiles(e.dataTransfer.files)
    }, [addFiles, disabled])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        if (!disabled) setIsDragging(true)
    }, [disabled])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            addFiles(e.target.files)
        }
        // Reset input para permitir seleccionar el mismo archivo
        e.target.value = ''
    }, [addFiles])

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    }

    return (
        <div className="space-y-3">
            {/* Zona de drop */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                    relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200
                    ${disabled
                        ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                        : isDragging
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)] scale-[1.01]'
                            : 'border-gray-300 hover:border-[var(--color-primary)] hover:bg-gray-50 cursor-pointer'
                    }
                `}
            >
                <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={handleInputChange}
                    disabled={disabled}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />

                <div className="flex flex-col items-center gap-2">
                    <div className={`p-3 rounded-full ${isDragging ? 'bg-[var(--color-primary)]' : 'bg-gray-100'}`}>
                        <Upload
                            size={24}
                            className={isDragging ? 'text-white' : 'text-gray-400'}
                        />
                    </div>
                    <div>
                        <p className="font-medium text-[var(--color-text-primary)]">
                            {isDragging ? 'Suelta los archivos aquí' : 'Arrastra archivos PDF o haz clic'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            Máximo {maxFiles} archivos, {maxSizeMB}MB cada uno
                        </p>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle size={16} className="text-[var(--color-error)] flex-shrink-0" />
                    <p className="text-sm text-[var(--color-error)]">{error}</p>
                </div>
            )}

            {/* Lista de archivos */}
            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((file, index) => (
                        <div
                            key={`${file.name}-${file.size}`}
                            className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg group"
                        >
                            <div className="p-2 bg-red-100 rounded-lg">
                                <File size={18} className="text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-[var(--color-text-primary)] truncate">
                                    {file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {formatFileSize(file.size)}
                                </p>
                            </div>
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => removeFile(index)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                    title="Eliminar archivo"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default FileUpload
