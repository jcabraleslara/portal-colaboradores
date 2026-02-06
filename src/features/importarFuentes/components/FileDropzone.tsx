
import { useCallback, useState } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
import { UploadCloud, File as FileIcon, X } from 'lucide-react'
import { toast } from 'sonner'

interface FileDropzoneProps {
    onFileSelected: (file: File) => void
    acceptedFileTypes?: Record<string, string[]>
    maxSize?: number // in bytes
    label?: string
    isProcessing?: boolean
}

export function FileDropzone({
    onFileSelected,
    acceptedFileTypes = {
        'text/html': ['.xls'],
        'application/vnd.ms-excel': ['.xls'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxSize = 10 * 1024 * 1024, // 10MB default
    label = 'Arrastra tu archivo aquí o haz clic para buscar',
    isProcessing = false
}: FileDropzoneProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
        if (fileRejections.length > 0) {
            const error = fileRejections[0].errors[0]
            if (error.code === 'file-too-large') {
                toast.error('El archivo es demasiado grande.')
            } else if (error.code === 'file-invalid-type') {
                toast.error('Tipo de archivo no válido.')
            } else {
                toast.error('Error al cargar el archivo.')
            }
            return
        }

        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0]
            setSelectedFile(file)
            onFileSelected(file)
        }
    }, [onFileSelected])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: acceptedFileTypes,
        maxSize,
        maxFiles: 1,
        disabled: isProcessing
    })

    const removeFile = (e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedFile(null)
    }

    if (selectedFile) {
        return (
            <div className="relative p-6 border-2 border-primary-200 bg-primary-50 rounded-2xl flex items-center justify-between group transition-all duration-200">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-xl shadow-sm text-primary-600">
                        <FileIcon size={24} />
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700">{selectedFile.name}</p>
                        <p className="text-xs text-slate-500">
                            {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                    </div>
                </div>
                {!isProcessing && (
                    <button
                        onClick={removeFile}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl transition-all"
                        title="Eliminar archivo"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>
        )
    }

    return (
        <div
            {...getRootProps()}
            className={`
                relative cursor-pointer p-10 border-2 border-dashed rounded-2xl transition-all duration-200 text-center
                ${isDragActive
                    ? 'border-primary-500 bg-primary-50/50 scale-[1.01]'
                    : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50/50'
                }
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
            `}
        >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
                <div className={`
                    p-4 rounded-full transition-colors duration-200
                    ${isDragActive ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-400'}
                `}>
                    <UploadCloud size={32} />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-700 text-lg mb-1">
                        {isDragActive ? '¡Suelta el archivo aquí!' : 'Sube tu archivo'}
                    </h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
                        {label}
                    </p>
                </div>
            </div>
        </div>
    )
}
