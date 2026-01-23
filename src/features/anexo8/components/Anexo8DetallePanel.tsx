import { useState } from 'react'
import {
    X,
    FileText,
    User,
    Calendar,
    Pill,
    Stethoscope,
    ExternalLink,
    Maximize2,
    Minimize2,
    Download,
    UserCheck
} from 'lucide-react'
import { Button } from '@/components/common'
import { Anexo8Record } from '@/types/anexo8.types'
import { generarAnexo8Pdf, descargarPdf } from '../pdfGenerator'
import { toast } from 'sonner'

interface Anexo8DetallePanelProps {
    registro: Anexo8Record
    onClose: () => void
}

export function Anexo8DetallePanel({ registro, onClose }: Anexo8DetallePanelProps) {
    const [pdfFullscreen, setPdfFullscreen] = useState(false)
    const [descargando, setDescargando] = useState(false)

    const handleDescargar = async () => {
        setDescargando(true)
        try {
            if (registro.pdf_url) {
                window.open(registro.pdf_url, '_blank')
                toast.success('Abriendo PDF...')
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
            <div className="fixed right-0 top-0 z-50 h-full w-full max-w-4xl bg-white shadow-2xl animate-slide-in-right overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-red-50 to-white">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-3xl font-bold text-red-700">
                                {registro.paciente_nombres} {registro.paciente_apellido1}
                            </h2>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-sm font-mono bg-white px-2 py-1 rounded border border-gray-200">
                                    Recetario: <strong>{registro.numero_recetario}</strong>
                                </span>
                                <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700">
                                    Anexo 8 - FNE
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

                {/* Contenido - Panel dividido */}
                <div className="flex-1 overflow-hidden flex">
                    {/* COLUMNA IZQUIERDA: Información */}
                    <div className="w-1/2 overflow-y-auto p-6 space-y-6 border-r border-gray-100">
                        {/* Información del Paciente */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                                <User size={16} />
                                Información del Paciente
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500">Documento</p>
                                    <p className="font-medium text-gray-800">
                                        {registro.paciente_tipo_id} {registro.paciente_documento}
                                    </p>
                                </div>
                                {registro.paciente_edad && (
                                    <div>
                                        <p className="text-xs text-gray-500">Edad</p>
                                        <p className="font-medium text-gray-800">{registro.paciente_edad} años</p>
                                    </div>
                                )}
                                {registro.paciente_genero && (
                                    <div>
                                        <p className="text-xs text-gray-500">Género</p>
                                        <p className="font-medium text-gray-800">
                                            {registro.paciente_genero === 'F' ? 'Femenino' : 'Masculino'}
                                        </p>
                                    </div>
                                )}
                                {registro.paciente_eps && (
                                    <div>
                                        <p className="text-xs text-gray-500">EPS</p>
                                        <p className="font-medium text-gray-800">{registro.paciente_eps}</p>
                                    </div>
                                )}
                                {registro.paciente_municipio && (
                                    <div className="col-span-2">
                                        <p className="text-xs text-gray-500">Municipio</p>
                                        <p className="font-medium text-gray-800">{registro.paciente_municipio}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Medicamento */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                                <Pill size={16} />
                                Medicamento
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-gray-500">Nombre Genérico</p>
                                    <p className="font-semibold text-lg text-gray-900">{registro.medicamento_nombre}</p>
                                </div>
                                {registro.medicamento_concentracion && (
                                    <div>
                                        <p className="text-xs text-gray-500">Concentración</p>
                                        <p className="font-medium text-gray-800">{registro.medicamento_concentracion}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs text-gray-500">Forma Farmacéutica</p>
                                    <p className="font-medium text-gray-800">{registro.medicamento_forma_farmaceutica}</p>
                                </div>
                                {registro.medicamento_dosis_via && (
                                    <div>
                                        <p className="text-xs text-gray-500">Dosis / Vía de Administración</p>
                                        <p className="font-medium text-gray-800">{registro.medicamento_dosis_via}</p>
                                    </div>
                                )}
                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <p className="text-xs text-blue-600 mb-1">Cantidad Prescrita</p>
                                    <p className="font-bold text-2xl text-blue-700">{registro.cantidad_numero}</p>
                                    <p className="text-sm text-blue-600 italic">{registro.cantidad_letras}</p>
                                </div>
                            </div>
                        </div>

                        {/* Diagnóstico */}
                        {registro.diagnostico_cie10 && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-600 mb-3">Diagnóstico</h3>
                                <div className="space-y-2">
                                    <div>
                                        <p className="text-xs text-gray-500">Código CIE-10</p>
                                        <p className="font-mono font-medium text-gray-800">{registro.diagnostico_cie10}</p>
                                    </div>
                                    {registro.diagnostico_descripcion && (
                                        <div>
                                            <p className="text-xs text-gray-500">Descripción</p>
                                            <p className="font-medium text-gray-800">{registro.diagnostico_descripcion}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Médico Prescriptor */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                                <Stethoscope size={16} />
                                Médico Prescriptor
                            </h3>
                            <div className="space-y-2">
                                <div>
                                    <p className="text-xs text-gray-500">Nombre</p>
                                    <p className="font-semibold text-gray-900">{registro.medico_nombres}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Documento</p>
                                    <p className="font-medium text-gray-800">{registro.medico_documento}</p>
                                </div>
                                {registro.medico_especialidad && (
                                    <div>
                                        <p className="text-xs text-gray-500">Especialidad</p>
                                        <p className="font-medium text-gray-800">{registro.medico_especialidad}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Generado Por */}
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <h3 className="text-sm font-semibold text-purple-700 mb-2 flex items-center gap-2">
                                <UserCheck size={16} />
                                Información de Generación
                            </h3>
                            <div className="space-y-2">
                                <div>
                                    <p className="text-xs text-purple-600">Generado por</p>
                                    <p className="font-semibold text-purple-900">{registro.generado_por}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-purple-600">Fecha de Generación</p>
                                    <p className="font-medium text-purple-800">
                                        {formatFecha(registro.created_at)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Fechas */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                                <Calendar size={16} />
                                Fechas
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500">Fecha de Prescripción</p>
                                    <p className="font-medium text-gray-800">{formatFecha(registro.fecha_prescripcion)}</p>
                                </div>
                                {registro.total_meses_formula > 1 && (
                                    <div>
                                        <p className="text-xs text-gray-500">Fórmula Posfechada</p>
                                        <p className="font-medium text-gray-800">
                                            Mes {registro.mes_posfechado} de {registro.total_meses_formula}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* COLUMNA DERECHA: Visor PDF */}
                    <div className="w-1/2 flex flex-col bg-gray-50">
                        {/* Toolbar del PDF */}
                        <div className="px-4 py-3 bg-gray-900 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText size={18} className="text-white" />
                                <span className="text-white font-medium text-sm">Vista Previa del PDF</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleDescargar}
                                    disabled={descargando}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors"
                                    title="Descargar PDF"
                                >
                                    <Download size={18} className="text-white" />
                                </button>
                                {registro.pdf_url && (
                                    <a
                                        href={registro.pdf_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                        title="Abrir en nueva pestaña"
                                    >
                                        <ExternalLink size={18} className="text-white" />
                                    </a>
                                )}
                                <button
                                    onClick={() => setPdfFullscreen(!pdfFullscreen)}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                    title={pdfFullscreen ? 'Reducir' : 'Maximizar'}
                                >
                                    {pdfFullscreen ? (
                                        <Minimize2 size={18} className="text-white" />
                                    ) : (
                                        <Maximize2 size={18} className="text-white" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* iframe del PDF */}
                        <div className="flex-1 p-4">
                            {registro.pdf_url ? (
                                <iframe
                                    src={`${registro.pdf_url}#view=FitH`}
                                    className="w-full h-full rounded-lg bg-white shadow-inner"
                                    title={`Anexo 8 - ${registro.numero_recetario}`}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-white rounded-lg border-2 border-dashed border-gray-300">
                                    <div className="text-center">
                                        <FileText size={48} className="text-gray-400 mx-auto mb-3" />
                                        <p className="text-gray-500 font-medium">PDF no disponible</p>
                                        <p className="text-xs text-gray-400 mt-1">Puedes regenerarlo con el botón de descarga</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end">
                    <Button variant="secondary" onClick={onClose}>
                        Cerrar
                    </Button>
                </div>
            </div>

            {/* Visor Fullscreen (si se activa) */}
            {pdfFullscreen && registro.pdf_url && (
                <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col animate-fade-in">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80">
                        <span className="text-white font-medium">
                            {registro.numero_recetario} - {registro.paciente_nombres} {registro.paciente_apellido1}
                        </span>
                        <div className="flex items-center gap-2">
                            <a
                                href={registro.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                            >
                                <ExternalLink size={20} className="text-white" />
                            </a>
                            <button
                                onClick={() => setPdfFullscreen(false)}
                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                            >
                                <X size={20} className="text-white" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 p-4">
                        <iframe
                            src={`${registro.pdf_url}#view=FitH`}
                            className="w-full h-full rounded-lg bg-white"
                            title={`Anexo 8 Fullscreen - ${registro.numero_recetario}`}
                        />
                    </div>
                </div>
            )}

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
