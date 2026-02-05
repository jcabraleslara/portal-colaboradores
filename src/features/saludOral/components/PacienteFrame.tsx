/**
 * Frame de Datos del Paciente para Salud Oral
 * Muestra información del paciente desde tabla afiliados
 * Si no se encuentra, permite crear uno nuevo en tabla bd
 */

import { useState } from 'react'
import { Search, User, Calendar, Phone, AlertCircle, Building2, IdCard, Plus, Save, X } from 'lucide-react'
import { supabase } from '@/config/supabase.config'
import { backService } from '@/services/back.service'
import { getFechaHoyColombia } from '@/utils/date.utils'
import {
    SEXO_LISTA,
    REGIMEN_LISTA,
    TIPO_COTIZANTE_LISTA,
    MUNICIPIOS_CORDOBA,
    IPS_PRIMARIA_LISTA,
    EPS_LISTA,
    CrearAfiliadoData
} from '@/types/back.types'
import { Autocomplete } from '@/components/common'

export interface PacienteData {
    id: string
    tipoId: string
    tipoIdNombre: string
    nombres: string
    apellido1: string
    apellido2?: string
    fechaNacimiento?: string
    edad?: number
    sexo?: 'M' | 'F'
    telefono?: string
    municipio?: string
    departamento?: string
    eps?: string
    ipsPrimaria?: string
}

interface PacienteFrameProps {
    pacienteId: string
    onPacienteIdChange: (id: string) => void
    onPacienteFound?: (paciente: PacienteData | null) => void
    disabled?: boolean
}

// Mapeo de códigos de tipo de documento
const TIPO_ID_MAP: Record<string, string> = {
    '1': 'RC', // Registro Civil
    '2': 'TI', // Tarjeta de Identidad
    '3': 'CC', // Cédula de Ciudadanía
    '4': 'CE', // Cédula de Extranjería
    '5': 'PA', // Pasaporte
    '6': 'MS', // Menor sin ID
    '7': 'AS', // Adulto sin ID
    'CC': 'CC',
    'TI': 'TI',
    'RC': 'RC',
    'CE': 'CE',
    'PA': 'PA',
    'MS': 'MS',
}

// Calcular edad a partir de fecha de nacimiento
function calcularEdad(fechaNacimiento: string): number {
    const hoy = new Date()
    const nacimiento = new Date(fechaNacimiento)
    let edad = hoy.getFullYear() - nacimiento.getFullYear()
    const mes = hoy.getMonth() - nacimiento.getMonth()
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--
    }
    return edad
}

