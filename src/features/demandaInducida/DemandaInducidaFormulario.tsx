/**
 * Formulario de Radicación de Demanda Inducida
 * Con lógica condicional basada en JotForm
 */

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { demandaInducidaService } from '@/services/demandaInducidaService'
import type { DemandaInducidaFormData } from '@/types/demandaInducida'
import {
    RELACIONES_USUARIO,
    ACTIVIDADES_REALIZADAS,
    CONDICIONES_USUARIO,
    RESULTADOS_LLAMADA,
    PROGRAMAS_DIRECCIONADOS,
} from '@/types/demandaInducida'
import { Search, AlertCircle, CheckCircle, UserPlus } from 'lucide-react'

export function DemandaInducidaFormulario() {
    const { user } = useAuth()

    // Estado del formulario
    const [formData, setFormData] = useState<DemandaInducidaFormData>({
        tipoId: 'CC',
        identificacion: '',
        fechaGestion: new Date().toISOString().split('T')[0],
        clasificacion: 'Efectivo',
        celular: '',
        horaLlamada: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }),
        actividadesRealizadas: 'Canalización a programas',
        condicionUsuario: 'Vivo',
    })

    // Estados de UI
    const [pacienteBuscado, setPacienteBuscado] = useState<any | null>(null)
    const [buscandoPaciente, setBuscandoPaciente] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

    /**
     * Buscar paciente en BD
     */
    const handleBuscarPaciente = async () => {
        if (!formData.identificacion) {
            setMensaje({ tipo: 'error', texto: 'Ingrese un número de identificación' })
            return
        }

        setBuscandoPaciente(true)
        setMensaje(null)

        try {
            const { existe, data } = await demandaInducidaService.verificarPacienteExiste(
                formData.identificacion
            )

            if (existe && data) {
                setPacienteBuscado(data)
                // Autocompletar datos del formulario
                setFormData((prev) => ({
                    ...prev,
                    tipoId: data.tipo_id || prev.tipoId,
                    identificacion: data.id || prev.identificacion,
                    celular: data.telefono || '',
                    telefonoActualizado: data.telefono || '',
                    departamento: data.departamento || '',
                    municipio: data.municipio || '',
                }))
                setMensaje({
                    tipo: 'success',
                    texto: `Paciente encontrado: ${data.nombres} ${data.apellido1} ${data.apellido2}`,
                })
            } else {
                setPacienteBuscado(null)
                setMensaje({
                    tipo: 'error',
                    texto: 'Paciente no encontrado. Se creará uno nuevo al radicar.',
                })
            }
        } catch (error) {
            setMensaje({ tipo: 'error', texto: 'Error al buscar paciente' })
        } finally {
            setBuscandoPaciente(false)
        }
    }

    /**
     * Maneja cambios en los campos del formulario
     */
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    /**
     * Enviar formulario
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setGuardando(true)
        setMensaje(null)

        try {
            // Validaciones básicas
            if (!formData.identificacion || !formData.fechaGestion || !formData.clasificacion) {
                throw new Error('Complete los campos obligatorios')
            }

            if (formData.clasificacion === 'No Efectivo' && !formData.resultadoLlamada) {
                throw new Error('Seleccione el resultado de la llamada')
            }

            if (formData.clasificacion === 'Efectivo') {
                if (!formData.quienRecibeLlamada) throw new Error('Ingrese quién recibe la llamada')
                if (!formData.relacionUsuario) throw new Error('Seleccione la relación con el usuario')
                if (!formData.textoLlamada) throw new Error('Ingrese el texto de la llamada')
            }

            // Crear caso
            await demandaInducidaService.create(formData, user?.nombreCompleto || 'Sistema')

            setMensaje({ tipo: 'success', texto: '✅ Caso registrado exitosamente' })

            // Limpiar formulario
            setTimeout(() => {
                window.location.reload()
            }, 2000)
        } catch (error) {
            setMensaje({
                tipo: 'error',
                texto: error instanceof Error ? error.message : 'Error al registrar caso',
            })
        } finally {
            setGuardando(false)
        }
    }

    const { clasificacion } = formData

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Mensajes */}
            {mensaje && (
                <div
                    className={`p-4 rounded-xl border flex items-start gap-3 ${mensaje.tipo === 'success'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                >
                    {mensaje.tipo === 'success' ? (
                        <CheckCircle size={20} />
                    ) : (
                        <AlertCircle size={20} />
                    )}
                    <p className="text-sm font-medium">{mensaje.texto}</p>
                </div>
            )}

            {/* Sección 1: Identificación del Paciente */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Search size={20} className="text-primary-500" />
                    Identificación del Paciente
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Identificación o Nombre del Paciente <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="identificacion"
                            value={formData.identificacion}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="Número de documento o nombre completo"
                            required
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={handleBuscarPaciente}
                            disabled={buscandoPaciente || !formData.identificacion}
                            className="w-full px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <Search size={18} />
                            {buscandoPaciente ? 'Buscando...' : 'Buscar Paciente'}
                        </button>
                    </div>
                </div>

                {/* Información del paciente encontrado */}
                {pacienteBuscado && (
                    <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
                        <p className="text-sm font-semibold text-green-800">
                            ✓ {pacienteBuscado.nombres} {pacienteBuscado.apellido1}{' '}
                            {pacienteBuscado.apellido2}
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                            {pacienteBuscado.departamento} - {pacienteBuscado.municipio}
                        </p>
                    </div>
                )}
            </section>

            {/* Sección 2: Datos de Gestión */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Datos de Gestión</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Fecha Gestión <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            name="fechaGestion"
                            value={formData.fechaGestion}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Celular</label>
                        <input
                            type="tel"
                            name="celular"
                            value={formData.celular}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="3001234567"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Hora Llamada
                        </label>
                        <input
                            type="time"
                            name="horaLlamada"
                            value={formData.horaLlamada}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Clasificación <span className="text-red-500">*</span>
                    </label>
                    <select
                        name="clasificacion"
                        value={formData.clasificacion}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-semibold"
                        required
                    >
                        <option value="Efectivo">Efectivo</option>
                        <option value="No Efectivo">No Efectivo</option>
                    </select>
                </div>
            </section>

            {/* Sección 3: Campos Condicionales según Clasificación */}
            {clasificacion === 'No Efectivo' ? (
                <section className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
                    <h3 className="text-lg font-bold text-amber-900 mb-4">Llamada No Efectiva</h3>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Resultado Llamada <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="resultadoLlamada"
                            value={formData.resultadoLlamada || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 rounded-xl border border-amber-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            required
                        >
                            <option value="">Seleccione...</option>
                            {RESULTADOS_LLAMADA.map((resultado) => (
                                <option key={resultado} value={resultado}>
                                    {resultado}
                                </option>
                            ))}
                        </select>
                    </div>
                </section>
            ) : (
                <section className="bg-green-50 rounded-2xl border border-green-200 p-6 space-y-4">
                    <h3 className="text-lg font-bold text-green-900 mb-4">Llamada Efectiva</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Quién recibe llamada <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="quienRecibeLlamada"
                                value={formData.quienRecibeLlamada || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                placeholder="Nombre de quien atiende"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Relación con el usuario <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="relacionUsuario"
                                value={formData.relacionUsuario || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            >
                                <option value="">Seleccione...</option>
                                {RELACIONES_USUARIO.map((relacion) => (
                                    <option key={relacion} value={relacion}>
                                        {relacion}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Texto Llamada <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            name="textoLlamada"
                            value={formData.textoLlamada || ''}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            placeholder="Descripción de la llamada..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Actividades realizadas
                            </label>
                            <select
                                name="actividadesRealizadas"
                                value={formData.actividadesRealizadas || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            >
                                <option value="">Seleccione...</option>
                                {ACTIVIDADES_REALIZADAS.map((actividad) => (
                                    <option key={actividad} value={actividad}>
                                        {actividad}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Condición Usuario
                            </label>
                            <select
                                name="condicionUsuario"
                                value={formData.condicionUsuario || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            >
                                <option value="">Seleccione...</option>
                                {CONDICIONES_USUARIO.map((condicion) => (
                                    <option key={condicion} value={condicion}>
                                        {condicion}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Soportes Recuperados
                            </label>
                            <input
                                type="text"
                                name="soportesRecuperados"
                                value={formData.soportesRecuperados || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Fecha Asignación Cita
                            </label>
                            <input
                                type="date"
                                name="fechaAsignacionCita"
                                value={formData.fechaAsignacionCita || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Departamento
                            </label>
                            <input
                                type="text"
                                name="departamento"
                                value={formData.departamento || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Municipio</label>
                            <input
                                type="text"
                                name="municipio"
                                value={formData.municipio || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Teléfono Actualizado
                            </label>
                            <input
                                type="tel"
                                name="telefonoActualizado"
                                value={formData.telefonoActualizado || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Programa direccionado
                            </label>
                            <select
                                name="programaDireccionado"
                                value={formData.programaDireccionado || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            >
                                <option value="">Seleccione...</option>
                                {PROGRAMAS_DIRECCIONADOS.map((programa) => (
                                    <option key={programa} value={programa}>
                                        {programa}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>
            )}

            {/* Botón de Submit */}
            <div className="flex justify-end gap-4">
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-8 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={guardando}
                    className="px-8 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
                >
                    <UserPlus size={18} />
                    {guardando ? 'Registrando...' : 'Registrar Caso'}
                </button>
            </div>
        </form>
    )
}
