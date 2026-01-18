/**
 * Modal de OCR para Anexo 8
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Permite pegar una imagen del portapapeles y extraer datos de recetas
 */

import { useState, useEffect, useRef } from 'react'
import { procesarImagenOcr } from '@/services/ocrAnexo8.service'
import { Anexo8OcrResult } from '@/types/anexo8.types'
import { LoadingSpinner } from '@/components/common'
import { FaTimes, FaPaste, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa'

interface OcrDialogProps {
    isOpen: boolean
    onClose: () => void
    onDataExtracted: (data: Anexo8OcrResult) => void
}

export function OcrDialog({ isOpen, onClose, onDataExtracted }: OcrDialogProps) {
    const [imagen, setImagen] = useState<string | null>(null)
    const [procesando, setProcesando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [resultado, setResultado] = useState<Anexo8OcrResult | null>(null)
    const pasteAreaRef = useRef<HTMLDivElement>(null)

    // Limpiar al cerrar
    useEffect(() => {
        if (!isOpen) {
            setImagen(null)
            setError(null)
            setResultado(null)
        }
    }, [isOpen])

    // Manejar pegado desde portapapeles
    const handlePaste = async (e: ClipboardEvent | React.ClipboardEvent) => {
        e.preventDefault()
        setError(null)

        const items = e.clipboardData?.items
        if (!items) return

        for (let i = 0; i < items.length; i++) {
            const item = items[i]

            if (item.type.startsWith('image/')) {
                const file = item.getAsFile()
                if (file) {
                    // Mostrar preview
                    const reader = new FileReader()
                    reader.onload = (e) => {
                        setImagen(e.target?.result as string)
                    }
                    reader.readAsDataURL(file)
                    return
                }
            }
        }

        setError('No se encontró una imagen en el portapapeles. Copia una imagen primero.')
    }

    // Agregar listener de paste al abrir
    useEffect(() => {
        if (isOpen) {
            const handleGlobalPaste = (e: ClipboardEvent) => {
                handlePaste(e)
            }
            document.addEventListener('paste', handleGlobalPaste)
            return () => document.removeEventListener('paste', handleGlobalPaste)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    // Procesar imagen con OCR
    const procesarImagen = async () => {
        if (!imagen) return

        setProcesando(true)
        setError(null)

        try {
            // Convertir data URL a base64 puro
            const base64 = imagen.split(',')[1]
            const mimeType = imagen.split(';')[0].split(':')[1]

            const result = await procesarImagenOcr(base64, mimeType)

            if (result.success && result.data) {
                setResultado(result.data)

                if (result.data.confidence < 30) {
                    setError('La confianza de extracción es baja. Verifique los datos.')
                }
            } else {
                setError(result.error || 'Error al procesar la imagen')
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
            onClose()
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white">Extraer datos con OCR</h2>
                        <p className="text-purple-200 text-sm">Pega una imagen de receta desde el portapapeles</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <FaTimes className="text-xl" />
                    </button>
                </div>

                {/* Contenido */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {!imagen ? (
                        // Área para pegar
                        <div
                            ref={pasteAreaRef}
                            className="border-2 border-dashed border-purple-300 rounded-xl p-12 text-center bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors"
                            onClick={() => pasteAreaRef.current?.focus()}
                            tabIndex={0}
                        >
                            <FaPaste className="text-5xl text-purple-400 mx-auto mb-4" />
                            <p className="text-lg font-medium text-purple-700">
                                Presiona Ctrl+V para pegar la imagen
                            </p>
                            <p className="text-sm text-purple-500 mt-2">
                                O copia una imagen y haz clic aquí
                            </p>
                        </div>
                    ) : (
                        // Preview de imagen
                        <div className="space-y-4">
                            <div className="relative">
                                <img
                                    src={imagen}
                                    alt="Receta a procesar"
                                    className="max-w-full rounded-lg border border-slate-200 shadow-md"
                                />
                                <button
                                    onClick={() => setImagen(null)}
                                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                                >
                                    <FaTimes size={14} />
                                </button>
                            </div>

                            {!resultado && (
                                <button
                                    onClick={procesarImagen}
                                    disabled={procesando}
                                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:bg-purple-400"
                                >
                                    {procesando ? (
                                        <>
                                            <LoadingSpinner size="sm" />
                                            Procesando con Document AI...
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
                                                    {resultado.medicoRegistro && ` (Reg. ${resultado.medicoRegistro})`}
                                                    {!resultado.medicoRegistro && resultado.medicoDocumento && ` (CC ${resultado.medicoDocumento})`}
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

export default OcrDialog
