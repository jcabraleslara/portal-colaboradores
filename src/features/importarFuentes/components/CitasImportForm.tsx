
import { useState } from 'react'
import { toast } from 'sonner'
import { FileDropzone } from './FileDropzone'
import { processCitasFile } from '../services/importService'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

export default function CitasImportForm() {
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [progress, setProgress] = useState<string>('')
    const [result, setResult] = useState<{ success: number; errors: number } | null>(null)

    const handleProcess = async () => {
        if (!file) return

        try {
            setIsProcessing(true)
            setProgress('Analizando archivo...')
            setResult(null)

            const stats = await processCitasFile(file, (msg) => setProgress(msg))

            setResult(stats)
            toast.success(`Proceso completado: ${stats.success} registros importados.`)
        } catch (error: any) {
            console.error('Error importing file:', error)
            toast.error(error.message || 'Error al procesar el archivo')
        } finally {
            setIsProcessing(false)
            setProgress('')
        }
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-slate-800">
                    Importar Citas
                </h3>
                <p className="text-slate-500">
                    Sube el archivo .xls (HTML) exportado del sistema fuente.
                </p>
            </div>

            <FileDropzone
                onFileSelected={setFile}
                label="Arrastra el archivo Informe_citas.xls aquí"
                isProcessing={isProcessing}
            />

            {file && !result && (
                <div className="flex justify-center pt-4">
                    <button
                        onClick={handleProcess}
                        disabled={isProcessing}
                        className="btn btn-primary min-w-[200px] flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                {progress || 'Procesando...'}
                            </>
                        ) : (
                            'Iniciar Importación'
                        )}
                    </button>
                </div>
            )}

            {result && (
                <div className={`p-4 rounded-xl border ${result.errors > 0 ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'} flex items-start gap-3`}>
                    {result.errors > 0 ? <AlertCircle className="text-orange-500 mt-0.5" /> : <CheckCircle2 className="text-green-500 mt-0.5" />}
                    <div>
                        <h4 className={`font-semibold ${result.errors > 0 ? 'text-orange-800' : 'text-green-800'}`}>
                            Resultado de la importación
                        </h4>
                        <p className="text-sm text-slate-600 mt-1">
                            Se procesaron correctamente <strong>{result.success}</strong> registros.
                            {result.errors > 0 && <span className="block mt-1 text-orange-600">Hubo {result.errors} errores (revisar consola para detalles).</span>}
                        </p>
                        <button
                            onClick={() => { setFile(null); setResult(null); }}
                            className="text-sm font-medium underline mt-2 hover:opacity-80"
                        >
                            Importar otro archivo
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
