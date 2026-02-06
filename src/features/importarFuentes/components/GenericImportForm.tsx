/**
 * Formulario genérico de importación
 * Funciona con cualquier fuente configurada
 */

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Play, ArrowLeft, AlertTriangle } from 'lucide-react'
import { FileDropzone } from './FileDropzone'
import { ImportProgress } from './ImportProgress'
import { ImportResults } from './ImportResults'
import { getImportProcessor } from '../services'
import type { ImportSourceConfig, ImportResult } from '../types/import.types'

interface GenericImportFormProps {
    source: ImportSourceConfig
    onBack: () => void
}

export function GenericImportForm({ source, onBack }: GenericImportFormProps) {
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [progressStatus, setProgressStatus] = useState('')
    const [progressPercent, setProgressPercent] = useState(0)
    const [result, setResult] = useState<ImportResult | null>(null)

    const { icon: Icon, gradient, name, description, expectedFileName, status } = source

    // Obtener el procesador para esta fuente
    const processor = getImportProcessor(source.id)
    const isImplemented = !!processor && status === 'active'

    const handleFileSelected = useCallback((selectedFile: File) => {
        setFile(selectedFile)
        setResult(null)
        setProgressPercent(0)
    }, [])

    const handleProcess = async () => {
        if (!file || !processor) return

        try {
            setIsProcessing(true)
            setProgressPercent(0)
            setResult(null)

            const stats = await processor(file, (msg, pct) => {
                setProgressStatus(msg)
                if (pct !== undefined) setProgressPercent(pct)
            })

            setResult(stats)

            // Notificaciones según resultado
            if (stats.errors === 0) {
                toast.success(`${stats.success} registros importados en ${stats.duration}`)
            } else if (stats.success > 0) {
                toast.warning(`${stats.success} importados, ${stats.errors} fallidos`)
            } else {
                toast.error('Error en importación. Verifique el archivo.')
            }
        } catch (error: unknown) {
            console.error('Error importing file:', error)
            const message = error instanceof Error ? error.message : 'Error al procesar el archivo'
            toast.error(message)
        } finally {
            setIsProcessing(false)
            setProgressStatus('')
        }
    }

    const handleReset = useCallback(() => {
        setFile(null)
        setResult(null)
        setProgressPercent(0)
    }, [])

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Back button */}
            <button
                onClick={onBack}
                disabled={isProcessing}
                className="
                    inline-flex items-center gap-2 text-sm font-medium
                    text-slate-500 hover:text-indigo-600
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors duration-200
                "
            >
                <ArrowLeft size={16} />
                Volver a fuentes
            </button>

            {/* Header Section */}
            <div className="text-center space-y-4">
                <div
                    className={`
                        inline-flex items-center justify-center w-20 h-20
                        rounded-2xl bg-gradient-to-br ${gradient.from} ${gradient.to}
                        shadow-lg mb-2
                    `}
                >
                    <Icon className="w-10 h-10 text-white" strokeWidth={1.5} />
                </div>
                <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                    {name}
                </h3>
                <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
                    {description}
                </p>
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
                {/* Decorative gradient blob */}
                <div
                    className={`
                        absolute top-0 right-0 w-64 h-64
                        bg-gradient-to-br ${gradient.from} ${gradient.to}
                        opacity-5 rounded-full blur-3xl
                        -translate-y-1/2 translate-x-1/2 pointer-events-none
                    `}
                />

                <div className="space-y-8 relative z-10">
                    {/* Not implemented warning */}
                    {!isImplemented && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                            <div>
                                <h4 className="font-semibold text-amber-800">
                                    Fuente no disponible
                                </h4>
                                <p className="text-sm text-amber-700 mt-1">
                                    Esta fuente de importación aún no está implementada.
                                    Próximamente estará disponible.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Dropzone */}
                    {isImplemented && (
                        <>
                            <FileDropzone
                                onFileSelected={handleFileSelected}
                                label={`Arrastra el archivo ${expectedFileName || ''} aquí`}
                                isProcessing={isProcessing}
                                acceptedFileTypes={source.acceptedFileTypes}
                                maxSize={source.maxFileSize}
                            />

                            {/* Progress or Action button */}
                            <div className="transition-all duration-500 ease-in-out">
                                {isProcessing ? (
                                    <ImportProgress
                                        status={progressStatus}
                                        percentage={progressPercent}
                                        isProcessing={isProcessing}
                                    />
                                ) : (
                                    file && !result && (
                                        <div className="flex justify-center pt-2">
                                            <button
                                                onClick={handleProcess}
                                                className={`
                                                    group relative inline-flex items-center justify-center gap-3
                                                    px-8 py-4 font-semibold text-white
                                                    transition-all duration-300
                                                    bg-gradient-to-r ${gradient.from} ${gradient.to}
                                                    rounded-xl shadow-lg shadow-indigo-500/30
                                                    hover:shadow-indigo-500/50 hover:scale-[1.02]
                                                    active:scale-[0.98]
                                                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                                                `}
                                            >
                                                <Play className="w-5 h-5 fill-current opacity-90" />
                                                <span className="text-lg">Iniciar Importación</span>
                                                <div className="absolute inset-0 rounded-xl ring-2 ring-white/20 group-hover:ring-white/30 transition-all" />
                                            </button>
                                        </div>
                                    )
                                )}
                            </div>

                            {/* Results */}
                            {result && (
                                <ImportResults
                                    result={result}
                                    sourceName={name}
                                    onReset={handleReset}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>

            <p className="text-center text-xs text-slate-400">
                Sistema de Colaboradores v2.0 • Datos seguros y encriptados
            </p>
        </div>
    )
}
