
import { useState } from 'react'
import { toast } from 'sonner'
import { FileDropzone } from './FileDropzone'
import { processCitasFile } from '../services/importService'
import { CheckCircle2, AlertCircle, UploadCloud, Play } from 'lucide-react'

export default function CitasImportForm() {
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [progressStatus, setProgressStatus] = useState<string>('')
    const [progressPercent, setProgressPercent] = useState<number>(0)
    const [result, setResult] = useState<{ success: number; errors: number } | null>(null)

    const handleProcess = async () => {
        if (!file) return

        try {
            setIsProcessing(true)
            setProgressPercent(0)
            setResult(null)

            const stats = await processCitasFile(file, (msg, pct) => {
                setProgressStatus(msg)
                if (pct !== undefined) setProgressPercent(pct)
            })

            setResult(stats)
            if (stats.errors === 0) {
                toast.success(`Exito: ${stats.success} registros importados.`)
            } else if (stats.success > 0) {
                toast.warning(`Completado con advertencias: ${stats.success} importados, ${stats.errors} fallidos.`)
            } else {
                toast.error(`Error en importación. Verifique el archivo.`)
            }
        } catch (error: any) {
            console.error('Error importing file:', error)
            toast.error(error.message || 'Error al procesar el archivo')
        } finally {
            setIsProcessing(false)
            setProgressStatus('')
        }
    }

    // Calcular color de la barra según estado
    const getProgressColor = () => {
        if (progressPercent < 30) return 'bg-blue-500'
        if (progressPercent < 70) return 'bg-indigo-500'
        return 'bg-green-500'
    }

    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-in slide-in-from-bottom-4 duration-700">

            {/* Header Section */}
            <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 shadow-sm mb-2">
                    <UploadCloud className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                    Importación de Citas
                </h3>
                <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
                    Actualiza la base de datos subiendo el informe mensual.
                    El sistema validará y sincronizará los registros automáticamente.
                </p>
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
                {/* Decorative blob */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="space-y-8 relative z-10">
                    <FileDropzone
                        onFileSelected={(f) => {
                            setFile(f)
                            setResult(null)
                            setProgressPercent(0)
                        }}
                        label="Arrastra el archivo Informe_citas.xls aquí"
                        isProcessing={isProcessing}
                        maxSize={200 * 1024 * 1024} // 200MB
                    />

                    {/* Actions Area */}
                    <div className="transition-all duration-500 ease-in-out">
                        {isProcessing ? (
                            <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <div className="flex justify-between text-sm font-medium text-slate-700">
                                    <span>{progressStatus || 'Iniciando...'}</span>
                                    <span>{progressPercent}%</span>
                                </div>
                                <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-300 ease-out shadow-sm ${getProgressColor()}`}
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                                <p className="text-xs text-slate-400 text-center animate-pulse">
                                    Por favor espere, esto puede tomar unos momentos...
                                </p>
                            </div>
                        ) : (
                            file && !result && (
                                <div className="flex justify-center pt-2">
                                    <button
                                        onClick={handleProcess}
                                        className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 font-semibold text-white transition-all duration-300 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl hover:from-indigo-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <Play className="w-5 h-5 fill-current opacity-90" />
                                        <span className="text-lg">Iniciar Importación</span>
                                        <div className="absolute inset-0 rounded-xl ring-2 ring-white/20 group-hover:ring-white/30 transition-all" />
                                    </button>
                                </div>
                            )
                        )}
                    </div>

                    {/* Results Section */}
                    {result && (
                        <div className={`p-6 rounded-2xl border animate-in fade-in zoom-in-95 duration-500 ${result.errors > 0
                            ? 'bg-orange-50/50 border-orange-100'
                            : 'bg-emerald-50/50 border-emerald-100'
                            }`}>
                            <div className="flex items-start gap-4">
                                <div className={`p-2 rounded-full shrink-0 ${result.errors > 0 ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'
                                    }`}>
                                    {result.errors > 0 ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
                                </div>

                                <div className="flex-1 space-y-1">
                                    <h4 className={`text-lg font-bold ${result.errors > 0 ? 'text-orange-900' : 'text-emerald-900'
                                        }`}>
                                        {result.errors > 0 ? 'Proceso completado con observaciones' : '¡Importación Exitosa!'}
                                    </h4>

                                    <div className="grid grid-cols-2 gap-4 mt-4 mb-2">
                                        <div className="bg-white/60 p-3 rounded-lg border border-black/5">
                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Exitosos</p>
                                            <p className="text-2xl font-bold text-slate-700">{result.success}</p>
                                        </div>
                                        <div className="bg-white/60 p-3 rounded-lg border border-black/5">
                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Fallidos</p>
                                            <p className={`text-2xl font-bold ${result.errors > 0 ? 'text-orange-600' : 'text-slate-700'}`}>
                                                {result.errors}
                                            </p>
                                        </div>
                                    </div>

                                    {result.errors > 0 && (
                                        <p className="text-sm text-orange-700 bg-orange-100/50 p-2 rounded-lg mt-2 inline-flex items-center gap-2">
                                            <AlertCircle size={14} />
                                            Algunos registros no pudieron guardarse. Revisa la consola para más detalles.
                                        </p>
                                    )}

                                    <div className="pt-4">
                                        <button
                                            onClick={() => { setFile(null); setResult(null); setProgressPercent(0); }}
                                            className="text-sm font-medium text-slate-600 hover:text-indigo-600 underline decoration-indigo-200 hover:decoration-indigo-500 underline-offset-4 transition-all"
                                        >
                                            Importar un nuevo archivo
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <p className="text-center text-xs text-slate-400">
                Sistema de Colaboradores v2.0 • Datos seguros y encriptados
            </p>
        </div>
    )
}
