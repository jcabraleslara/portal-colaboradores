import { useState, useCallback } from 'react'
import {
    X,
    FileText,
    User,
    Pill,
    Stethoscope,
    ExternalLink,
    Download,
    UserCheck,
    Activity
} from 'lucide-react'
import { Button } from '@/components/common'
import { Anexo8Record } from '@/types/anexo8.types'
import { generarAnexo8Pdf, descargarPdf } from '../pdfGenerator'
import { anexo8Service } from '@/services/anexo8.service'
import { isMobileOrTablet } from '@/utils/device.utils'
import { toast } from 'sonner'

interface Anexo8DetallePanelProps {
    registro: Anexo8Record
    onClose: () => void
}

export function Anexo8DetallePanel({ registro, onClose }: Anexo8DetallePanelProps) {
    // Estado del PDF
    const [pdfActivo, setPdfActivo] = useState<string | null>(null)
    const [descargando, setDescargando] = useState(false)

    // Handler para abrir PDF (similar a CasoDetallePanel)
    const handleAbrirPdf = useCallback(async () => {
        if (!registro.pdf_url) return

        try {
            // Refrescar URL firmada
            const urlFresca = await anexo8Service.refrescarUrlPdf(registro.pdf_url)

            // En móvil/tablet abrir directamente en nueva pestaña (visor nativo)
            if (isMobileOrTablet()) {
                window.open(urlFresca, '_blank', 'noopener,noreferrer')
                return
            }

            setPdfActivo(urlFresca)
        } catch (error) {
            console.error(error)
            toast.error('No se pudo cargar el PDF')
        }
    }, [registro.pdf_url])

    const handleDescargar = async () => {
        setDescargando(true)
        try {
            if (registro.pdf_url) {
                // Generamos una temporal firmada para descarga también
                const urlFresca = await anexo8Service.refrescarUrlPdf(registro.pdf_url)
                const link = document.createElement('a')
                link.href = urlFresca
                link.download = registro.pdf_nombre || `Anexo8_${registro.numero_recetario}.pdf`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                toast.success('Descarga iniciada')
            } else {
                toast.info('Generando PDF...')
                const { blob, filename } = await generarAnexo8Pdf(registro)
                descargarPdf(blob, filename)
                toast.success('PDF descargado')
            }
        } catch (error) {
            console.error(error)
            toast.error('Error al descargar el PDF')
        } finally {
            setDescargando(false)
        }
    }

    const formatFecha = (fecha: string) => {
        return new Date(fecha).toLocaleDateString('es-CO', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        })
    }

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Panel lateral */}
            <div className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-white shadow-2xl animate-slide-in-right overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-3xl font-bold text-blue-900">
                                {registro.paciente_nombres} {registro.paciente_apellido1}
                            </h2>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-sm font-mono bg-white px-2 py-1 rounded border border-gray-200">
                                    Recetario: <strong>{registro.numero_recetario}</strong>
                                </span>
                                <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-800">
                                    Anexo 8 (FNE)
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/80 transition-colors"
                        >
                            <X size={24} className="text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Contenido scrolleable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Sección Soportes (Estilo CasoDetallePanel) */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                            <FileText size={16} />
                            Soportes Adjuntos
                        </h3>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            <button
                                onClick={handleAbrirPdf}
                                className="flex-shrink-0 w-24 h-32 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl flex flex-col items-center justify-center hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
                            >
                                <FileText size={32} className="text-red-500 mb-2 group-hover:scale-110 transition-transform" />
                                <span className="text-xs text-red-700 font-medium text-center px-1">
                                    Ver PDF Original
                                </span>
                            </button>

                            <button
                                onClick={handleDescargar}
                                disabled={descargando}
                                className={`flex-shrink-0 w-24 h-32 bg-white border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center transition-all duration-200 group ${descargando ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 hover:bg-blue-50'}`}
                            >
                                <Download size={32} className="text-gray-400 mb-2 group-hover:text-blue-500" />
                                <span className="text-xs text-gray-500 font-medium text-center px-1 group-hover:text-blue-600">
                                    Descargar Copia
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

                    {/* Información GRID */}
                    <div className="grid grid-cols-2 gap-4">

                        {/* Paciente */}
                        <div className="flex items-start gap-3 col-span-2">
                            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                                <User size={18} className="text-purple-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-gray-500">Paciente</p>
                                <p className="font-medium text-gray-800">
                                    {registro.paciente_tipo_id} {registro.paciente_documento}
                                </p>
                                <div className="flex gap-2 mt-1 text-xs text-gray-600">
                                    <span className="bg-gray-100 px-2 py-0.5 rounded">{registro.paciente_edad} años</span>
                                    <span className="bg-gray-100 px-2 py-0.5 rounded">{registro.paciente_genero}</span>
                                    <span className="bg-gray-100 px-2 py-0.5 rounded">{registro.paciente_municipio}</span>
                                </div>
                            </div>
                        </div>

                        {/* Medicamento (Destacado) */}
                        <div className="col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <Pill size={18} className="text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-blue-600 font-medium">Medicamento Prescrito</p>
                                    <p className="text-lg font-bold text-blue-900">{registro.medicamento_nombre}</p>
                                    <p className="text-sm text-blue-800">
                                        {registro.medicamento_concentracion} - {registro.medicamento_forma_farmaceutica}
                                    </p>
                                    <div className="mt-2 text-sm text-blue-700 font-medium">
                                        Cantidad: {registro.cantidad_numero} ({registro.cantidad_letras})
                                    </div>
                                    {registro.medicamento_dosis_via && (
                                        <div className="mt-1 text-xs text-blue-600">
                                            {registro.medicamento_dosis_via}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Diagnóstico */}
                        <div className="col-span-2 flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                                <Activity size={18} className="text-orange-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Diagnóstico</p>
                                <p className="font-medium text-gray-800">
                                    <span className="font-mono bg-gray-100 px-1 rounded mr-1">{registro.diagnostico_cie10}</span>
                                    {registro.diagnostico_descripcion}
                                </p>
                            </div>
                        </div>

                        {/* Médico */}
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                                <Stethoscope size={18} className="text-teal-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Médico</p>
                                <p className="font-medium text-gray-800 text-sm">{registro.medico_nombres}</p>
                                <p className="text-xs text-gray-500">{registro.medico_especialidad}</p>
                            </div>
                        </div>

                        {/* Generado Por (Destacado) */}
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                <UserCheck size={18} className="text-indigo-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Generado Por</p>
                                <p className="font-medium text-indigo-700 text-sm">{registro.generado_por}</p>
                                <p className="text-xs text-gray-400">{formatFecha(registro.created_at)}</p>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end">
                    <Button variant="ghost" onClick={onClose}>
                        CerrarPanel
                    </Button>
                </div>
            </div>

            {/* Overlay Visor PDF (Reutilizando estilo CasoDetallePanel) */}
            {
                pdfActivo && (
                    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col animate-fade-in">
                        {/* Toolbar */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80">
                            <div className="flex items-center gap-4">
                                <span className="text-white font-medium">
                                    Visor de Anexo 8 - {registro.numero_recetario}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={pdfActivo}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                    title="Abrir en nueva pestaña"
                                >
                                    <ExternalLink size={20} className="text-white" />
                                </a>
                                <button
                                    onClick={() => setPdfActivo(null)}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                >
                                    <X size={20} className="text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Iframe del PDF */}
                        <div className="flex-1 p-4">
                            <iframe
                                src={`${pdfActivo}#view=FitH`}
                                className="w-full h-full rounded-lg bg-white"
                                title={`Soporte PDF`}
                            />
                        </div>
                    </div>
                )
            }

            <style>{`
                @keyframes slide-in-right {
                    from {
                        transform: translateX(100%);
                    }
                    to {
                        transform: translateX(0);
                    }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.3s ease-out;
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out;
                }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </>
    )
}
