import { useState, useEffect, useCallback } from 'react'
import {
    Search,
    Loader2,
    Calendar,
    Download,
    Trash2,
    FileSpreadsheet
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { Card, Button, Input, Autocomplete } from '@/components/common'
import { anexo8Service } from '@/services/anexo8.service'
import { Anexo8Record, Anexo8Filtros, MEDICAMENTOS_CONTROLADOS } from '@/types/anexo8.types'
import { generarAnexo8Pdf, descargarPdf } from '../pdfGenerator'
import { Anexo8DetallePanel } from './Anexo8DetallePanel'

const ITEMS_POR_PAGINA = 10

export function Anexo8HistoryTab() {
    // ============================================
    // ESTADO
    // ============================================
    const [registros, setRegistros] = useState<Anexo8Record[]>([])
    const [total, setTotal] = useState(0)
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [descargandoId, setDescargandoId] = useState<string | null>(null)
    const [registroSeleccionado, setRegistroSeleccionado] = useState<Anexo8Record | null>(null)

    // Filtros
    const [filtros, setFiltros] = useState<Anexo8Filtros>({})
    const [busquedaInput, setBusquedaInput] = useState('')
    const [medicamentoFiltro, setMedicamentoFiltro] = useState('')
    const [medicoFiltro, setMedicoFiltro] = useState('')
    const [exportando, setExportando] = useState(false)

    // Paginación
    const [paginaActual, setPaginaActual] = useState(0)

    // ============================================
    // CARGA DE DATOS
    // ============================================
    const cargarDatos = useCallback(async () => {
        setCargando(true)
        setError(null)

        try {
            const offset = paginaActual * ITEMS_POR_PAGINA

            // Construir filtros incluyendo inputs de búsqueda
            const filtrosActuales: Anexo8Filtros = { ...filtros }
            if (busquedaInput) {
                filtrosActuales.pacienteDocumento = busquedaInput
            }
            if (medicamentoFiltro) {
                filtrosActuales.medicamento = medicamentoFiltro
            }
            if (medicoFiltro) {
                filtrosActuales.medicoNombres = medicoFiltro
            }

            const result = await anexo8Service.obtenerHistorialPaginado(
                filtrosActuales,
                offset,
                ITEMS_POR_PAGINA
            )

            if (result.success && result.data) {
                setRegistros(result.data.soportes)
                setTotal(result.data.total)
            } else {
                setError(result.error || 'Error cargando historial')
                setRegistros([])
                setTotal(0)
            }
        } catch (err) {
            console.error(err)
            setError('Error de conexión')
        } finally {
            setCargando(false)
        }
    }, [filtros, paginaActual, busquedaInput, medicamentoFiltro, medicoFiltro])

    // Cargar al montar y cuando cambien dependencias
    useEffect(() => {
        const timer = setTimeout(() => {
            cargarDatos()
        }, 300) // Debounce para búsqueda

        return () => clearTimeout(timer)
    }, [cargarDatos])

    // ============================================
    // HANDLERS
    // ============================================
    const handleBuscar = (e: React.FormEvent) => {
        e.preventDefault()
        setPaginaActual(0)
        cargarDatos()
    }

    const handleLimpiarBusqueda = () => {
        setBusquedaInput('')
        setMedicamentoFiltro('')
        setMedicoFiltro('')
        setFiltros({})
        setPaginaActual(0)
    }

    const handleDescargarPdf = async (registro: Anexo8Record) => {
        if (descargandoId) return

        try {
            setDescargandoId(registro.id)

            // Si ya tiene URL de PDF, intentar descargarla
            if (registro.pdf_url) {
                // Asegurar que la URL sea accesible (firmada)
                const urlFirmada = await anexo8Service.refrescarUrlPdf(registro.pdf_url)

                // Opción 1: Abrir en nueva pestaña
                window.open(urlFirmada, '_blank')
                toast.success('Abriendo PDF...')
            } else {
                // Opción 2: Regenerar PDF si no existe URL (fallback)
                toast.info('Generando PDF...')

                // Asegurar firma accesible
                const registroParaPdf = { ...registro }
                if (registroParaPdf.medico_firma_url) {
                    registroParaPdf.medico_firma_url = await anexo8Service.refrescarUrlPdf(registroParaPdf.medico_firma_url)
                }

                const { blob, filename } = await generarAnexo8Pdf(registroParaPdf)
                descargarPdf(blob, filename)
                toast.success('PDF descargado correctamente')
            }
        } catch (error) {
            console.error(error)
            toast.error('Error al descargar el PDF')
        } finally {
            setDescargandoId(null)
        }
    }

    const { user } = useAuth()

    const handleEliminar = async (registro: Anexo8Record) => {
        if (!window.confirm('¿Está seguro de eliminar este registro? Esta acción no se puede deshacer.')) {
            return
        }

        try {
            toast.info('Eliminando registro...')
            const result = await anexo8Service.eliminarAnexo8(registro.id, registro.pdf_url || undefined)

            if (result.success) {
                toast.success('Registro eliminado correctamente')
                cargarDatos()
            } else {
                toast.error(`Error: ${result.error}`)
            }
        } catch (error) {
            console.error(error)
            toast.error('Error al eliminar el registro')
        }
    }

    const handleExportarExcel = async () => {
        try {
            setExportando(true)

            const filtrosActuales: Anexo8Filtros = { ...filtros }
            if (busquedaInput) filtrosActuales.pacienteDocumento = busquedaInput
            if (medicamentoFiltro) filtrosActuales.medicamento = medicamentoFiltro
            if (medicoFiltro) filtrosActuales.medicoNombres = medicoFiltro

            const result = await anexo8Service.obtenerTodosParaExportar(filtrosActuales)

            if (!result.success || !result.data || result.data.length === 0) {
                toast.error('No hay datos para exportar')
                return
            }

            const exportData = result.data.map(r => ({
                'Nro. Recetario': r.numero_recetario,
                'Fecha Prescripción': r.fecha_prescripcion,
                'Fecha Generación': r.fecha_generacion,
                'Paciente Tipo ID': r.paciente_tipo_id,
                'Paciente Documento': r.paciente_documento,
                'Paciente Nombres': r.paciente_nombres,
                'Paciente Apellido 1': r.paciente_apellido1,
                'Paciente Apellido 2': r.paciente_apellido2 || '',
                'Paciente Edad': r.paciente_edad ?? '',
                'Paciente Género': r.paciente_genero || '',
                'Paciente Teléfono': r.paciente_telefono || '',
                'Paciente Dirección': r.paciente_direccion || '',
                'Paciente Municipio': r.paciente_municipio || '',
                'Paciente Departamento': r.paciente_departamento || '',
                'Paciente Régimen': r.paciente_regimen || '',
                'Paciente EPS': r.paciente_eps || '',
                'Medicamento': r.medicamento_nombre,
                'Concentración': r.medicamento_concentracion || '',
                'Forma Farmacéutica': r.medicamento_forma_farmaceutica,
                'Dosis/Vía': r.medicamento_dosis_via || '',
                'Cantidad': r.cantidad_numero,
                'Cantidad en Letras': r.cantidad_letras,
                'Diagnóstico CIE-10': r.diagnostico_cie10 || '',
                'Diagnóstico Descripción': r.diagnostico_descripcion || '',
                'Médico Nombre': r.medico_nombres,
                'Médico Especialidad': r.medico_especialidad || '',
                'Médico Documento': r.medico_documento,
                'Médico Ciudad': r.medico_ciudad || '',
                'Generado Por': r.generado_por,
                'Fecha Creación': new Date(r.created_at).toLocaleString('es-CO'),
            }))

            const ws = XLSX.utils.json_to_sheet(exportData)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Anexo 8')
            XLSX.writeFile(wb, `Anexo8_Informe_${new Date().toISOString().split('T')[0]}.xlsx`)

            toast.success(`${result.data.length} registros exportados correctamente`)
        } catch (err) {
            console.error(err)
            toast.error('Error al exportar los datos')
        } finally {
            setExportando(false)
        }
    }

    // ============================================
    // RENDER
    // ============================================
    const totalPaginas = Math.ceil(total / ITEMS_POR_PAGINA)

    return (
        <div className="space-y-6">
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md border border-red-200 dark:border-red-800">
                    {error}
                </div>
            )}

            {/* Filtros */}
            <Card>
                <div className="p-4 space-y-4">
                    <form onSubmit={handleBuscar} className="space-y-3">
                        {/* Fila 1: Documento + Fechas */}
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative">
                                <Input
                                    placeholder="Buscar por documento del paciente..."
                                    value={busquedaInput}
                                    onChange={(e) => setBusquedaInput(e.target.value)}
                                    className="pl-10"
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            </div>

                            <div className="w-full md:w-48">
                                <Input
                                    type="date"
                                    className="w-full text-sm"
                                    placeholder="Fecha Desde"
                                    value={filtros.fechaDesde || ''}
                                    onChange={(e) => {
                                        setFiltros(prev => ({ ...prev, fechaDesde: e.target.value || undefined }))
                                        setPaginaActual(0)
                                    }}
                                />
                            </div>

                            <div className="w-full md:w-48">
                                <Input
                                    type="date"
                                    className="w-full text-sm"
                                    placeholder="Fecha Hasta"
                                    value={filtros.fechaHasta || ''}
                                    onChange={(e) => {
                                        setFiltros(prev => ({ ...prev, fechaHasta: e.target.value || undefined }))
                                        setPaginaActual(0)
                                    }}
                                />
                            </div>
                        </div>

                        {/* Fila 2: Medicamento + Médico + Acciones */}
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Medicamento</label>
                                <Autocomplete
                                    value={medicamentoFiltro}
                                    onChange={(val) => {
                                        setMedicamentoFiltro(val)
                                        setPaginaActual(0)
                                    }}
                                    options={MEDICAMENTOS_CONTROLADOS}
                                    placeholder="Filtrar por medicamento..."
                                    allowFreeText
                                />
                            </div>

                            <div className="flex-1 relative">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Médico</label>
                                <Input
                                    placeholder="Filtrar por nombre del médico..."
                                    value={medicoFiltro}
                                    onChange={(e) => {
                                        setMedicoFiltro(e.target.value)
                                        setPaginaActual(0)
                                    }}
                                />
                            </div>

                            <div className="flex gap-2 shrink-0">
                                <Button type="submit" leftIcon={<Search size={18} />}>
                                    Buscar
                                </Button>

                                {(busquedaInput || filtros.fechaDesde || filtros.fechaHasta || medicamentoFiltro || medicoFiltro) && (
                                    <Button variant="ghost" onClick={handleLimpiarBusqueda} type="button">
                                        Limpiar
                                    </Button>
                                )}

                                <Button
                                    type="button"
                                    variant="secondary"
                                    leftIcon={exportando ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
                                    onClick={handleExportarExcel}
                                    disabled={total === 0 || exportando}
                                >
                                    {exportando ? 'Exportando...' : 'Exportar Excel'}
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            </Card>

            {/* Tabla */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
                        <thead className="bg-gray-50 dark:bg-white/5">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                    Fecha
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                    Recetario
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                    Paciente
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                    Medicamento
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                    Cantidad
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                    Médico
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-transparent divide-y divide-gray-200 dark:divide-white/10">
                            {cargando ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500 dark:text-slate-400">
                                            <Loader2 className="animate-spin mb-2" size={32} />
                                            <p>Cargando historial...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : registros.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">
                                        No se encontraron registros de Anexo 8
                                    </td>
                                </tr>
                            ) : (
                                registros.map(registro => (
                                    <tr
                                        key={registro.id}
                                        className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                                        onClick={() => setRegistroSeleccionado(registro)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 dark:text-slate-100 dark:text-slate-100 flex items-center gap-2">
                                                <Calendar size={14} className="text-gray-400 dark:text-slate-500" />
                                                {new Date(registro.fecha_prescripcion).toLocaleDateString('es-CO')}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-slate-400 dark:text-slate-400 ml-6">
                                                Gen: {new Date(registro.created_at).toLocaleDateString('es-CO')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-gray-700 dark:text-slate-200">
                                                {registro.numero_recetario || 'Pendiente'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                                {registro.paciente_nombres} {registro.paciente_apellido1}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-slate-400">
                                                {registro.paciente_tipo_id} {registro.paciente_documento}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 dark:text-slate-100">
                                                {registro.medicamento_nombre}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-slate-400">
                                                {registro.medicamento_forma_farmaceutica}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                                {registro.cantidad_numero} Unid.
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-700 dark:text-slate-300">
                                                {registro.medico_nombres}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDescargarPdf(registro)
                                                    }}
                                                    disabled={descargandoId === registro.id}
                                                    className="text-blue-600 hover:text-blue-900"
                                                    title="Descargar PDF"
                                                >
                                                    {descargandoId === registro.id ? (
                                                        <Loader2 className="animate-spin" size={16} />
                                                    ) : (
                                                        <Download size={16} />
                                                    )}
                                                </Button>

                                                {(user?.rol === 'superadmin' || user?.rol === 'auditor') && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleEliminar(registro)
                                                        }}
                                                        className="text-red-600 hover:text-red-900"
                                                        title="Eliminar registro"
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                {!cargando && total > 0 && (
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between">
                        <div className="text-sm text-gray-500 dark:text-slate-400">
                            Mostrando {Math.min(paginaActual * ITEMS_POR_PAGINA + 1, total)} a {Math.min((paginaActual + 1) * ITEMS_POR_PAGINA, total)} de {total} resultados
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={paginaActual === 0}
                                onClick={() => setPaginaActual(prev => prev - 1)}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={paginaActual >= totalPaginas - 1}
                                onClick={() => setPaginaActual(prev => prev + 1)}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Panel de Detalle */}
            {registroSeleccionado && (
                <Anexo8DetallePanel
                    registro={registroSeleccionado}
                    onClose={() => setRegistroSeleccionado(null)}
                />
            )}
        </div>
    )
}
