/**
 * Panel de Detalle de Registro de Salud Oral
 * Muestra información completa y permite edición/eliminación
 */

import { useState, useEffect } from 'react'
import {
    X,
    Trash2,
    User,
    Calendar,
    MapPin,
    Check,
    AlertTriangle,
    Activity,
    Shield,
    Stethoscope,
    Edit,
} from 'lucide-react'
import { afiliadosService } from '@/services/afiliados.service'
import { toast } from 'sonner'
import type { OdRegistro } from '@/types/saludOral.types'
import { useActualizarSaludOral, useEliminarSaludOral } from '../hooks/useSaludOral'
import { useAuth } from '@/context/AuthContext'
import {
    TIPO_CONSULTA_LABELS,
    TERAPIA_CONDUCTO_TIPO_LABELS,
    TERAPIA_CONDUCTO_RAICES_LABELS,
    EXODONCIA_TIPO_LABELS,
    EXODONCIA_RAICES_LABELS,
} from '@/types/saludOral.types'
import { Badge } from '@/components/common/Badge'
import { CopItem } from './CopItem'

interface OdDetallePanelProps {
    registro: OdRegistro
    onClose: () => void
    onUpdate?: () => void
    onEdit?: (registro: OdRegistro) => void
}

export function OdDetallePanel({ registro, onClose, onUpdate, onEdit }: OdDetallePanelProps) {
    const { user } = useAuth()
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [nombrePaciente, setNombrePaciente] = useState<string | null>(null)

    useEffect(() => {
        const fetchNombre = async () => {
            if (registro.pacienteId) {
                try {
                    const res = await afiliadosService.buscarPorDocumento(registro.pacienteId)
                    if (res.success && res.data) {
                        const nombreCompleto = `${res.data.nombres} ${res.data.apellido1} ${res.data.apellido2 || ''}`.trim()
                        setNombrePaciente(nombreCompleto)
                    } else {
                        setNombrePaciente(registro.pacienteId)
                    }
                } catch (e) {
                    setNombrePaciente(registro.pacienteId)
                }
            }
        }
        fetchNombre()
    }, [registro.pacienteId])

    const actualizarMutation = useActualizarSaludOral()
    const eliminarMutation = useEliminarSaludOral()

    // Permisos
    const canEdit = user?.email === registro.colaboradorEmail ||
        ['superadmin', 'auditor'].includes(user?.rol || '')
    const canDelete = canEdit

    const handleDelete = async () => {
        try {
            await eliminarMutation.mutateAsync(registro.id)
            toast.success('Registro eliminado correctamente')
            onUpdate?.()
            onClose()
        } catch (error) {
            toast.error('Error al eliminar el registro')
        }
    }

    const handleToggleFinalizado = async () => {
        try {
            await actualizarMutation.mutateAsync({
                id: registro.id,
                data: { tratamientoFinalizado: !registro.tratamientoFinalizado },
            })
            toast.success('Estado actualizado')
            onUpdate?.()
        } catch (error) {
            toast.error('Error al actualizar')
        }
    }

    // Contar procedimientos activos
    const countPym = [
        registro.pymControlPlaca,
        registro.pymSellantes,
        registro.pymFluorBarniz,
        registro.pymDetartraje,
        registro.pymProfilaxis,
        registro.pymEducacion,
    ].filter(Boolean).length

    const countPoblaciones = [
        registro.gestante,
        registro.cronicosHta,
        registro.cronicosDm,
        registro.cronicosErc,
        registro.discapacidad,
        registro.hemofilia,
        registro.vih,
        registro.cancer,
        registro.menor5Anios,
    ].filter(Boolean).length

    const totalCop = registro.copCariesNoCavitacional + registro.copCariesCavitacional +
        registro.copObturados + registro.copPerdidos + registro.copSanos

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="relative w-full max-w-xl bg-white shadow-2xl overflow-y-auto animate-slide-in-right">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{nombrePaciente || registro.pacienteId || 'Cargando...'}</h2>
                        <p className="text-sm text-slate-500">
                            {new Date(registro.fechaRegistro).toLocaleDateString('es-CO', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Estado del tratamiento */}
                    <div className={`p-4 rounded-xl border ${registro.tratamientoFinalizado
                        ? 'bg-green-50 border-green-200'
                        : 'bg-amber-50 border-amber-200'
                        }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {registro.tratamientoFinalizado ? (
                                    <Check className="text-green-600" size={20} />
                                ) : (
                                    <AlertTriangle className="text-amber-600" size={20} />
                                )}
                                <span className={`font-semibold ${registro.tratamientoFinalizado ? 'text-green-700' : 'text-amber-700'
                                    }`}>
                                    {registro.tratamientoFinalizado ? 'Tratamiento Finalizado' : 'En Proceso'}
                                </span>
                            </div>
                            {canEdit && (
                                <button
                                    onClick={handleToggleFinalizado}
                                    disabled={actualizarMutation.isPending}
                                    className="text-sm text-slate-600 hover:text-primary-600 underline disabled:opacity-50"
                                >
                                    Cambiar estado
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Datos del paciente */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <User className="text-slate-500" size={18} />
                            <h3 className="font-semibold text-slate-900">Paciente</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-500">Identificación</span>
                                <p className="font-semibold">{registro.pacienteId}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Sede</span>
                                <p className="font-semibold flex items-center gap-1">
                                    <MapPin size={14} />
                                    {registro.sede}
                                </p>
                            </div>
                            <div>
                                <span className="text-slate-500">Fecha</span>
                                <p className="font-semibold flex items-center gap-1">
                                    <Calendar size={14} />
                                    {new Date(registro.fechaRegistro).toLocaleDateString('es-CO')}
                                </p>
                            </div>
                            <div>
                                <span className="text-slate-500">Colaborador</span>
                                <p className="font-semibold text-xs truncate" title={registro.colaboradorEmail}>
                                    {registro.colaboradorEmail.split('@')[0]}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Poblaciones Especiales */}
                    {countPoblaciones > 0 && (
                        <div className="bg-purple-50 rounded-xl p-4">
                            <h3 className="font-semibold text-slate-900 mb-3">
                                Poblaciones Especiales ({countPoblaciones})
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {registro.gestante && <Badge color="purple">Gestante</Badge>}
                                {registro.cronicosHta && <Badge color="purple">HTA</Badge>}
                                {registro.cronicosDm && <Badge color="purple">Diabetes</Badge>}
                                {registro.cronicosErc && <Badge color="purple">ERC</Badge>}
                                {registro.discapacidad && <Badge color="purple">Discapacidad</Badge>}
                                {registro.hemofilia && <Badge color="purple">Hemofilia</Badge>}
                                {registro.vih && <Badge color="purple">VIH</Badge>}
                                {registro.cancer && <Badge color="purple">Cáncer</Badge>}
                                {registro.menor5Anios && <Badge color="purple">&lt;5 años</Badge>}
                            </div>
                        </div>
                    )}

                    {/* Índice COP */}
                    <div className="bg-blue-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Activity className="text-blue-500" size={18} />
                            <h3 className="font-semibold text-slate-900">Índice COP</h3>
                            <span className="ml-auto px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                                Total: {totalCop}
                            </span>
                        </div>
                        <div className="grid grid-cols-5 gap-2 text-center text-xs">
                            <CopItem label="No Cav." value={registro.copCariesNoCavitacional} color="amber" />
                            <CopItem label="Cavit." value={registro.copCariesCavitacional} color="red" />
                            <CopItem label="Obtur." value={registro.copObturados} color="blue" />
                            <CopItem label="Perd." value={registro.copPerdidos} color="slate" />
                            <CopItem label="Sanos" value={registro.copSanos} color="green" />
                        </div>
                    </div>

                    {/* PyM */}
                    {countPym > 0 && (
                        <div className="bg-green-50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Shield className="text-green-500" size={18} />
                                <h3 className="font-semibold text-slate-900">PyM</h3>
                                <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                    {countPym}/6
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {registro.pymControlPlaca && <Badge color="green">Control Placa</Badge>}
                                {registro.pymSellantes && <Badge color="green">Sellantes</Badge>}
                                {registro.pymFluorBarniz && <Badge color="green">Flúor Barniz</Badge>}
                                {registro.pymDetartraje && <Badge color="green">Detartraje</Badge>}
                                {registro.pymProfilaxis && <Badge color="green">Profilaxis</Badge>}
                                {registro.pymEducacion && <Badge color="green">Educación</Badge>}
                            </div>
                        </div>
                    )}

                    {/* Procedimientos */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Stethoscope className="text-slate-500" size={18} />
                            <h3 className="font-semibold text-slate-900">Procedimientos</h3>
                        </div>

                        <div className="space-y-3 text-sm">
                            {registro.tipoConsulta && (
                                <div>
                                    <span className="text-slate-500">Consulta:</span>
                                    <span className="ml-2 font-medium">{TIPO_CONSULTA_LABELS[registro.tipoConsulta]}</span>
                                </div>
                            )}

                            {registro.remisionEspecialidades && (
                                <Badge color="blue">Remisión a Especialidades</Badge>
                            )}

                            {/* Resinas e Ionómeros */}
                            {(registro.resina1sup > 0 || registro.resina2sup > 0 || registro.resina3sup > 0) && (
                                <div>
                                    <span className="text-slate-500">Resinas:</span>
                                    <span className="ml-2">
                                        {registro.resina1sup > 0 && `${registro.resina1sup}x1sup `}
                                        {registro.resina2sup > 0 && `${registro.resina2sup}x2sup `}
                                        {registro.resina3sup > 0 && `${registro.resina3sup}x3sup`}
                                    </span>
                                </div>
                            )}

                            {(registro.ionomero1sup > 0 || registro.ionomero2sup > 0 || registro.ionomero3sup > 0) && (
                                <div>
                                    <span className="text-slate-500">Ionómeros:</span>
                                    <span className="ml-2">
                                        {registro.ionomero1sup > 0 && `${registro.ionomero1sup}x1sup `}
                                        {registro.ionomero2sup > 0 && `${registro.ionomero2sup}x2sup `}
                                        {registro.ionomero3sup > 0 && `${registro.ionomero3sup}x3sup`}
                                    </span>
                                </div>
                            )}

                            {registro.obturacionTemporal > 0 && (
                                <div>
                                    <span className="text-slate-500">Obturación Temporal:</span>
                                    <span className="ml-2 font-medium">{registro.obturacionTemporal}</span>
                                </div>
                            )}

                            {(registro.pulpectomia > 0 || registro.pulpotomia > 0) && (
                                <div>
                                    <span className="text-slate-500">Pulpa:</span>
                                    <span className="ml-2">
                                        {registro.pulpectomia > 0 && `Pulpectomía: ${registro.pulpectomia} `}
                                        {registro.pulpotomia > 0 && `Pulpotomía: ${registro.pulpotomia}`}
                                    </span>
                                </div>
                            )}

                            {registro.terapiaConductoCantidad > 0 && (
                                <div>
                                    <span className="text-slate-500">Terapia Conducto:</span>
                                    <span className="ml-2">
                                        {registro.terapiaConductoCantidad}x {TERAPIA_CONDUCTO_TIPO_LABELS[registro.terapiaConductoTipo!]} {TERAPIA_CONDUCTO_RAICES_LABELS[registro.terapiaConductoRaices!]}
                                    </span>
                                </div>
                            )}

                            {(registro.exodonciaCantidad > 0 || registro.exodonciaIncluido) && (
                                <div>
                                    <span className="text-slate-500">Exodoncias:</span>
                                    <span className="ml-2">
                                        {registro.exodonciaIncluido
                                            ? `${registro.exodonciaCantidad}x Diente Incluido`
                                            : `${registro.exodonciaCantidad}x ${EXODONCIA_TIPO_LABELS[registro.exodonciaTipo!]} ${EXODONCIA_RAICES_LABELS[registro.exodonciaRaices!]}`
                                        }
                                    </span>
                                </div>
                            )}

                            {registro.controlPostquirurgico && (
                                <Badge color="slate">Control Post-Quirúrgico</Badge>
                            )}

                            {/* Radiografías */}
                            {(registro.rxSuperiores || registro.rxInferiores || registro.rxMolares || registro.rxPremolares || registro.rxCaninos) && (
                                <div>
                                    <span className="text-slate-500 block mb-1">Radiografías:</span>
                                    <div className="flex flex-wrap gap-1">
                                        {registro.rxSuperiores && <Badge color="cyan">Superiores</Badge>}
                                        {registro.rxInferiores && <Badge color="cyan">Inferiores</Badge>}
                                        {registro.rxMolares && <Badge color="cyan">Molares</Badge>}
                                        {registro.rxPremolares && <Badge color="cyan">Premolares</Badge>}
                                        {registro.rxCaninos && <Badge color="cyan">Caninos</Badge>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer con acciones */}
                {canEdit && (
                    <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
                        {confirmDelete ? (
                            <>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={eliminarMutation.isPending}
                                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm font-medium"
                                >
                                    {eliminarMutation.isPending ? 'Eliminando...' : 'Confirmar Eliminación'}
                                </button>
                            </>
                        ) : (
                            <>
                                {canEdit && onEdit && (
                                    <button
                                        onClick={() => {
                                            onClose()
                                            onEdit(registro)
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm mr-auto"
                                    >
                                        <Edit size={16} />
                                        Editar
                                    </button>
                                )}
                                {canDelete && (
                                    <button
                                        onClick={() => setConfirmDelete(true)}
                                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                                    >
                                        <Trash2 size={16} />
                                        Eliminar
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ========================================
// COMPONENTES AUXILIARES
// ========================================



export default OdDetallePanel
