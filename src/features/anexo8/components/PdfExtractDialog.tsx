/**
 * Diálogo de Extracción de PDF para Anexo 8
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Permite seleccionar un PDF de fórmula médica y extraer datos automáticamente
 */

import { useState, useRef } from 'react'
import { extraerDatosPdf } from '@/services/pdfExtractAnexo8.service'
import { Anexo8OcrResult } from '@/types/anexo8.types'
import { LoadingSpinner } from '@/components/common'
import { FaTimes, FaFilePdf, FaCheckCircle, FaExclamationTriangle, FaUpload } from 'react-icons/fa'

interface PdfExtractDialogProps {
    isOpen: boolean
    onClose: () => void
    onDataExtracted: (data: Anexo8OcrResult) => void
}

export function PdfExtractDialog({ isOpen, onClose, onDataExtracted }: PdfExtractDialogProps) {
    const [archivo, setArchivo] = useState<File | null>(null)
    const [procesando, setProcesando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [resultado, setResultado] = useState<Anexo8OcrResult | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Limpiar al cerrar
    const handleClose = () => {
        setArchivo(null)
        setError(null)
        setResultado(null)
        setProcesando(false)
        onClose()
    }

    // Manejar selección de archivo
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setArchivo(file)
            setError(null)
            setResultado(null)
        }
    }

    // Manejar arrastrar y soltar
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file && file.type === 'application/pdf') {
            setArchivo(file)
            setError(null)
            setResultado(null)
        } else {
            setError('Por favor arrastra un archivo PDF')
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    // Procesar PDF
    const procesarPdf = async () => {
        if (!archivo) return

        setProcesando(true)
        setError(null)

        try {
            const result = await extraerDatosPdf(archivo)

            if (result.success && result.data) {
                setResultado(result.data)

                if (result.data.confidence < 30) {
                    setError('La confianza de extracción es baja. Verifique los datos.')
                }
            } else {
                setError(result.error || 'Error al procesar el PDF')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido')
        }

        setProcesando(false)
    }

    // Aplicar datos extraídos
    const aplicarDatos = () => {
        if (resultado) {
            onDataExtracted(resultado)
            handleClose()
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <FaFilePdf />
                            Extraer datos desde PDF
                        </h2>
                        <p className="text-blue-200 text-sm">Selecciona el PDF de la fórmula médica</p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <FaTimes className="text-xl" />
                    </button>
                </div>

                {/* Contenido */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {!archivo ? (
                        // Área para arrastrar o seleccionar PDF
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-blue-300 rounded-xl p-12 text-center bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
                        >
                            <FaUpload className="text-5xl text-blue-400 mx-auto mb-4" />
                            <p className="text-lg font-medium text-blue-700">
                                Arrastra el PDF aquí o haz clic para seleccionar
                            </p>
                            <p className="text-sm text-blue-500 mt-2">
                                Solo archivos PDF (máximo 5MB)
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="application/pdf"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                        </div>
                    ) : (
                        // PDF seleccionado
                        <div className="space-y-4">
                            <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <FaFilePdf className="text-3xl text-red-500" />
                                    <div>
                                        <p className="font-medium text-slate-800">{archivo.name}</p>
                                        <p className="text-sm text-slate-500">
                                            {(archivo.size / 1024).toFixed(2)} KB
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setArchivo(null)}
                                    className="text-red-500 hover:text-red-600 transition-colors"
                                >
                                    <FaTimes size={20} />
                                </button>
                            </div>

                            {!resultado && (
                                <button
                                    onClick={procesarPdf}
                                    disabled={procesando}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:bg-blue-400"
                                >
                                    {procesando ? (
                                        <>
                                            <LoadingSpinner size="sm" />
                                            Extrayendo datos del PDF...
                                        </>
                                    ) : (
                                        'Extraer datos'
                                    )}
                                </button>
                            )}

                            {/* Resultados */}
                            {resultado && (
                                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-slate-700">Datos extraídos</h3>
                                        <span className={`px-2 py-1 rounded text-sm font-medium ${resultado.confidence >= 60
                                            ? 'bg-green-100 text-green-700'
                                            : resultado.confidence >= 30
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-red-100 text-red-700'
                                            }`}>
                                            {resultado.confidence}% confianza
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {resultado.pacienteDocumento && (
                                            <div>
                                                <span className="text-slate-500">Documento:</span>
                                                <span className="ml-2 font-medium">{resultado.pacienteDocumento}</span>
                                            </div>
                                        )}
                                        {resultado.pacienteNombres && (
                                            <div>
                                                <span className="text-slate-500">Nombres:</span>
                                                <span className="ml-2 font-medium">{resultado.pacienteNombres}</span>
                                            </div>
                                        )}
                                        {resultado.pacienteEdad && (
                                            <div>
                                                <span className="text-slate-500">Edad:</span>
                                                <span className="ml-2 font-medium">{resultado.pacienteEdad} años</span>
                                            </div>
                                        )}
                                        {resultado.medicamentoNombre && (
                                            <div>
                                                <span className="text-slate-500">Medicamento:</span>
                                                <span className="ml-2 font-medium text-amber-600">{resultado.medicamentoNombre}</span>
                                            </div>
                                        )}
                                        {resultado.concentracion && (
                                            <div>
                                                <span className="text-slate-500">Concentración:</span>
                                                <span className="ml-2 font-medium">{resultado.concentracion}</span>
                                            </div>
                                        )}
                                        {resultado.formaFarmaceutica && (
                                            <div>
                                                <span className="text-slate-500">Forma:</span>
                                                <span className="ml-2 font-medium">{resultado.formaFarmaceutica}</span>
                                            </div>
                                        )}
                                        {resultado.cantidadNumero && (
                                            <div>
                                                <span className="text-slate-500">Cantidad:</span>
                                                <span className="ml-2 font-medium">{resultado.cantidadNumero}</span>
                                            </div>
                                        )}
                                        {resultado.diasTratamiento && (
                                            <div>
                                                <span className="text-slate-500">Días:</span>
                                                <span className="ml-2 font-medium">{resultado.diasTratamiento}</span>
                                            </div>
                                        )}
                                        {resultado.mesesTratamiento && (
                                            <div className="col-span-2">
                                                <span className="text-slate-500">Tratamiento:</span>
                                                <span className="ml-2 font-medium text-blue-600">
                                                    {resultado.mesesTratamiento} {resultado.mesesTratamiento === 1 ? 'mes' : 'meses'}
                                                    {resultado.cantidadPorMes && ` (${resultado.cantidadPorMes} por mes)`}
                                                </span>
                                            </div>
                                        )}
                                        {resultado.dosisVia && (
                                            <div className="col-span-2">
                                                <span className="text-slate-500">Posología:</span>
                                                <span className="ml-2 font-medium text-purple-600">{resultado.dosisVia}</span>
                                            </div>
                                        )}
                                        {resultado.medicoNombre && (
                                            <div className="col-span-2">
                                                <span className="text-slate-500">Médico:</span>
                                                <span className="ml-2 font-medium text-indigo-600">
                                                    {resultado.medicoNombre}
                                                    {resultado.medicoDocumento && ` (${resultado.medicoDocumento})`}
                                                </span>
                                            </div>
                                        )}
                                        {resultado.diagnosticoCie10 && (
                                            <div className="col-span-2">
                                                <span className="text-slate-500">Diagnóstico:</span>
                                                <span className="ml-2 font-medium">
                                                    {resultado.diagnosticoCie10}
                                                    {resultado.diagnosticoDescripcion && ` - ${resultado.diagnosticoDescripcion}`}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={aplicarDatos}
                                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <FaCheckCircle />
                                        Aplicar datos al formulario
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                            <FaExclamationTriangle className="text-amber-500 mt-0.5" />
                            <p className="text-sm text-amber-700">{error}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default PdfExtractDialog
