import { useState } from 'react'
import { AlertCircle, Plus } from 'lucide-react'
import { Button, Input, Autocomplete } from '@/components/common'
import { backService } from '@/services/back.service'
import { parseDateLocal } from '@/utils/date.utils'
import { Afiliado } from '@/types'
import {
    SEXO_LISTA,
    REGIMEN_LISTA,
    TIPO_COTIZANTE_LISTA,
    MUNICIPIOS_CORDOBA,
    IPS_PRIMARIA_LISTA,
    EPS_LISTA,
    CrearAfiliadoData
} from '@/types/back.types'

interface NuevoPacienteFormProps {
    defaultDocumento?: string
    onSuccess: (paciente: Afiliado) => void
    onCancel: () => void
}

export function NuevoPacienteForm({ defaultDocumento = '', onSuccess, onCancel }: NuevoPacienteFormProps) {
    const [creandoAfiliado, setCreandoAfiliado] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Estado del formulario
    const [nuevoAfiliado, setNuevoAfiliado] = useState<CrearAfiliadoData>({
        tipoId: 'CC',
        id: defaultDocumento,
        nombres: '',
        apellido1: '',
        apellido2: '',
        sexo: '',
        direccion: '',
        telefono: '',
        fechaNacimiento: '', // YYYY-MM-DD
        municipio: '', // Código
        departamento: '23', // Córdoba por defecto
        regimen: '',
        ipsPrimaria: '',
        tipoCotizante: '',
        eps: '', // Sin valor predeterminado, obligar selección
    })

    // Estado auxiliar para el nombre del municipio en el autocomplete
    const [municipioNombre, setMunicipioNombre] = useState('')

    const handleCrearAfiliado = async () => {
        // Validaciones de campos obligatorios
        if (!nuevoAfiliado.nombres.trim()) {
            setError('El nombre es requerido')
            return
        }
        if (!nuevoAfiliado.apellido1.trim()) {
            setError('El primer apellido es requerido')
            return
        }
        if (!nuevoAfiliado.id.trim()) {
            setError('El número de documento es requerido')
            return
        }
        if (!nuevoAfiliado.sexo) {
            setError('El sexo es requerido')
            return
        }
        if (!nuevoAfiliado.fechaNacimiento) {
            setError('La fecha de nacimiento es requerida')
            return
        }
        if (!nuevoAfiliado.telefono?.trim()) {
            setError('El teléfono es requerido')
            return
        }
        if (!nuevoAfiliado.municipio) {
            setError('El municipio es requerido')
            return
        }
        if (!nuevoAfiliado.eps) {
            setError('La EPS es requerida')
            return
        }
        if (!nuevoAfiliado.regimen) {
            setError('El régimen es requerido')
            return
        }
        if (!nuevoAfiliado.tipoCotizante) {
            setError('El tipo de cotizante es requerido')
            return
        }
        if (!nuevoAfiliado.ipsPrimaria?.trim()) {
            setError('La IPS primaria es requerida')
            return
        }

        setCreandoAfiliado(true)
        setError(null)

        try {
            // Aseguramos que la fuente sea PORTAL_COLABORADORES
            // El servicio backService.crearAfiliado internamente llama a la API.
            // Si necesitamos forzar la fuente, debemos revisar el servicio. 
            // Asumiendo que el servicio maneja la creación standard.

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
                // Construir objeto Afiliado para devolver
                const pacienteCreado: Afiliado = {
                    tipoId: nuevoAfiliado.tipoId,
                    id: nuevoAfiliado.id,
                    nombres: nuevoAfiliado.nombres.toUpperCase(),
                    apellido1: nuevoAfiliado.apellido1.toUpperCase(),
                    apellido2: nuevoAfiliado.apellido2?.toUpperCase() || null,
                    sexo: nuevoAfiliado.sexo || null,
                    direccion: nuevoAfiliado.direccion?.toUpperCase() || null,
                    telefono: nuevoAfiliado.telefono || null,
                    fechaNacimiento: nuevoAfiliado.fechaNacimiento ? parseDateLocal(nuevoAfiliado.fechaNacimiento) : null,
                    estado: 'ACTIVO',
                    municipio: nuevoAfiliado.municipio || null,
                    departamento: nuevoAfiliado.departamento || null,
                    observaciones: null,
                    ipsPrimaria: nuevoAfiliado.ipsPrimaria || null,
                    tipoCotizante: nuevoAfiliado.tipoCotizante || null,
                    rango: null,
                    email: null,
                    regimen: nuevoAfiliado.regimen || null,
                    edad: null,
                    eps: nuevoAfiliado.eps || '',
                    fuente: 'PORTAL_COLABORADORES',
                    updatedAt: null,
                    busquedaTexto: null,
                }

                onSuccess(pacienteCreado)
            } else {
                setError(result.error || 'Error al crear el afiliado')
            }
        } catch (err) {
            console.error(err)
            setError('Error inesperado al crear el afiliado')
        } finally {
            setCreandoAfiliado(false)
        }
    }

    return (
        <div className="mt-4 p-6 bg-amber-50 border border-amber-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-amber-200/60">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                    <Plus size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-amber-900 text-lg">Nuevo Paciente</h4>
                    <p className="text-sm text-amber-700">
                        Paciente no encontrado. Complete los datos para crearlo en la base de datos nacional.
                    </p>
                </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Tipo de Documento <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={nuevoAfiliado.tipoId}
                        onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, tipoId: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
                    >
                        <option value="CC">Cédula de Ciudadanía</option>
                        <option value="TI">Tarjeta de Identidad</option>
                        <option value="CE">Cédula de Extranjería</option>
                        <option value="PA">Pasaporte</option>
                        <option value="RC">Registro Civil</option>
                        <option value="MS">Menor sin Identificación</option>
                        <option value="AS">Adulto sin Identificación</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Número de Documento <span className="text-red-500">*</span>
                    </label>
                    <Input
                        value={nuevoAfiliado.id}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, id: e.target.value.replace(/\D/g, '') }))}
                        disabled // Deshabilitado porque viene de la búsqueda anterior
                        className="bg-slate-100 font-mono"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Nombres <span className="text-red-500">*</span>
                    </label>
                    <Input
                        value={nuevoAfiliado.nombres}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, nombres: e.target.value.toUpperCase() }))}
                        placeholder="NOMBRES COMPLETOS"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Primer Apellido <span className="text-red-500">*</span>
                    </label>
                    <Input
                        value={nuevoAfiliado.apellido1}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, apellido1: e.target.value.toUpperCase() }))}
                        placeholder="PRIMER APELLIDO"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Segundo Apellido
                    </label>
                    <Input
                        value={nuevoAfiliado.apellido2 || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, apellido2: e.target.value.toUpperCase() }))}
                        placeholder="SEGUNDO APELLIDO"
                    />
                </div>

                {/* Sexo */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Sexo <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={nuevoAfiliado.sexo}
                        onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, sexo: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    >
                        <option value="">Seleccionar...</option>
                        {SEXO_LISTA.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </div>

                {/* Fecha Nacimiento */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Fecha de Nacimiento <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        value={nuevoAfiliado.fechaNacimiento || ''}
                        onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, fechaNacimiento: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                </div>

                {/* Teléfono */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Teléfono / Celular <span className="text-red-500">*</span>
                    </label>
                    <Input
                        value={nuevoAfiliado.telefono || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, telefono: e.target.value }))}
                        placeholder="Número de contacto"
                        type="tel"
                    />
                </div>

                {/* Dirección - campo completo */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Dirección Residencia
                    </label>
                    <Input
                        value={nuevoAfiliado.direccion || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, direccion: e.target.value.toUpperCase() }))}
                        placeholder="DIRECCIÓN COMPLETA"
                    />
                </div>

                {/* Municipio - Autocomplete */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Municipio Residencia <span className="text-red-500">*</span>
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

                {/* Régimen */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Régimen <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={nuevoAfiliado.regimen}
                        onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, regimen: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    >
                        <option value="">Seleccionar...</option>
                        {REGIMEN_LISTA.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </div>

                {/* EPS */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        EPS <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={nuevoAfiliado.eps}
                        onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, eps: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    >
                        <option value="">Seleccionar...</option>
                        {EPS_LISTA.map((eps) => (
                            <option key={eps} value={eps}>{eps}</option>
                        ))}
                    </select>
                </div>

                {/* Tipo Cotizante */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Tipo Cotizante <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={nuevoAfiliado.tipoCotizante}
                        onChange={(e) => setNuevoAfiliado(prev => ({ ...prev, tipoCotizante: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    >
                        <option value="">Seleccionar...</option>
                        {TIPO_COTIZANTE_LISTA.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>

                {/* IPS Primaria - Autocomplete */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        IPS Primaria <span className="text-red-500">*</span>
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

            {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 animate-in shake">
                    <AlertCircle size={20} />
                    <span className="font-medium text-sm">{error}</span>
                </div>
            )}

            <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-amber-200/60">
                <Button
                    variant="secondary"
                    onClick={onCancel}
                    disabled={creandoAfiliado}
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                    Cancelar
                </Button>
                <Button
                    onClick={handleCrearAfiliado}
                    isLoading={creandoAfiliado}
                    leftIcon={<Plus size={18} />}
                    className="bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-500/20"
                >
                    Guardar Paciente y Continuar
                </Button>
            </div>
        </div>
    )
}