export function PacienteFrame({
    pacienteId,
    onPacienteIdChange,
    onPacienteFound,
    disabled = false,
}: PacienteFrameProps) {
    const [loading, setLoading] = useState(false)
    const [paciente, setPaciente] = useState<PacienteData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [notFound, setNotFound] = useState(false)

    // Estado para formulario de nuevo paciente
    const [creandoAfiliado, setCreandoAfiliado] = useState(false)
    const [nuevoAfiliado, setNuevoAfiliado] = useState<CrearAfiliadoData>({
        tipoId: 'CC',
        id: '',
        nombres: '',
        apellido1: '',
        apellido2: '',
        sexo: '',
        direccion: '',
        telefono: '',
        fechaNacimiento: '',
        municipio: '',
        departamento: '23',
        regimen: '',
        ipsPrimaria: '',
        tipoCotizante: '',
        eps: 'NUEVA EPS',
    })
    const [municipioNombre, setMunicipioNombre] = useState('')

    const buscarPaciente = async () => {
        if (!pacienteId.trim()) {
            setError('Ingrese un número de identificación')
            return
        }

        setLoading(true)
        setError(null)
        setNotFound(false)

        try {
            // Buscar en tabla afiliados
            const { data: afiliado, error: afiliadoError } = await supabase
                .from('afiliados')
                .select('*')
                .eq('id', pacienteId.trim())
                .single()

            if (afiliadoError || !afiliado) {
                // No encontrado - mostrar formulario de creación
                setNotFound(true)
                setNuevoAfiliado(prev => ({ ...prev, id: pacienteId.trim() }))
                setPaciente(null)
                onPacienteFound?.(null)
                return
            }

            // Obtener nombre del municipio si hay código divipola
            let municipioNombre = afiliado.municipio
            if (afiliado.municipio && /^\d+$/.test(afiliado.municipio)) {
                const { data: municipioData } = await supabase
                    .from('divipola')
                    .select('municipio')
                    .eq('codigo', afiliado.municipio)
                    .single()

                if (municipioData) {
                    municipioNombre = municipioData.municipio
                }
            }

            // Mapear tipo de documento
            const tipoIdCodigo = afiliado.tipo_id || afiliado.tipo_documento || '3'
            const tipoIdNombre = TIPO_ID_MAP[tipoIdCodigo] || tipoIdCodigo

            // Formatear datos
            const pacienteData: PacienteData = {
                id: afiliado.id,
                tipoId: tipoIdCodigo,
                tipoIdNombre,
                nombres: afiliado.nombres || '',
                apellido1: afiliado.apellido1 || '',
                apellido2: afiliado.apellido2,
                fechaNacimiento: afiliado.fecha_nacimiento,
                edad: afiliado.edad,
                sexo: afiliado.sexo || afiliado.genero,
                telefono: afiliado.telefono || afiliado.celular,
                municipio: municipioNombre,
                departamento: afiliado.departamento,
                eps: afiliado.eps || afiliado.aseguradora,
                ipsPrimaria: afiliado.ips_primaria || afiliado.ips,
            }

            setPaciente(pacienteData)
            setNotFound(false)
            onPacienteFound?.(pacienteData)
        } catch (err) {
            console.error('Error buscando paciente:', err)
            setError('Error al buscar paciente')
            setPaciente(null)
            onPacienteFound?.(null)
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            buscarPaciente()
        }
    }

    const handleCrearPaciente = async () => {
        // Validaciones
        if (!nuevoAfiliado.nombres.trim()) {
            setError('El nombre es requerido')
            return
        }
        if (!nuevoAfiliado.apellido1.trim()) {
            setError('El primer apellido es requerido')
            return
        }

        setCreandoAfiliado(true)
        setError(null)

        try {
            const dataToSend: CrearAfiliadoData = {
                ...nuevoAfiliado,
                apellido2: nuevoAfiliado.apellido2 || undefined,
                sexo: nuevoAfiliado.sexo || undefined,
                direccion: nuevoAfiliado.direccion || undefined,
                telefono: nuevoAfiliado.telefono || undefined,
                fechaNacimiento: nuevoAfiliado.fechaNacimiento || undefined,
                municipio: nuevoAfiliado.municipio || undefined,
                departamento: nuevoAfiliado.departamento || undefined,
                regimen: nuevoAfiliado.regimen || undefined,
                ipsPrimaria: nuevoAfiliado.ipsPrimaria || undefined,
                tipoCotizante: nuevoAfiliado.tipoCotizante || undefined,
                eps: nuevoAfiliado.eps || undefined,
            }

            const result = await backService.crearAfiliado(dataToSend)

            if (result.success) {
                // Construir objeto PacienteData
                const edadCalculada = nuevoAfiliado.fechaNacimiento
                    ? calcularEdad(nuevoAfiliado.fechaNacimiento)
                    : undefined

                const pacienteCreado: PacienteData = {
                    id: nuevoAfiliado.id,
                    tipoId: nuevoAfiliado.tipoId,
                    tipoIdNombre: TIPO_ID_MAP[nuevoAfiliado.tipoId] || nuevoAfiliado.tipoId,
                    nombres: nuevoAfiliado.nombres.toUpperCase(),
                    apellido1: nuevoAfiliado.apellido1.toUpperCase(),
                    apellido2: nuevoAfiliado.apellido2?.toUpperCase(),
                    fechaNacimiento: nuevoAfiliado.fechaNacimiento,
                    edad: edadCalculada,
                    sexo: nuevoAfiliado.sexo as 'M' | 'F' | undefined,
                    telefono: nuevoAfiliado.telefono,
                    municipio: municipioNombre || nuevoAfiliado.municipio,
                    departamento: nuevoAfiliado.departamento,
                    eps: nuevoAfiliado.eps || 'NUEVA EPS',
                    ipsPrimaria: nuevoAfiliado.ipsPrimaria,
                }

                setPaciente(pacienteCreado)
                setNotFound(false)
                onPacienteFound?.(pacienteCreado)
            } else {
                setError(result.error || 'Error al crear el paciente')
            }
        } catch (err) {
            console.error('Error creando paciente:', err)
            setError('Error inesperado al crear el paciente')
        } finally {
            setCreandoAfiliado(false)
        }
    }

    const cancelarCreacion = () => {
        setNotFound(false)
        setNuevoAfiliado({
            tipoId: 'CC',
            id: '',
            nombres: '',
            apellido1: '',
            apellido2: '',
            sexo: '',
            direccion: '',
            telefono: '',
            fechaNacimiento: '',
            municipio: '',
            departamento: '23',
            regimen: '',
            ipsPrimaria: '',
            tipoCotizante: '',
            eps: 'NUEVA EPS',
        })
        setMunicipioNombre('')
        onPacienteIdChange('')
    }

    const nombreCompleto = paciente
        ? [paciente.nombres, paciente.apellido1, paciente.apellido2].filter(Boolean).join(' ')
        : ''

    return (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-4">
                <User className="text-primary-500" size={20} />
                <h3 className="font-bold text-slate-900">Datos del Paciente</h3>
            </div>

            {/* Buscador */}
            <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={pacienteId}
                        onChange={(e) => onPacienteIdChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Número de identificación..."
                        disabled={disabled || notFound}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-slate-100"
                    />
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                </div>
                <button
                    type="button"
                    onClick={buscarPaciente}
                    disabled={loading || disabled || notFound}
                    className="px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                >
                    {loading ? 'Buscando...' : 'Buscar'}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {/* Formulario de Nuevo Paciente */}
            {notFound && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-amber-200/60">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                            <Plus size={18} />
                        </div>
                        <div>
                            <h4 className="font-bold text-amber-900">Paciente No Encontrado</h4>
                            <p className="text-xs text-amber-700">
                                Complete los datos para registrarlo en la base de datos
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={cancelarCreacion}
                            className="ml-auto p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 text-sm">
                        {/* Tipo Documento */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Tipo Doc. <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={nuevoAfiliado.tipoId}
                                onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, tipoId: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="CC">CC - Cédula</option>
                                <option value="TI">TI - Tarjeta Identidad</option>
                                <option value="CE">CE - Cédula Extranjería</option>
                                <option value="PA">PA - Pasaporte</option>
                                <option value="RC">RC - Registro Civil</option>
                                <option value="MS">MS - Menor sin ID</option>
                                <option value="AS">AS - Adulto sin ID</option>
                            </select>
                        </div>

                        {/* Número Documento */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Documento <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={nuevoAfiliado.id}
                                disabled
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-sm font-mono"
                            />
                        </div>

                        {/* Nombres */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Nombres <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={nuevoAfiliado.nombres}
                                onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, nombres: e.target.value.toUpperCase() }))}
                                placeholder="NOMBRES"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Primer Apellido */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Primer Apellido <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={nuevoAfiliado.apellido1}
                                onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, apellido1: e.target.value.toUpperCase() }))}
                                placeholder="PRIMER APELLIDO"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Segundo Apellido */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Segundo Apellido
                            </label>
                            <input
                                type="text"
                                value={nuevoAfiliado.apellido2 || ''}
                                onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, apellido2: e.target.value.toUpperCase() }))}
                                placeholder="SEGUNDO APELLIDO"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Sexo */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Sexo
                            </label>
                            <select
                                value={nuevoAfiliado.sexo}
                                onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, sexo: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">Seleccionar...</option>
                                {SEXO_LISTA.map((s) => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Fecha Nacimiento */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Fecha Nacimiento
                            </label>
                            <input
                                type="date"
                                value={nuevoAfiliado.fechaNacimiento || ''}
                                onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, fechaNacimiento: e.target.value }))}
                                max={getFechaHoyColombia()}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Teléfono */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Teléfono
                            </label>
                            <input
                                type="tel"
                                value={nuevoAfiliado.telefono || ''}
                                onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, telefono: e.target.value }))}
                                placeholder="Celular"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Municipio */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Municipio
                            </label>
                            <Autocomplete
                                value={municipioNombre}
                                onChange={(val: string) => {
                                    const municipio = MUNICIPIOS_CORDOBA.find((m) => m.nombre === val)
                                    setMunicipioNombre(val)
                                    setNuevoAfiliado(prev => ({
                                        ...prev,
                                        municipio: municipio?.codigo || '',
                                        departamento: municipio?.departamento || '23',
                                    }))
                                }}
                                options={MUNICIPIOS_CORDOBA.map((m) => m.nombre)}
                                placeholder="Buscar municipio..."
                                allowFreeText={false}
                            />
                        </div>

                        {/* EPS */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                EPS
                            </label>
                            <select
                                value={nuevoAfiliado.eps}
                                onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, eps: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">Seleccionar...</option>
                                {EPS_LISTA.map((eps) => (
                                    <option key={eps} value={eps}>{eps}</option>
                                ))}
                            </select>
                        </div>

                        {/* Régimen */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Régimen
                            </label>
                            <select
                                value={nuevoAfiliado.regimen}
                                onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, regimen: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">Seleccionar...</option>
                                {REGIMEN_LISTA.map((r) => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Tipo Cotizante */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Tipo Cotizante
                            </label>
                            <select
                                value={nuevoAfiliado.tipoCotizante}
                                onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, tipoCotizante: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">Seleccionar...</option>
                                {TIPO_COTIZANTE_LISTA.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* IPS Primaria */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                IPS Primaria
                            </label>
                            <Autocomplete
                                value={nuevoAfiliado.ipsPrimaria || ''}
                                onChange={(val: string) => setNuevoAfiliado(prev => ({ ...prev, ipsPrimaria: val }))}
                                options={IPS_PRIMARIA_LISTA as unknown as string[]}
                                placeholder="Buscar IPS..."
                                allowFreeText={true}
                            />
                        </div>
                    </div>

                    {/* Botón guardar */}
                    <div className="mt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={handleCrearPaciente}
                            disabled={creandoAfiliado || !nuevoAfiliado.nombres || !nuevoAfiliado.apellido1}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm shadow-lg shadow-primary-500/20"
                        >
                            <Save size={16} />
                            {creandoAfiliado ? 'Guardando...' : 'Guardar y Continuar'}
                        </button>
                    </div>
                </div>
            )}

            {/* Datos del paciente encontrado */}
            {paciente && (
                <div className="space-y-3">
                    {/* Nombre completo */}
                    <div className="flex items-center gap-3">
                        <User size={18} className="text-primary-500 flex-shrink-0" />
                        <span className="font-bold text-slate-900 text-lg">{nombreCompleto}</span>
                        {paciente.sexo && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                paciente.sexo === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                                {paciente.sexo === 'F' ? 'Femenino' : 'Masculino'}
                            </span>
                        )}
                    </div>

                    {/* Información en una línea con iconos */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        {/* Identificación */}
                        <div className="flex items-center gap-1.5">
                            <IdCard size={14} className="text-slate-400 flex-shrink-0" />
                            <span className="font-semibold text-slate-800">
                                {paciente.tipoIdNombre} {paciente.id}
                            </span>
                        </div>

                        {/* Edad */}
                        {paciente.edad !== undefined && (
                            <div className="flex items-center gap-1.5">
                                <Calendar size={14} className="text-primary-500 flex-shrink-0" />
                                <span className="font-bold text-primary-600">{paciente.edad} años</span>
                            </div>
                        )}

                        {/* Teléfono */}
                        {paciente.telefono && (
                            <div className="flex items-center gap-1.5">
                                <Phone size={14} className="text-slate-400 flex-shrink-0" />
                                <span className="text-slate-700">{paciente.telefono}</span>
                            </div>
                        )}

                        {/* IPS Primaria */}
                        {paciente.ipsPrimaria && (
                            <div className="flex items-center gap-1.5">
                                <Building2 size={14} className="text-green-500 flex-shrink-0" />
                                <span className="text-slate-700">{paciente.ipsPrimaria}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Placeholder cuando no hay paciente */}
            {!paciente && !error && !notFound && (
                <div className="text-center py-6 text-slate-400">
                    <User size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Busque un paciente por su identificación</p>
                </div>
            )}
        </div>
    )
}

export default PacienteFrame
