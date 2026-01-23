/**
 * Página principal para generación de Anexo 8
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Recetario Oficial para Medicamentos de Control Especial (FNE)
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { afiliadosService } from '@/services/afiliados.service'
import { backService } from '@/services/back.service'
import { anexo8Service, ROLES_PERMITIDOS_ANEXO8 } from '@/services/anexo8.service'
import { generarAnexo8Pdf, descargarPdf } from './pdfGenerator'
import { PdfExtractDialog } from './components/PdfExtractDialog'
import { Cie10Search } from './components/Cie10Search'
import { numeroALetras } from '@/utils/numeroALetras'
import { Anexo8HistoryTab } from './components/Anexo8HistoryTab'
import {
    Afiliado,
    MEDICAMENTOS_CONTROLADOS,
    FORMAS_FARMACEUTICAS,
    MedicoData,
    Anexo8CreateData,
    Anexo8FormData,
    Anexo8OcrResult,
    MedicamentoControlado,
    FormaFarmaceutica,
    Regimen
} from '@/types'
import { LoadingSpinner, Alert, Autocomplete } from '@/components/common'
import {
    FaFilePdf,
    FaSearch,
    FaUserMd,
    FaPills,
    FaUser,
    FaCalendarAlt,
    FaTimes,
    FaCheck,
    FaPlus,
    FaHistory,
    FaEdit
} from 'react-icons/fa'

// Componente principal
export default function Anexo8Page() {
    const { user } = useAuth()

    // Estados principales
    const [generando, setGenerando] = useState(false)
    const [generadoExito, setGeneradoExito] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [exito, setExito] = useState<string | null>(null)
    const [mostrarPdfExtract, setMostrarPdfExtract] = useState(false)
    const [activeTab, setActiveTab] = useState<'generar' | 'historial'>('generar')

    // Búsqueda de paciente
    const [busqueda, setBusqueda] = useState('')
    const [buscando, setBuscando] = useState(false)
    const [paciente, setPaciente] = useState<Afiliado | null>(null)
    const [resultadosBusqueda, setResultadosBusqueda] = useState<Afiliado[]>([])
    const [mostrarResultados, setMostrarResultados] = useState(false)
    const [mostrarFormularioNuevo, setMostrarFormularioNuevo] = useState(false)
    const [creandoPaciente, setCreandoPaciente] = useState(false)

    // Médicos
    const [medicos, setMedicos] = useState<MedicoData[]>([])
    const [medicoSeleccionado, setMedicoSeleccionado] = useState<MedicoData | null>(null)
    const [busquedaMedico, setBusquedaMedico] = useState('')

    // Formulario
    const [formData, setFormData] = useState<Anexo8FormData>({
        pacienteDocumento: '',
        medicamentoNombre: '',
        concentracion: '',
        formaFarmaceutica: '',
        dosisVia: '',
        cantidadNumero: '',
        diagnosticoCie10: '',
        diagnosticoDescripcion: '',
        medicoId: '',
        fechaPrescripcion: new Date().toISOString().split('T')[0],
        mesesFormula: 1
    })

    // Verificar acceso
    const tieneAcceso = user && ROLES_PERMITIDOS_ANEXO8.includes(user.rol as typeof ROLES_PERMITIDOS_ANEXO8[number])
    const esSuperadmin = user?.rol === 'superadmin'
    const esAsistencial = user?.rol === 'asistencial'

    // Cargar médicos al inicio
    useEffect(() => {
        cargarMedicos()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Si es asistencial, predeterminar el médico
    useEffect(() => {
        if (esAsistencial && user?.identificacion) {
            // Buscar el médico por identificación
            const medicoActual = medicos.find(m => m.documento === user.identificacion)
            if (medicoActual) {
                setMedicoSeleccionado(medicoActual)
                setFormData(prev => ({ ...prev, medicoId: medicoActual.id }))
            }
        }
    }, [esAsistencial, user, medicos])

    // Cargar lista de médicos
    const cargarMedicos = async () => {
        const resultado = await anexo8Service.obtenerMedicos()
        if (resultado.success && resultado.data) {
            setMedicos(resultado.data)
        }
    }

    // Buscar pacientes
    const buscarPacientes = useCallback(async (texto: string) => {
        if (texto.length < 3) {
            setResultadosBusqueda([])
            setMostrarFormularioNuevo(false)
            return
        }

        setBuscando(true)
        setMostrarFormularioNuevo(false)

        try {
            //  Primero iniciar por documento exacto
            const resultDoc = await afiliadosService.buscarPorDocumento(texto)
            if (resultDoc.success && resultDoc.data) {
                setResultadosBusqueda([resultDoc.data])
                setMostrarResultados(true)
                setBuscando(false)
                return
            }

            // Si no, buscar por texto
            const resultTexto = await afiliadosService.buscarPorTexto(texto, 10)
            if (resultTexto.success && resultTexto.data && resultTexto.data.length > 0) {
                setResultadosBusqueda(resultTexto.data)
                setMostrarResultados(true)
            } else {
                // No se encontró ningún paciente, mostrar formulario de creación
                setResultadosBusqueda([])
                setMostrarResultados(false)
                setMostrarFormularioNuevo(true)
                // Simular paciente con documento ingresado para crearPacienteNuevo
                setPaciente({ id: texto } as Afiliado)
            }
        } catch {
            setError('Error buscando pacientes')
        }
        setBuscando(false)
    }, [])

    // Debounce de búsqueda
    useEffect(() => {
        const timer = setTimeout(() => {
            if (busqueda) {
                buscarPacientes(busqueda)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [busqueda, buscarPacientes])

    // Seleccionar paciente
    const seleccionarPaciente = (afiliado: Afiliado) => {
        setPaciente(afiliado)
        setFormData(prev => ({
            ...prev,
            pacienteDocumento: afiliado.id || ''
        }))
        setMostrarResultados(false)
        setMostrarFormularioNuevo(false)
        setBusqueda('')
    }

    // Crear paciente nuevo
    const crearPacienteNuevo = async (datos: {
        nombres: string
        apellido1: string
        apellido2?: string
        tipoId?: string
        sexo?: string
        telefono?: string
        direccion?: string
        municipio?: string
        regimen?: string
        eps?: string
    }) => {
        // Usar el documento de la búsqueda, no paciente.id
        const documentoNuevo = busqueda.replace(/\D/g, '')
        if (!documentoNuevo) {
            setError('Debe ingresar un número de documento válido')
            return
        }

        setCreandoPaciente(true)
        const resultado = await backService.crearAfiliado({
            tipoId: datos.tipoId || 'CC',
            id: documentoNuevo,
            nombres: datos.nombres,
            apellido1: datos.apellido1,
            apellido2: datos.apellido2,
            sexo: datos.sexo,
            telefono: datos.telefono,
            direccion: datos.direccion,
            municipio: datos.municipio,
            regimen: datos.regimen,
            eps: datos.eps || 'NUEVA EPS'
        })

        setCreandoPaciente(false)

        if (resultado.success) {
            // Crear afiliado local para continuar
            const nuevoAfiliado: Afiliado = {
                tipoId: datos.tipoId || 'CC',
                id: documentoNuevo,
                nombres: datos.nombres.toUpperCase(),
                apellido1: datos.apellido1.toUpperCase(),
                apellido2: datos.apellido2?.toUpperCase() || null,
                sexo: datos.sexo || null,
                direccion: datos.direccion?.toUpperCase() || null,
                telefono: datos.telefono || null,
                fechaNacimiento: null,
                estado: 'ACTIVO',
                municipio: datos.municipio || null,
                departamento: '23',
                observaciones: null,
                ipsPrimaria: null,
                tipoCotizante: null,
                rango: null,
                email: null,
                regimen: datos.regimen || null,
                edad: null,
                eps: datos.eps || 'NUEVA EPS',
                fuente: 'PORTAL_COLABORADORES',
                updatedAt: null,
                busquedaTexto: null
            }
            setPaciente(nuevoAfiliado)
            setMostrarFormularioNuevo(false)
            setError(null)
        } else {
            setError(resultado.error || 'Error al crear paciente')
        }
    }

    // Limpiar paciente
    const limpiarPaciente = () => {
        setPaciente(null)
        setFormData(prev => ({
            ...prev,
            pacienteDocumento: ''
        }))
    }

    // Seleccionar médico
    const seleccionarMedico = async (medicoId: string) => {
        const resultado = await anexo8Service.obtenerDatosMedico(medicoId)
        if (resultado.success && resultado.data) {
            setMedicoSeleccionado(resultado.data)
            setFormData(prev => ({ ...prev, medicoId }))
        }
    }

    // Actualizar cantidad en letras
    const actualizarCantidad = (valor: string) => {
        const numero = parseInt(valor, 10)
        if (!isNaN(numero) && numero > 0) {
            setFormData(prev => ({
                ...prev,
                cantidadNumero: numero
            }))
        } else {
            setFormData(prev => ({
                ...prev,
                cantidadNumero: ''
            }))
        }
    }

    // Validar si el formulario está completo (incluyendo diagnóstico CIE-10)
    const formularioCompleto = (
        paciente !== null &&
        formData.medicamentoNombre !== '' &&
        formData.formaFarmaceutica !== '' &&
        formData.cantidadNumero !== '' &&
        formData.diagnosticoCie10 !== '' &&
        medicoSeleccionado !== null
    )

    // Generar Anexo 8
    const generarAnexo8 = async () => {
        // Validaciones
        if (!paciente) {
            setError('Debe seleccionar un paciente')
            return
        }
        if (!formData.medicamentoNombre) {
            setError('Debe seleccionar un medicamento')
            return
        }
        if (!formData.formaFarmaceutica) {
            setError('Debe seleccionar la forma farmacéutica')
            return
        }
        if (!formData.cantidadNumero) {
            setError('Debe ingresar la cantidad')
            return
        }
        if (!medicoSeleccionado) {
            setError('Debe seleccionar un médico')
            return
        }

        setGenerando(true)
        setError(null)

        try {
            const cantidadNum = typeof formData.cantidadNumero === 'number'
                ? formData.cantidadNumero
                : parseInt(formData.cantidadNumero as string, 10)

            // Preparar datos base
            const datosBase: Anexo8CreateData = {
                paciente_documento: paciente.id || '',
                paciente_tipo_id: paciente.tipoId || 'CC',
                paciente_nombres: paciente.nombres || '',
                paciente_apellido1: paciente.apellido1 || '',
                paciente_apellido2: paciente.apellido2 || null,
                paciente_edad: paciente.edad || null,
                paciente_genero: (paciente.sexo === 'F' || paciente.sexo === 'M') ? paciente.sexo : null,
                paciente_telefono: paciente.telefono || null,
                paciente_municipio: paciente.municipio || null,
                paciente_direccion: paciente.direccion || null,
                paciente_departamento: paciente.departamento || null,
                paciente_regimen: (paciente.regimen as Regimen) || null,
                paciente_eps: paciente.eps || null,

                medicamento_nombre: formData.medicamentoNombre as MedicamentoControlado,
                medicamento_concentracion: formData.concentracion || null,
                medicamento_forma_farmaceutica: formData.formaFarmaceutica as FormaFarmaceutica,
                medicamento_dosis_via: formData.dosisVia || null,
                cantidad_numero: cantidadNum,
                cantidad_letras: numeroALetras(cantidadNum),

                diagnostico_cie10: formData.diagnosticoCie10 || null,
                diagnostico_descripcion: formData.diagnosticoDescripcion || null,

                medico_id: medicoSeleccionado.id,
                medico_documento: medicoSeleccionado.documento,
                medico_nombres: medicoSeleccionado.nombreCompleto,
                medico_especialidad: medicoSeleccionado.especialidad || null,
                medico_ciudad: medicoSeleccionado.ciudad || null,
                medico_firma_url: medicoSeleccionado.firmaUrl || null,

                fecha_prescripcion: formData.fechaPrescripcion,
                generado_por: user?.nombreCompleto || 'Sistema'
            }

            // Crear registros (1 o múltiples si hay posfechado)
            console.log('🔍 DEBUG: Valor de mesesFormula:', formData.mesesFormula, 'Tipo:', typeof formData.mesesFormula)
            const resultado = await anexo8Service.crearAnexos8Multiples(
                datosBase,
                formData.mesesFormula
            )

            if (!resultado.success || !resultado.data) {
                throw new Error(resultado.error || 'Error al crear registros')
            }

            // Generar PDFs para cada registro
            for (const registro of resultado.data) {
                // Generar PDF
                const { blob, filename } = await generarAnexo8Pdf(registro)

                // Subir al bucket
                const uploadResult = await anexo8Service.subirPdf(blob, filename)

                if (uploadResult.success && uploadResult.data) {
                    // Actualizar URL en el registro
                    await anexo8Service.actualizarPdfUrl(
                        registro.id,
                        uploadResult.data,
                        filename
                    )
                }

                // Descargar el PDF
                descargarPdf(blob, filename)
            }

            setExito(`Se generaron ${resultado.data.length} Anexo(s) 8 correctamente`)

            // Activar estado de éxito (permanece verde hasta hacer clic en Nuevo Anexo 8)
            setGeneradoExito(true)

        } catch (err) {
            console.error('Error generando Anexo 8:', err)
            setError(err instanceof Error ? err.message : 'Error al generar el Anexo 8')
        }

        setGenerando(false)
    }

    // Resetear todo el formulario (botón Nuevo Anexo 8)
    const resetearFormularioCompleto = () => {
        setPaciente(null)
        setBusqueda('')
        setMostrarFormularioNuevo(false)
        setMostrarResultados(false)
        setResultadosBusqueda([])

        // Si no es asistencial, también limpiar médico
        if (!esAsistencial) {
            setMedicoSeleccionado(null)
            setBusquedaMedico('')
        }

        setFormData({
            pacienteDocumento: '',
            medicamentoNombre: '',
            concentracion: '',
            formaFarmaceutica: '',
            dosisVia: '',
            cantidadNumero: '',
            diagnosticoCie10: '',
            diagnosticoDescripcion: '',
            medicoId: esAsistencial && medicoSeleccionado ? medicoSeleccionado.id : '',
            fechaPrescripcion: new Date().toISOString().split('T')[0],
            mesesFormula: 1
        })

        setGeneradoExito(false)
        setError(null)
        setExito(null)
    }

    // Manejar datos extraídos del OCR
    const handleOcrData = async (data: Anexo8OcrResult) => {
        // Si extrajo documento del paciente, buscar automáticamente
        if (data.pacienteDocumento) {
            setBusqueda(data.pacienteDocumento)
            const result = await afiliadosService.buscarPorDocumento(data.pacienteDocumento)
            if (result.success && result.data) {
                seleccionarPaciente(result.data)
            }
        }

        // Buscar y seleccionar médico si se reconoció
        if (data.medicoDocumento || data.medicoRegistro) {
            const docMedico = (data.medicoDocumento || data.medicoRegistro || '').replace(/\D/g, '')
            console.log('🔍 OCR: Buscando médico con documento:', docMedico, 'en lista de', medicos.length, 'médicos')

            const medicoEncontrado = medicos.find(m => {
                const docLimpio = (m.documento || '').replace(/\D/g, '')
                return docLimpio === docMedico
            })

            if (medicoEncontrado) {
                console.log('✓ OCR: Médico encontrado:', medicoEncontrado.nombreCompleto)
                await seleccionarMedico(medicoEncontrado.id)
            } else {
                console.log('⚠️ OCR: Médico no encontrado en la lista. Documento:', docMedico)
            }
        }

        // Aplicar medicamento si se detectó
        let medicamentoMatch: MedicamentoControlado | '' = ''
        if (data.medicamentoNombre) {
            // Buscar coincidencia exacta en la lista
            const match = MEDICAMENTOS_CONTROLADOS.find(
                m => m.toLowerCase() === data.medicamentoNombre?.toLowerCase()
            )
            if (match) {
                medicamentoMatch = match
            }
        }

        // Aplicar forma farmacéutica si se detectó
        let formaMatch: FormaFarmaceutica | '' = ''
        if (data.formaFarmaceutica) {
            // Buscar coincidencia compatible
            const match = FORMAS_FARMACEUTICAS.find(f =>
                f.toLowerCase().includes(data.formaFarmaceutica?.toLowerCase() || '') ||
                data.formaFarmaceutica?.toLowerCase().includes(f.toLowerCase())
            )
            if (match) {
                formaMatch = match
            }
        }

        // Usar cantidad POR MES, no cantidad total
        const cantidadCorrecta = data.cantidadPorMes || data.cantidadNumero || ''

        // Validar y convertir mesesTratamiento a número
        const mesesTratamiento = data.mesesTratamiento
            ? Math.max(1, parseInt(String(data.mesesTratamiento), 10) || 1)
            : undefined

        console.log('🔍 OCR: mesesTratamiento detectado:', data.mesesTratamiento, '→ convertido a:', mesesTratamiento)
        console.log('🔍 OCR: dosisVia detectado:', data.dosisVia)
        console.log('🔍 OCR: cantidadNumero detectado:', data.cantidadNumero, '| cantidadPorMes:', data.cantidadPorMes)
        console.log('🔍 OCR: diagnosticoCie10 detectado:', data.diagnosticoCie10)

        // Aplicar todos los campos extraídos
        setFormData(prev => {
            const nuevoFormData = {
                ...prev,
                medicamentoNombre: medicamentoMatch || prev.medicamentoNombre,
                concentracion: data.concentracion || prev.concentracion,
                formaFarmaceutica: formaMatch || prev.formaFarmaceutica,
                dosisVia: data.dosisVia || prev.dosisVia,
                cantidadNumero: cantidadCorrecta || prev.cantidadNumero,
                diagnosticoCie10: data.diagnosticoCie10 || prev.diagnosticoCie10,
                diagnosticoDescripcion: data.diagnosticoDescripcion || prev.diagnosticoDescripcion,
                mesesFormula: mesesTratamiento !== undefined ? mesesTratamiento : prev.mesesFormula
            }
            console.log('✓ OCR: FormData actualizado:', nuevoFormData)
            return nuevoFormData
        })

        setExito('Datos extraídos del OCR aplicados. Verifique y complete la información.')
    }

    // Si no tiene acceso, mostrar mensaje
    if (!tieneAcceso) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-700">Acceso Denegado</h2>
                    <p className="text-gray-500 mt-2">No tiene permisos para acceder a este módulo.</p>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
                {/* Header */}
                <div className="max-w-6xl mx-auto mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                                <FaFilePdf className="text-red-500" />
                                Generar Anexo 8
                            </h1>
                            <p className="text-slate-500 mt-1">
                                Recetario Oficial para Medicamentos de Control Especial (FNE)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Alertas */}
                {error && (
                    <div className="max-w-6xl mx-auto mb-4">
                        <Alert type="error" message={error} onClose={() => setError(null)} />
                    </div>
                )}
                {exito && (
                    <div className="max-w-6xl mx-auto mb-4">
                        <Alert type="success" message={exito} onClose={() => setExito(null)} />
                    </div>
                )}

                {/* Tabs de Navegación */}
                <div className="max-w-6xl mx-auto mb-6">
                    <div className="flex space-x-1 rounded-xl bg-slate-200 p-1 w-fit">
                        <button
                            onClick={() => setActiveTab('generar')}
                            className={`
                                flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
                                ${activeTab === 'generar'
                                    ? 'bg-white text-slate-800 shadow'
                                    : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                                }
                            `}
                        >
                            <FaEdit />
                            Generar Nuevo
                        </button>
                        <button
                            onClick={() => setActiveTab('historial')}
                            className={`
                                flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
                                ${activeTab === 'historial'
                                    ? 'bg-white text-blue-700 shadow'
                                    : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                                }
                            `}
                        >
                            <FaHistory />
                            Historial Generado
                        </button>
                    </div>
                </div>

                {/* VISTA: HISTORIAL */}
                {activeTab === 'historial' && (
                    <div className="max-w-6xl mx-auto">
                        <Anexo8HistoryTab />
                    </div>
                )}

                {/* VISTA: GENERAR (Contenido Original) */}
                <div className={`max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 ${activeTab !== 'generar' ? 'hidden' : ''}`}>

                    {/* COLUMNA IZQUIERDA: Paciente + Profesional + Configuración (1 columna del grid) */}
                    <div className="lg:col-span-1 space-y-4">
                        {/* Búsqueda de Paciente */}
                        <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-200">
                            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2 mb-4">
                                <FaUser className="text-blue-500" />
                                1. Paciente
                            </h2>

                            {!paciente ? (
                                <>
                                    <div className="relative">
                                        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-400">
                                            <FaSearch className="text-slate-400 ml-3" />
                                            <input
                                                type="text"
                                                placeholder="Buscar por documento o nombre..."
                                                value={busqueda}
                                                onChange={(e) => setBusqueda(e.target.value)}
                                                className="w-full px-3 py-2.5 focus:outline-none"
                                            />
                                            {buscando && <LoadingSpinner size="sm" />}
                                        </div>

                                        {/* Resultados de búsqueda */}
                                        {mostrarResultados && resultadosBusqueda.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                                {resultadosBusqueda.map((afiliado) => (
                                                    <button
                                                        key={afiliado.id}
                                                        onClick={() => seleccionarPaciente(afiliado)}
                                                        className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0 transition-colors"
                                                    >
                                                        <p className="font-medium text-slate-800">
                                                            {afiliado.nombres} {afiliado.apellido1} {afiliado.apellido2}
                                                        </p>
                                                        <p className="text-sm text-slate-500">
                                                            {afiliado.tipoId} {afiliado.id} • {afiliado.eps}
                                                        </p>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Formulario crear paciente nuevo - COMPLETO */}
                                    {mostrarFormularioNuevo && (
                                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                            <p className="text-sm font-semibold text-amber-800 mb-3">
                                                ⚠️ Paciente no encontrado. Complete los datos para crear:
                                            </p>
                                            <div className="space-y-3">
                                                {/* Documento (readonly) */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <select
                                                        id="nuevo-tipo-id"
                                                        className="px-3 py-2 rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                                                    >
                                                        <option value="CC">CC</option>
                                                        <option value="TI">TI</option>
                                                        <option value="CE">CE</option>
                                                        <option value="PA">PA</option>
                                                        <option value="RC">RC</option>
                                                    </select>
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={busqueda}
                                                        className="px-3 py-2 rounded-lg border border-slate-300 bg-slate-100 text-sm"
                                                    />
                                                </div>

                                                {/* Nombres y Apellidos */}
                                                <input
                                                    id="nuevo-nombres"
                                                    type="text"
                                                    placeholder="Nombres *"
                                                    className="w-full px-3 py-2 rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        id="nuevo-apellido1"
                                                        type="text"
                                                        placeholder="1er Apellido *"
                                                        className="px-3 py-2 rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                    />
                                                    <input
                                                        id="nuevo-apellido2"
                                                        type="text"
                                                        placeholder="2do Apellido"
                                                        className="px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
                                                    />
                                                </div>

                                                {/* Sexo y Edad */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <select
                                                        id="nuevo-sexo"
                                                        className="px-3 py-2 rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                    >
                                                        <option value="">Sexo *</option>
                                                        <option value="M">Masculino</option>
                                                        <option value="F">Femenino</option>
                                                    </select>
                                                    <input
                                                        id="nuevo-edad"
                                                        type="number"
                                                        min="0"
                                                        max="120"
                                                        placeholder="Edad *"
                                                        className="px-3 py-2 rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                    />
                                                </div>

                                                {/* Teléfono */}
                                                <input
                                                    id="nuevo-telefono"
                                                    type="tel"
                                                    placeholder="Teléfono *"
                                                    className="w-full px-3 py-2 rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                />

                                                {/* Dirección */}
                                                <input
                                                    id="nuevo-direccion"
                                                    type="text"
                                                    placeholder="Dirección de Residencia *"
                                                    className="w-full px-3 py-2 rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                />

                                                {/* Municipio */}
                                                <input
                                                    id="nuevo-municipio"
                                                    type="text"
                                                    placeholder="Municipio *"
                                                    defaultValue="MONTERÍA"
                                                    className="w-full px-3 py-2 rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                />

                                                {/* Régimen y EPS */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <select
                                                        id="nuevo-regimen"
                                                        className="px-3 py-2 rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                    >
                                                        <option value="">Régimen *</option>
                                                        <option value="Contributivo">Contributivo</option>
                                                        <option value="Subsidiado">Subsidiado</option>
                                                        <option value="Vinculado">Vinculado</option>
                                                    </select>
                                                    <input
                                                        id="nuevo-eps"
                                                        type="text"
                                                        placeholder="EPS *"
                                                        defaultValue="NUEVA EPS"
                                                        className="px-3 py-2 rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                    />
                                                </div>

                                                {/* Botón crear */}
                                                <button
                                                    onClick={() => {
                                                        const tipoId = (document.getElementById('nuevo-tipo-id') as HTMLSelectElement)?.value || 'CC'
                                                        const nombres = (document.getElementById('nuevo-nombres') as HTMLInputElement)?.value?.trim()
                                                        const apellido1 = (document.getElementById('nuevo-apellido1') as HTMLInputElement)?.value?.trim()
                                                        const apellido2 = (document.getElementById('nuevo-apellido2') as HTMLInputElement)?.value?.trim()
                                                        const sexo = (document.getElementById('nuevo-sexo') as HTMLSelectElement)?.value
                                                        const telefono = (document.getElementById('nuevo-telefono') as HTMLInputElement)?.value?.trim()
                                                        const direccion = (document.getElementById('nuevo-direccion') as HTMLInputElement)?.value?.trim()
                                                        const municipio = (document.getElementById('nuevo-municipio') as HTMLInputElement)?.value?.trim()
                                                        const regimen = (document.getElementById('nuevo-regimen') as HTMLSelectElement)?.value
                                                        const eps = (document.getElementById('nuevo-eps') as HTMLInputElement)?.value?.trim()

                                                        // Validar campos requeridos
                                                        if (!nombres || !apellido1 || !sexo || !telefono || !direccion || !municipio || !regimen || !eps) {
                                                            setError('Complete todos los campos requeridos (*)')
                                                            return
                                                        }

                                                        crearPacienteNuevo({
                                                            tipoId,
                                                            nombres,
                                                            apellido1,
                                                            apellido2,
                                                            sexo,
                                                            telefono,
                                                            direccion,
                                                            municipio,
                                                            regimen,
                                                            eps
                                                        })
                                                    }}
                                                    disabled={creandoPaciente}
                                                    className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:bg-slate-400"
                                                >
                                                    {creandoPaciente ? 'Creando...' : 'Crear Paciente y Continuar'}
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setMostrarFormularioNuevo(false)
                                                        setPaciente(null)
                                                        setBusqueda('')
                                                    }}
                                                    className="w-full px-4 py-2 text-slate-600 hover:text-slate-800 text-sm"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="bg-blue-50 rounded-lg p-4 relative">
                                    <button
                                        onClick={limpiarPaciente}
                                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <FaTimes />
                                    </button>
                                    <p className="font-semibold text-slate-800">
                                        {paciente.nombres} {paciente.apellido1} {paciente.apellido2}
                                    </p>
                                    <p className="text-sm text-slate-600">
                                        {paciente.tipoId} {paciente.id}
                                    </p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {paciente.edad} años • {paciente.sexo === 'F' ? 'Femenino' : 'Masculino'}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        {paciente.municipio}, {paciente.departamento}
                                    </p>
                                    <p className="text-sm text-blue-600 font-medium mt-1">
                                        {paciente.eps} • {paciente.regimen}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* 2. Profesional */}
                        <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-200">
                            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2 mb-4">
                                <FaUserMd className="text-green-500" />
                                2. Profesional
                            </h2>

                            {esAsistencial ? (
                                // Médico fijo para asistencial
                                medicoSeleccionado ? (
                                    <div className="bg-green-50 rounded-lg p-4">
                                        <p className="font-semibold text-slate-800">{medicoSeleccionado.nombreCompleto}</p>
                                        <p className="text-sm text-slate-600">CC {medicoSeleccionado.documento}</p>
                                        {medicoSeleccionado.especialidad && (
                                            <p className="text-sm text-green-600 font-medium mt-1">
                                                {medicoSeleccionado.especialidad}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-slate-500 text-sm">Cargando datos del médico...</p>
                                )
                            ) : (
                                // Autocomplete para admin/superadmin
                                <>
                                    <Autocomplete
                                        value={busquedaMedico}
                                        onChange={(val) => {
                                            setBusquedaMedico(val)
                                            const medicoEncontrado = medicos.find(m => m.nombreCompleto === val)
                                            if (medicoEncontrado) {
                                                seleccionarMedico(medicoEncontrado.id)
                                            }
                                        }}
                                        options={medicos.map(m => m.nombreCompleto)}
                                        placeholder="Buscar médico por nombre..."
                                        allowFreeText={false}
                                    />
                                    {medicoSeleccionado && (
                                        <div className="mt-3 bg-green-50 rounded-lg p-3 text-sm">
                                            <p className="text-slate-600">
                                                <strong>Ciudad:</strong> {medicoSeleccionado.ciudad || 'No especificada'}
                                            </p>
                                            {medicoSeleccionado.especialidad && (
                                                <p className="text-slate-600">
                                                    <strong>Especialidad:</strong> {medicoSeleccionado.especialidad}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* 3. Configuración */}
                        <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-200">
                            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2 mb-4">
                                <FaCalendarAlt className="text-indigo-500" />
                                3. Configuración
                            </h2>

                            <div className="space-y-4">
                                {/* Fecha de prescripción */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">
                                        Fecha de Prescripción
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.fechaPrescripcion}
                                        onChange={(e) => setFormData(prev => ({ ...prev, fechaPrescripcion: e.target.value }))}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                </div>

                                {/* Meses de fórmula */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">
                                        Meses de Fórmula (Posfechado)
                                    </label>
                                    <select
                                        value={formData.mesesFormula}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            mesesFormula: Math.max(1, parseInt(e.target.value) || 1)
                                        }))}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    >
                                        {[1, 2, 3, 4, 5, 6].map((mes) => (
                                            <option key={mes} value={mes}>
                                                {mes} {mes === 1 ? 'mes' : 'meses'}
                                            </option>
                                        ))}
                                    </select>
                                    {formData.mesesFormula > 1 && (
                                        <p className="text-xs text-indigo-600 mt-1">
                                            Se generarán {formData.mesesFormula} PDFs con fechas consecutivas
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* COLUMNA DERECHA: Medicamento (2 columnas del grid - ocupa el resto del ancho) */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-200 h-full">
                            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2 mb-4">
                                <FaPills className="text-amber-500" />
                                4. Medicamento
                            </h2>

                            <div className="space-y-4">
                                {/* Nombre del medicamento */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">
                                        Nombre Genérico *
                                    </label>
                                    <select
                                        value={formData.medicamentoNombre}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            medicamentoNombre: e.target.value as MedicamentoControlado | ''
                                        }))}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    >
                                        <option value="">Seleccionar medicamento...</option>
                                        {MEDICAMENTOS_CONTROLADOS.map((med) => (
                                            <option key={med} value={med}>{med}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Concentración */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">
                                        Concentración
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: 100MG, 5MG/ML"
                                        value={formData.concentracion}
                                        onChange={(e) => setFormData(prev => ({ ...prev, concentracion: e.target.value }))}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    />
                                </div>

                                {/* Forma farmacéutica */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">
                                        Forma Farmacéutica *
                                    </label>
                                    <select
                                        value={formData.formaFarmaceutica}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            formaFarmaceutica: e.target.value as FormaFarmaceutica | ''
                                        }))}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    >
                                        <option value="">Seleccionar forma...</option>
                                        {FORMAS_FARMACEUTICAS.map((forma) => (
                                            <option key={forma} value={forma}>{forma}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Dosis / Vía */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">
                                        Dosis / Vía de Administración
                                    </label>
                                    <textarea
                                        placeholder="Ser explícito en la forma de administración del medicamento."
                                        value={formData.dosisVia}
                                        onChange={(e) => setFormData(prev => ({ ...prev, dosisVia: e.target.value }))}
                                        rows={2}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                                    />
                                </div>

                                {/* Cantidad */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">
                                        Cantidad *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="999"
                                        placeholder="Ej: 30"
                                        value={formData.cantidadNumero}
                                        onChange={(e) => actualizarCantidad(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    />
                                </div>

                                {/* Diagnóstico */}
                                <div className="border-t border-slate-200 pt-4">
                                    <label className="block text-sm font-medium text-slate-600 mb-1">
                                        Diagnóstico CIE-10
                                    </label>
                                    <Cie10Search
                                        value={{
                                            codigo: formData.diagnosticoCie10,
                                            descripcion: formData.diagnosticoDescripcion
                                        }}
                                        onChange={(data) => setFormData(prev => ({
                                            ...prev,
                                            diagnosticoCie10: data.codigo,
                                            diagnosticoDescripcion: data.descripcion
                                        }))}
                                        placeholder="Buscar por código o descripción..."
                                    />
                                </div>
                            </div>

                            {/* Botones alineados a la derecha debajo del medicamento */}
                            <div className="mt-6 flex flex-wrap gap-3 justify-end">
                                {/* Botón Nuevo Anexo 8 - SOLO visible después de generación exitosa */}
                                {generadoExito && (
                                    <button
                                        onClick={resetearFormularioCompleto}
                                        className="px-4 py-2.5 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                    >
                                        <FaPlus />
                                        Nuevo Anexo 8
                                    </button>
                                )}

                                {/* Botón Extraer PDF (solo superadmin) */}
                                {esSuperadmin && (
                                    <button
                                        onClick={() => setMostrarPdfExtract(true)}
                                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                    >
                                        <FaFilePdf />
                                        Extraer desde PDF
                                    </button>
                                )}

                                {/* Botón Generar Anexo 8 */}
                                <button
                                    onClick={generarAnexo8}
                                    disabled={generando || generadoExito || !formularioCompleto}
                                    className={`
                                    px-6 py-2 rounded-lg font-semibold text-white
                                    flex items-center gap-2 transition-all duration-300 shadow-lg
                                    ${generando || !formularioCompleto
                                            ? 'bg-slate-400 cursor-not-allowed'
                                            : generadoExito
                                                ? 'bg-green-600 hover:bg-green-700'
                                                : 'bg-red-600 hover:bg-red-700'
                                        }
                                `}
                                >
                                    {generando ? (
                                        <>
                                            <LoadingSpinner size="sm" />
                                            Generando...
                                        </>
                                    ) : generadoExito ? (
                                        <>
                                            <FaCheck />
                                            ¡Generado Correctamente!
                                        </>
                                    ) : (
                                        <>
                                            <FaFilePdf />
                                            Generar Anexo 8
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal PDF Extract */}
            <PdfExtractDialog
                isOpen={mostrarPdfExtract}
                onClose={() => setMostrarPdfExtract(false)}
                onDataExtracted={handleOcrData}
            />
        </>
    )
}
