/**
 * Tab de Registro de Caso para Salud Oral
 * Formulario completo para registrar una atención odontológica
 */

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Save, MapPin } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useCrearSaludOral } from '../hooks/useSaludOral'
import { contactosService } from '@/services/contactos.service'
import { getDefaultOdRegistro } from '../schemas/saludOral.schema'
import type { OdRegistroFormData } from '../schemas/saludOral.schema'
import type { OdRegistro, Sede } from '@/types/saludOral.types'
import { useActualizarSaludOral } from '../hooks/useSaludOral'
import { X } from 'lucide-react'

import { PacienteFrame } from './PacienteFrame'
import { PoblacionesEspecialesFrame } from './PoblacionesEspecialesFrame'
import { IndiceCopFrame } from './IndiceCopFrame'
import { PymFrame } from './PymFrame'
import { ProcedimientosFrame } from './ProcedimientosFrame'

const SEDES_OPTIONS: Sede[] = ['Montería', 'Cereté', 'Ciénaga de Oro']

interface RegistroCasoTabProps {
    onSuccess?: () => void
    initialData?: OdRegistro
    onCancel?: () => void
}

export function RegistroCasoTab({ onSuccess, initialData, onCancel }: RegistroCasoTabProps) {
    const { user } = useAuth()
    const crearMutation = useCrearSaludOral()
    const actualizarMutation = useActualizarSaludOral()
    const isEditing = !!initialData

    // Estado del formulario
    const [formData, setFormData] = useState<OdRegistroFormData>(
        getDefaultOdRegistro(user?.email || '')
    )

    // Estado del paciente encontrado (para obtener edad, sexo e IPS primaria)
    const [pacienteEdad, setPacienteEdad] = useState<number | null>(null)
    const [pacienteSexo, setPacienteSexo] = useState<'M' | 'F' | null>(null)
    const [pacienteIpsPrimaria, setPacienteIpsPrimaria] = useState<string | null>(null)

    // Cargar sede del usuario a partir de su identificación
    useEffect(() => {
        const cargarSedeUsuario = async () => {
            if (user?.identificacion) {
                try {
                    const { data } = await contactosService.obtenerPorIdentificacion(user.identificacion)
                    if (data?.ciudad) {
                        // Verificar si la ciudad está en las opciones válidas
                        // Normalizamos comparando textualmente por si acaso
                        const ciudadEncontrada = SEDES_OPTIONS.find(
                            sede => sede.toLowerCase() === data.ciudad.toLowerCase()
                        )

                        if (ciudadEncontrada) {
                            setFormData(prev => ({
                                ...prev,
                                sede: ciudadEncontrada
                            }))
                        }
                    }
                } catch (error) {
                    console.error('Error cargando sede del usuario:', error)
                }
            }
        }

        cargarSedeUsuario()
    }, [user?.identificacion])

    // Cargar datos iniciales si estamos editando
    useEffect(() => {
        if (initialData) {
            // Extraer solo los campos del formulario
            const { id, createdAt, updatedAt, ...rest } = initialData

            // Asegurar fecha correcta (YYYY-MM-DD)
            const fechaRegistro = new Date(rest.fechaRegistro).toISOString().split('T')[0]

            setFormData({
                ...rest,
                fechaRegistro,
                // Asegurar tipos correctos para selects opcionales
                tipoConsulta: rest.tipoConsulta || null,
                terapiaConductoTipo: rest.terapiaConductoTipo || null,
                terapiaConductoRaices: rest.terapiaConductoRaices || null,
                exodonciaTipo: rest.exodonciaTipo || null,
                exodonciaRaices: rest.exodonciaRaices || null,
            })

            // Simular búsqueda de paciente para cargar datos demográficos básicos si es necesario
            // O idealmente PacienteFrame debería hacer esto automáticamente con el ID
        } else {
            // Si dejamos de editar (ej: cancelar), resetear
            // Pero cuidado con loops, mejor solo reset si initialData pasa a undefined explícitamente y queremos limpiar
            // Por ahora asumimos que el componente se desmonta o initialData cambia
        }
    }, [initialData])

    // Fecha máxima permitida (hoy)
    const fechaMaxima = new Date().toISOString().split('T')[0]

    // Manejar cambios genéricos
    const handleChange = <K extends keyof OdRegistroFormData>(key: K, value: OdRegistroFormData[K]) => {
        setFormData((prev) => ({ ...prev, [key]: value }))
    }

    // Manejar paciente encontrado - resetea todos los campos clínicos al cambiar de paciente
    const handlePacienteFound = (paciente: any | null) => {
        if (paciente) {
            // Guardar valores que se deben mantener
            const sedeActual = formData.sede
            const fechaActual = formData.fechaRegistro

            // Resetear formulario a valores predeterminados
            const nuevoFormData = getDefaultOdRegistro(user?.email || '')
            nuevoFormData.pacienteId = paciente.id
            nuevoFormData.sede = sedeActual
            nuevoFormData.fechaRegistro = fechaActual

            // Aplicar lógica según edad y sexo del paciente
            if (paciente.edad !== undefined && paciente.edad < 5) {
                nuevoFormData.menor5Anios = true
            }

            setFormData(nuevoFormData)
            setPacienteEdad(paciente.edad ?? null)
            setPacienteSexo(paciente.sexo ?? null)
            setPacienteIpsPrimaria(paciente.ipsPrimaria ?? null)
        } else {
            setPacienteEdad(null)
            setPacienteSexo(null)
            setPacienteIpsPrimaria(null)
        }
    }

    // Guardar registro
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.pacienteId.trim()) {
            toast.error('Debe buscar y seleccionar un paciente')
            return
        }

        if (!formData.sede) {
            toast.error('Debe seleccionar una sede')
            return
        }

        if (!formData.tipoConsulta) {
            toast.error('Debe seleccionar un tipo de consulta')
            return
        }

        try {
            if (isEditing && initialData) {
                await actualizarMutation.mutateAsync({
                    id: initialData.id,
                    data: formData,
                })
                toast.success('Registro actualizado correctamente')
            } else {
                await crearMutation.mutateAsync({
                    ...formData,
                    colaboradorEmail: user?.email || '',
                })
                toast.success('Registro guardado correctamente')
            }

            // Resetear formulario
            handleReset()

            onSuccess?.()
        } catch (error: any) {
            toast.error(error.message || 'Error al guardar el registro')
        }
    }

    // Resetear formulario
    const handleReset = () => {
        setFormData(getDefaultOdRegistro(user?.email || ''))
        setPacienteEdad(null)
        setPacienteSexo(null)
        setPacienteIpsPrimaria(null)
        if (isEditing && onCancel) {
            onCancel()
        }
    }

    // Determinar si hay un paciente seleccionado
    const hasPaciente = formData.pacienteId.trim() !== ''

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Encabezado con Sede y Fecha */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            <MapPin size={14} className="inline mr-1" />
                            Sede *
                        </label>
                        <select
                            value={formData.sede}
                            onChange={(e) => handleChange('sede', e.target.value as Sede)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            required
                        >
                            <option value="">Seleccione una sede...</option>
                            {SEDES_OPTIONS.map((sede) => (
                                <option key={sede} value={sede}>
                                    {sede}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Fecha de Registro
                        </label>
                        <input
                            type="date"
                            value={formData.fechaRegistro}
                            onChange={(e) => handleChange('fechaRegistro', e.target.value)}
                            max={fechaMaxima}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Colaborador
                        </label>
                        <input
                            type="text"
                            value={user?.nombreCompleto || user?.email || ''}
                            disabled
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600"
                        />
                    </div>
                </div>
            </div>

            {/* Datos del Paciente */}
            <div className={isEditing ? 'opacity-80 pointer-events-none' : ''}>
                <PacienteFrame
                    pacienteId={formData.pacienteId}
                    onPacienteIdChange={(id) => handleChange('pacienteId', id)}
                    onPacienteFound={handlePacienteFound}
                />
            </div>

            {/* Mostrar formulario solo si hay paciente seleccionado */}
            {hasPaciente ? (
                <>
                    {/* Poblaciones Especiales */}
                    <PoblacionesEspecialesFrame
                        values={{
                            gestante: formData.gestante,
                            cronicosHta: formData.cronicosHta,
                            cronicosDm: formData.cronicosDm,
                            cronicosErc: formData.cronicosErc,
                            discapacidad: formData.discapacidad,
                            hemofilia: formData.hemofilia,
                            vih: formData.vih,
                            cancer: formData.cancer,
                            menor5Anios: formData.menor5Anios,
                        }}
                        onChange={(key, value) => handleChange(key, value)}
                        sexoPaciente={pacienteSexo}
                        edadPaciente={pacienteEdad}
                    />

                    {/* Índice COP */}
                    <IndiceCopFrame
                        values={{
                            copCariesNoCavitacional: formData.copCariesNoCavitacional,
                            copCariesCavitacional: formData.copCariesCavitacional,
                            copObturados: formData.copObturados,
                            copPerdidos: formData.copPerdidos,
                            copSanos: formData.copSanos,
                        }}
                        onChange={(key, value) => handleChange(key, value)}
                        edadPaciente={pacienteEdad}
                    />

                    {/* PyM */}
                    <PymFrame
                        values={{
                            pymControlPlaca: formData.pymControlPlaca,
                            pymSellantes: formData.pymSellantes,
                            pymSellantesCantidad: formData.pymSellantesCantidad,
                            pymFluorBarniz: formData.pymFluorBarniz,
                            pymDetartraje: formData.pymDetartraje,
                            pymProfilaxis: formData.pymProfilaxis,
                            pymEducacion: formData.pymEducacion,
                        }}
                        onChange={(key, value) => handleChange(key as keyof OdRegistroFormData, value as any)}
                        edadPaciente={pacienteEdad}
                    />

                    {/* Procedimientos */}
                    <ProcedimientosFrame
                        values={{
                            tipoConsulta: formData.tipoConsulta,
                            remisionEspecialidades: formData.remisionEspecialidades,
                            resina1sup: formData.resina1sup,
                            resina2sup: formData.resina2sup,
                            resina3sup: formData.resina3sup,
                            ionomero1sup: formData.ionomero1sup,
                            ionomero2sup: formData.ionomero2sup,
                            ionomero3sup: formData.ionomero3sup,
                            obturacionTemporal: formData.obturacionTemporal,
                            pulpectomia: formData.pulpectomia,
                            pulpotomia: formData.pulpotomia,
                            terapiaConductoTipo: formData.terapiaConductoTipo,
                            terapiaConductoRaices: formData.terapiaConductoRaices,
                            terapiaConductoCantidad: formData.terapiaConductoCantidad,
                            exodonciaTipo: formData.exodonciaTipo,
                            exodonciaRaices: formData.exodonciaRaices,
                            exodonciaIncluido: formData.exodonciaIncluido,
                            exodonciaCantidad: formData.exodonciaCantidad,
                            controlPostquirurgico: formData.controlPostquirurgico,
                            rxSuperiores: formData.rxSuperiores,
                            rxInferiores: formData.rxInferiores,
                            rxMolares: formData.rxMolares,
                            rxPremolares: formData.rxPremolares,
                            rxCaninos: formData.rxCaninos,
                            tratamientoFinalizado: formData.tratamientoFinalizado,
                        }}
                        onChange={handleChange}
                        ipsPrimaria={pacienteIpsPrimaria}
                    />

                    {/* Botones de acción */}
                    <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm border-t border-slate-200 -mx-6 px-6 py-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={handleReset}
                            className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium flex items-center gap-2"
                        >
                            {isEditing ? <X size={18} /> : null}
                            {isEditing ? 'Cancelar Edición' : 'Limpiar'}
                        </button>
                        <button
                            type="submit"
                            disabled={crearMutation.isPending || actualizarMutation.isPending || !formData.pacienteId}
                            className="px-6 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2 shadow-lg shadow-primary-500/30"
                        >
                            <Save size={18} />
                            {crearMutation.isPending || actualizarMutation.isPending
                                ? (isEditing ? 'Actualizando...' : 'Guardando...')
                                : (isEditing ? 'Actualizar Registro' : 'Guardar Registro')
                            }
                        </button>
                    </div>
                </>
            ) : (
                // Estado inicial: sin paciente seleccionado
                <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-2xl border-2 border-dashed border-primary-300 p-12">
                    <div className="text-center max-w-md mx-auto">
                        <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Save size={40} className="text-primary-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">
                            Busque y Seleccione un Paciente
                        </h3>
                        <p className="text-slate-600 text-sm leading-relaxed">
                            Para iniciar el registro de atención odontológica, primero debe buscar
                            al paciente por su número de identificación en el campo de arriba.
                        </p>
                        <div className="mt-6 p-4 bg-white/70 rounded-xl border border-primary-200">
                            <p className="text-xs text-slate-500 italic">
                                💡 El formulario de captura se habilitará automáticamente una vez que seleccione un paciente
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </form>
    )
}

export default RegistroCasoTab
