import { useState, useEffect } from 'react'
import {
    X, User, Calendar, Phone, MapPin, ClipboardList,
    Info, Timer, FileText, Edit2, Save, Activity,
    AlertCircle
} from 'lucide-react'
import type { DemandaInducida } from '@/types/demandaInducida'
import {
    RELACIONES_USUARIO, ACTIVIDADES_REALIZADAS,
    CONDICIONES_USUARIO, RESULTADOS_LLAMADA,
    PROGRAMAS_DIRECCIONADOS
} from '@/types/demandaInducida'
import { demandaInducidaService } from '@/services/demandaInducidaService'
import { useAuth } from '@/context/AuthContext'

interface DemandaDetallePanelProps {
    caso: DemandaInducida
    onClose: () => void
    onUpdate?: () => void
}

/**
 * Componente interno para renderizar filas de detalle o campos de edición
 * Definido fuera para evitar pérdida de foco al editar
 */
const DetailRow = ({
    label,
    value,
    icon: Icon,
    name,
    type = 'text',
    options,
    isEditing,
    onChange
}: {
    label: string
    value: string | number | null | undefined
    icon: any
    name: string
    type?: string
    options?: string[]
    isEditing: boolean
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
}) => {
    const displayValue = value || ''

    if (isEditing) {
        return (
            <div className="py-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
                    {label}
                </label>
                {options ? (
                    <select
                        name={name}
                        value={displayValue}
                        onChange={onChange}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                        <option value="">Seleccione...</option>
                        {options.map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                ) : type === 'textarea' ? (
                    <textarea
                        name={name}
                        value={displayValue}
                        onChange={onChange}
                        rows={3}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                ) : (
                    <input
                        type={type}
                        name={name}
                        value={displayValue}
                        onChange={onChange}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                )}
            </div>
        )
    }

    if (!value || value === '' || value === 'N/A') return null

    return (
        <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0 group">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-500 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
                <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-slate-800 break-words">{value}</p>
            </div>
        </div>
    )
}

export function DemandaDetallePanel({ caso, onClose, onUpdate }: DemandaDetallePanelProps) {
    const { user } = useAuth()
    const [isEditing, setIsEditing] = useState(false)
    const [formData, setFormData] = useState<Partial<DemandaInducida>>({ ...caso })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [pacienteNombre, setPacienteNombre] = useState<string>('Cargando...')

    // Cargar nombre del paciente si no viene en el caso
    useEffect(() => {
        const fetchPaciente = async () => {
            try {
                const results = await demandaInducidaService.buscarPacientes(caso.pacienteId)
                const p = results.find(r => r.id === caso.pacienteId)
                if (p) {
                    setPacienteNombre(`${p.nombres} ${p.apellido1} ${p.apellido2}`.trim())
                } else {
                    setPacienteNombre('No encontrado en base de datos')
                }
            } catch (err) {
                console.error('Error cargando paciente:', err)
                setPacienteNombre('Error al cargar')
            }
        }
        fetchPaciente()
    }, [caso.pacienteId])

    // Verificar permisos
    const canEdit = user?.rol === 'superadmin' ||
        user?.rol === 'admin' ||
        caso.colaborador === user?.nombreCompleto

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSave = async () => {
        setSaving(true)
        setError(null)
        try {
            // Validaciones básicas si es Efectivo
            if (formData.clasificacion === 'Efectivo') {
                if (!formData.quienRecibeLlamada) throw new Error('Quién recibe llamada es obligatorio')
                if (!formData.relacionUsuario) throw new Error('Relación con usuario es obligatoria')
                if (!formData.textoLlamada) throw new Error('Texto de llamada es obligatorio')
            } else if (formData.clasificacion === 'No Efectivo') {
                if (!formData.resultadoLlamada) throw new Error('Resultado de llamada es obligatorio')
            }

            await demandaInducidaService.update(caso.id, formData)
            setIsEditing(false)
            if (onUpdate) onUpdate()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al actualizar el registro')
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 z-[70] h-full w-full max-w-lg bg-white shadow-2xl transition-transform duration-300 transform translate-x-0 overflow-hidden flex flex-col animate-in slide-in-from-right">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-primary-50 to-white flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">
                            {isEditing ? 'Editando Registro' : 'Detalle del Registro'}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                                ID: {caso.id}
                            </span>
                            {!isEditing && (
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${caso.clasificacion === 'Efectivo'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {caso.clasificacion}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {canEdit && !isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-2 hover:bg-white rounded-xl transition-colors text-primary-600 hover:text-primary-700 shadow-sm border border-primary-100"
                                title="Editar registro"
                            >
                                <Edit2 size={20} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm border border-slate-100"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 animate-in shake">
                            <AlertCircle size={20} />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {/* Clasificación (Solo en edición) */}
                    {isEditing && (
                        <section>
                            <h3 className="text-sm font-bold text-primary-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Activity size={16} /> Clasificación
                            </h3>
                            <div className="bg-slate-50 rounded-2xl p-4">
                                <select
                                    name="clasificacion"
                                    value={formData.clasificacion}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold"
                                >
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="No Efectivo">No Efectivo</option>
                                </select>
                            </div>
                        </section>
                    )}

                    {/* Información del Paciente */}
                    <section>
                        <h3 className="text-sm font-bold text-primary-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <User size={16} /> Información del Paciente
                        </h3>
                        <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
                            <DetailRow label="Nombre Completo" value={pacienteNombre} name="pacienteNombre" icon={User} isEditing={false} onChange={() => { }} />
                            <DetailRow label="Identificación" value={`${caso.pacienteTipoId} ${caso.pacienteId}`} name="pacienteId" icon={Info} isEditing={false} onChange={() => { }} />
                            <DetailRow label="Celular de Contacto" value={formData.celular} name="celular" icon={Phone} isEditing={isEditing} onChange={handleChange} />
                            <DetailRow label="Teléfono Actualizado" value={formData.telefonoActualizado} name="telefonoActualizado" icon={Phone} isEditing={isEditing} onChange={handleChange} />
                        </div>
                    </section>

                    {/* Detalles de la Gestión */}
                    <section>
                        <h3 className="text-sm font-bold text-primary-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ClipboardList size={16} /> Gestión Realizada
                        </h3>
                        <div className="bg-slate-50 rounded-2xl p-4 space-y-1 shadow-sm">
                            <DetailRow label="Fecha Gestión" value={formData.fechaGestion} name="fechaGestion" type="date" icon={Calendar} isEditing={isEditing} onChange={handleChange} />
                            <DetailRow label="Hora Llamada" value={formData.horaLlamada} name="horaLlamada" type="time" icon={Timer} isEditing={isEditing} onChange={handleChange} />

                            {(formData.clasificacion === 'No Efectivo' || isEditing) && (
                                <DetailRow
                                    label="Resultado Llamada"
                                    value={formData.resultadoLlamada}
                                    name="resultadoLlamada"
                                    icon={Info}
                                    options={[...RESULTADOS_LLAMADA]}
                                    isEditing={isEditing}
                                    onChange={handleChange}
                                />
                            )}

                            {(formData.clasificacion === 'Efectivo' || isEditing) && (
                                <>
                                    <DetailRow label="Quién recibió" value={formData.quienRecibeLlamada} name="quienRecibeLlamada" icon={User} isEditing={isEditing} onChange={handleChange} />
                                    <DetailRow
                                        label="Relación con Usuario"
                                        value={formData.relacionUsuario}
                                        name="relacionUsuario"
                                        icon={Info}
                                        options={[...RELACIONES_USUARIO]}
                                        isEditing={isEditing}
                                        onChange={handleChange}
                                    />
                                    <DetailRow
                                        label="Condición del Usuario"
                                        value={formData.condicionUsuario}
                                        name="condicionUsuario"
                                        icon={Activity}
                                        options={[...CONDICIONES_USUARIO]}
                                        isEditing={isEditing}
                                        onChange={handleChange}
                                    />
                                </>
                            )}
                        </div>
                    </section>

                    {/* Acciones y Resultados */}
                    {(formData.clasificacion === 'Efectivo' || isEditing) && (
                        <section>
                            <h3 className="text-sm font-bold text-primary-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Activity size={16} /> Acciones y Canalización
                            </h3>
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-1 shadow-sm">
                                <DetailRow
                                    label="Programa Direccionado"
                                    value={formData.programaDireccionado}
                                    name="programaDireccionado"
                                    icon={ClipboardList}
                                    options={[...PROGRAMAS_DIRECCIONADOS]}
                                    isEditing={isEditing}
                                    onChange={handleChange}
                                />
                                <DetailRow
                                    label="Actividades Realizadas"
                                    value={formData.actividadesRealizadas}
                                    name="actividadesRealizadas"
                                    icon={ClipboardList}
                                    options={[...ACTIVIDADES_REALIZADAS]}
                                    isEditing={isEditing}
                                    onChange={handleChange}
                                />
                                <DetailRow label="Soportes Recuperados" value={formData.soportesRecuperados} name="soportesRecuperados" icon={ClipboardList} isEditing={isEditing} onChange={handleChange} />
                                <DetailRow label="Fecha Asignación Cita" value={formData.fechaAsignacionCita} name="fechaAsignacionCita" type="date" icon={Calendar} isEditing={isEditing} onChange={handleChange} />
                            </div>
                        </section>
                    )}

                    {/* Ubicación */}
                    {(formData.departamento || formData.municipio || isEditing) && (
                        <section>
                            <h3 className="text-sm font-bold text-primary-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <MapPin size={16} /> Ubicación
                            </h3>
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-1 shadow-sm">
                                <DetailRow label="Departamento" value={formData.departamento} name="departamento" icon={MapPin} isEditing={isEditing} onChange={handleChange} />
                                <DetailRow label="Municipio" value={formData.municipio} name="municipio" icon={MapPin} isEditing={isEditing} onChange={handleChange} />
                            </div>
                        </section>
                    )}

                    {/* Texto de la Llamada (Full width) */}
                    {(formData.textoLlamada || isEditing) && (
                        <section>
                            <h3 className="text-sm font-bold text-primary-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <FileText size={16} /> Observaciones / Texto Llamada
                            </h3>
                            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-1 shadow-sm">
                                <DetailRow label="Contenido" value={formData.textoLlamada} name="textoLlamada" type="textarea" icon={FileText} isEditing={isEditing} onChange={handleChange} />
                                {!isEditing && (
                                    <div className="p-4 pt-0">
                                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                            {formData.textoLlamada}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Registro (Datos de Auditoría - Solo Lectura) */}
                    {!isEditing && (
                        <section>
                            <h3 className="text-sm font-bold text-primary-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Info size={16} /> Datos de Auditoría
                            </h3>
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-1 shadow-sm opacity-70">
                                <DetailRow label="Registrado por" value={caso.colaborador} name="colaborador" icon={User} isEditing={false} onChange={() => { }} />
                                <DetailRow label="Fecha Registro" value={new Date(caso.createdAt).toLocaleString('es-CO')} name="createdAt" icon={Calendar} isEditing={false} onChange={() => { }} />
                            </div>
                        </section>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    {isEditing ? (
                        <>
                            <button
                                onClick={() => {
                                    setIsEditing(false)
                                    setFormData({ ...caso })
                                    setError(null)
                                }}
                                disabled={saving}
                                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-sm disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200 flex items-center gap-2 disabled:opacity-50"
                            >
                                <Save size={18} />
                                {saving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-sm"
                        >
                            Cerrar Detalle
                        </button>
                    )}
                </div>
            </div>
        </>
    )
}
