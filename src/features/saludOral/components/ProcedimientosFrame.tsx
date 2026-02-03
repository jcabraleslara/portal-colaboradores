/**
 * Frame de Procedimientos para Salud Oral
 * Permite registrar procedimientos odontológicos realizados
 * Layout optimizado con ToggleBadges para mejor UX
 */

import { Stethoscope, Zap, AlertCircle } from 'lucide-react'
import { NumberSelector } from './NumberSelector'
import { ToggleBadge } from './ToggleBadge'
import {
    type TipoConsulta,
    type TerapiaConductoTipo,
    type TerapiaConductoRaices,
    type ExodonciaTipo,
    type ExodonciaRaices,
} from '@/types/saludOral.types'

interface ProcedimientosValues {
    tipoConsulta: TipoConsulta | null
    remisionEspecialidades: boolean

    resina1sup: number
    resina2sup: number
    resina3sup: number

    ionomero1sup: number
    ionomero2sup: number
    ionomero3sup: number

    obturacionTemporal: number
    pulpectomia: number
    pulpotomia: number

    terapiaConductoTipo: TerapiaConductoTipo | null
    terapiaConductoRaices: TerapiaConductoRaices | null
    terapiaConductoCantidad: number

    exodonciaTipo: ExodonciaTipo | null
    exodonciaRaices: ExodonciaRaices | null
    exodonciaIncluido: boolean
    exodonciaCantidad: number

    controlPostquirurgico: boolean

    rxSuperiores: boolean
    rxInferiores: boolean
    rxMolares: boolean
    rxPremolares: boolean
    rxCaninos: boolean

    tratamientoFinalizado: boolean
}

interface ProcedimientosFrameProps {
    values: ProcedimientosValues
    onChange: (key: keyof ProcedimientosValues, value: any) => void
    disabled?: boolean
    ipsPrimaria?: string | null
}

export function ProcedimientosFrame({
    values,
    onChange,
    disabled = false,
    ipsPrimaria,
}: ProcedimientosFrameProps) {
    const tipoConsultaFaltante = !values.tipoConsulta

    // Solo mostrar frames de procedimientos avanzados si IPS es GESTAR SALUD DE COLOMBIA CERETÉ
    const mostrarProcedimientosAvanzados = ipsPrimaria?.toUpperCase().startsWith('GESTAR SALUD DE COLOMBIA CERETE') ?? false

    return (
        <div className="space-y-4">
            {/* Tipo de Consulta (OBLIGATORIO) */}
            <div className={`rounded-xl border p-4 ${tipoConsultaFaltante
                ? 'bg-red-50/50 border-red-300'
                : 'bg-slate-50 border-slate-200'
                }`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <Stethoscope className={tipoConsultaFaltante ? 'text-red-500' : 'text-slate-500'} size={18} />
                        <span className="font-semibold text-slate-900 text-sm">
                            Tipo de Consulta <span className="text-red-500">*</span>
                        </span>
                        {tipoConsultaFaltante && (
                            <span className="flex items-center gap-1 text-xs text-red-600">
                                <AlertCircle size={12} />
                                Requerido
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <ToggleBadge
                            label="Primera Vez"
                            active={values.tipoConsulta === 'primera_vez'}
                            onChange={() => onChange('tipoConsulta', values.tipoConsulta === 'primera_vez' ? null : 'primera_vez')}
                            disabled={disabled}
                            size="md"
                        />
                        <ToggleBadge
                            label="Control"
                            active={values.tipoConsulta === 'control'}
                            onChange={() => onChange('tipoConsulta', values.tipoConsulta === 'control' ? null : 'control')}
                            disabled={disabled}
                            size="md"
                        />
                        <ToggleBadge
                            label="Urgencias"
                            active={values.tipoConsulta === 'urgencias'}
                            onChange={() => onChange('tipoConsulta', values.tipoConsulta === 'urgencias' ? null : 'urgencias')}
                            disabled={disabled}
                            size="md"
                        />
                        <span className="text-slate-300 mx-2">|</span>
                        <ToggleBadge
                            label="Remisión Especialidad"
                            active={values.remisionEspecialidades}
                            onChange={(active) => onChange('remisionEspecialidades', active)}
                            disabled={disabled}
                            size="md"
                        />
                    </div>
                </div>
            </div>

            {/* Obturaciones - Solo para IPS Cereté */}
            {mostrarProcedimientosAvanzados && (
                <div className="bg-amber-50/30 rounded-xl border border-amber-200 p-4">
                    <h3 className="font-bold text-slate-900 mb-4 text-sm">Obturaciones</h3>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-xs text-slate-500">
                                    <th className="text-left pb-3 font-semibold w-28">Material</th>
                                    <th className="text-center pb-3 font-semibold">1 Superficie</th>
                                    <th className="text-center pb-3 font-semibold">2 Superficies</th>
                                    <th className="text-center pb-3 font-semibold">3+ Superficies</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-t border-amber-100">
                                    <td className="py-4 text-sm font-medium text-amber-700">Resinas</td>
                                    <td className="text-center py-4">
                                        <NumberSelector value={values.resina1sup} onChange={(v) => onChange('resina1sup', v)} disabled={disabled} size="md" />
                                    </td>
                                    <td className="text-center py-4">
                                        <NumberSelector value={values.resina2sup} onChange={(v) => onChange('resina2sup', v)} disabled={disabled} size="md" />
                                    </td>
                                    <td className="text-center py-4">
                                        <NumberSelector value={values.resina3sup} onChange={(v) => onChange('resina3sup', v)} disabled={disabled} size="md" />
                                    </td>
                                </tr>
                                <tr className="border-t border-amber-100">
                                    <td className="py-4 text-sm font-medium text-amber-700">Ionómeros</td>
                                    <td className="text-center py-4">
                                        <NumberSelector value={values.ionomero1sup} onChange={(v) => onChange('ionomero1sup', v)} disabled={disabled} size="md" />
                                    </td>
                                    <td className="text-center py-4">
                                        <NumberSelector value={values.ionomero2sup} onChange={(v) => onChange('ionomero2sup', v)} disabled={disabled} size="md" />
                                    </td>
                                    <td className="text-center py-4">
                                        <NumberSelector value={values.ionomero3sup} onChange={(v) => onChange('ionomero3sup', v)} disabled={disabled} size="md" />
                                    </td>
                                </tr>
                                <tr className="border-t border-amber-100">
                                    <td className="py-4 text-sm font-medium text-amber-700">Temporal</td>
                                    <td colSpan={3} className="text-center py-4">
                                        <NumberSelector value={values.obturacionTemporal} onChange={(v) => onChange('obturacionTemporal', v)} disabled={disabled} size="md" />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tratamientos Pulpares - Solo para IPS Cereté */}
            {mostrarProcedimientosAvanzados && (
                <div className="bg-red-50/30 rounded-xl border border-red-200 p-4">
                    <h3 className="font-bold text-slate-900 mb-4 text-sm">Tratamientos Pulpares</h3>

                    <div className="space-y-4">
                        {/* Pulpectomía, Pulpotomía y Terapia de Conducto en una fila */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Pulpectomía */}
                            <div className="bg-white/60 rounded-lg p-4 flex items-center justify-between">
                                <span className="text-sm font-medium text-red-700">Pulpectomía</span>
                                <NumberSelector value={values.pulpectomia} onChange={(v) => onChange('pulpectomia', v)} disabled={disabled} size="md" />
                            </div>

                            {/* Pulpotomía */}
                            <div className="bg-white/60 rounded-lg p-4 flex items-center justify-between">
                                <span className="text-sm font-medium text-red-700">Pulpotomía</span>
                                <NumberSelector value={values.pulpotomia} onChange={(v) => onChange('pulpotomia', v)} disabled={disabled} size="md" />
                            </div>

                            {/* Terapia de Conducto - Cantidad */}
                            <div className="bg-white/60 rounded-lg p-4 flex items-center justify-between">
                                <span className="text-sm font-medium text-red-700">Terapia de Conducto</span>
                                <NumberSelector
                                    value={values.terapiaConductoCantidad}
                                    onChange={(v) => {
                                        onChange('terapiaConductoCantidad', v)
                                        // Resetear tipo y raíces si el contador llega a 0
                                        if (v === 0) {
                                            onChange('terapiaConductoTipo', null)
                                            onChange('terapiaConductoRaices', null)
                                        }
                                    }}
                                    disabled={disabled}
                                    size="md"
                                />
                            </div>
                        </div>

                        {/* Opciones de Terapia de Conducto */}
                        {values.terapiaConductoCantidad > 0 && (
                            <div className="bg-white/60 rounded-lg p-4">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-600 font-medium">Tipo diente:</span>
                                        <ToggleBadge
                                            label="Temporal"
                                            active={values.terapiaConductoTipo === 'temporal'}
                                            onChange={() => {
                                                const newValue = values.terapiaConductoTipo === 'temporal' ? null : 'temporal'
                                                onChange('terapiaConductoTipo', newValue)
                                                // Si cambia a temporal y raices es 'bi', resetear raices
                                                if (newValue === 'temporal' && values.terapiaConductoRaices === 'bi') {
                                                    onChange('terapiaConductoRaices', null)
                                                }
                                            }}
                                            disabled={disabled}
                                            size="md"
                                        />
                                        <ToggleBadge
                                            label="Permanente"
                                            active={values.terapiaConductoTipo === 'permanente'}
                                            onChange={() => onChange('terapiaConductoTipo', values.terapiaConductoTipo === 'permanente' ? null : 'permanente')}
                                            disabled={disabled}
                                            size="md"
                                        />
                                    </div>
                                    <span className="text-slate-300">|</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-600 font-medium">Raíces:</span>
                                        <ToggleBadge
                                            label="Uniradicular"
                                            active={values.terapiaConductoRaices === 'uni'}
                                            onChange={() => onChange('terapiaConductoRaices', values.terapiaConductoRaices === 'uni' ? null : 'uni')}
                                            disabled={disabled}
                                            size="md"
                                        />
                                        {/* Birradicular solo disponible para dientes permanentes */}
                                        {values.terapiaConductoTipo === 'permanente' && (
                                            <ToggleBadge
                                                label="Birradicular"
                                                active={values.terapiaConductoRaices === 'bi'}
                                                onChange={() => onChange('terapiaConductoRaices', values.terapiaConductoRaices === 'bi' ? null : 'bi')}
                                                disabled={disabled}
                                                size="md"
                                            />
                                        )}
                                        <ToggleBadge
                                            label="Multiradicular"
                                            active={values.terapiaConductoRaices === 'multi'}
                                            onChange={() => onChange('terapiaConductoRaices', values.terapiaConductoRaices === 'multi' ? null : 'multi')}
                                            disabled={disabled}
                                            size="md"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Exodoncias - Solo para IPS Cereté */}
            {mostrarProcedimientosAvanzados && (
                <div className="bg-slate-100/50 rounded-xl border border-slate-300 p-4">
                    <h3 className="font-bold text-slate-900 mb-4 text-sm">Exodoncias</h3>

                    <div className="space-y-4">
                        {/* Exodoncia Simple, Diente Incluido y Control Post-Qx en una fila */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Exodoncia Simple */}
                            <div className="bg-white/60 rounded-lg p-4 flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700">Exodoncia Simple</span>
                                <NumberSelector
                                    value={values.exodonciaIncluido ? 0 : values.exodonciaCantidad}
                                    onChange={(v) => {
                                        onChange('exodonciaCantidad', v)
                                        // Resetear tipo y raíces si el contador llega a 0
                                        if (v === 0) {
                                            onChange('exodonciaTipo', null)
                                            onChange('exodonciaRaices', null)
                                        }
                                    }}
                                    disabled={disabled || values.exodonciaIncluido}
                                    size="md"
                                />
                            </div>

                            {/* Diente Incluido */}
                            <div className="bg-white/60 rounded-lg p-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-700">Diente Incluido</span>
                                    <ToggleBadge
                                        label={values.exodonciaIncluido ? 'Sí' : 'No'}
                                        active={values.exodonciaIncluido}
                                        onChange={(a) => {
                                            onChange('exodonciaIncluido', a)
                                            if (a) {
                                                onChange('exodonciaTipo', null)
                                                onChange('exodonciaRaices', null)
                                            }
                                        }}
                                        disabled={disabled}
                                        size="md"
                                    />
                                </div>
                                {values.exodonciaIncluido && (
                                    <NumberSelector
                                        value={values.exodonciaCantidad}
                                        onChange={(v) => onChange('exodonciaCantidad', v)}
                                        disabled={disabled}
                                        size="md"
                                    />
                                )}
                            </div>

                            {/* Control Post-Quirúrgico */}
                            <div className="bg-white/60 rounded-lg p-4 flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700">Control Post-Quirúrgico</span>
                                <ToggleBadge
                                    label={values.controlPostquirurgico ? 'Sí' : 'No'}
                                    active={values.controlPostquirurgico}
                                    onChange={(a) => onChange('controlPostquirurgico', a)}
                                    disabled={disabled}
                                    size="md"
                                />
                            </div>
                        </div>

                        {/* Opciones de Exodoncia Simple */}
                        {values.exodonciaCantidad > 0 && !values.exodonciaIncluido && (
                            <div className="bg-white/60 rounded-lg p-4">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-600 font-medium">Tipo diente:</span>
                                        <ToggleBadge
                                            label="Temporal"
                                            active={values.exodonciaTipo === 'temporal'}
                                            onChange={() => onChange('exodonciaTipo', values.exodonciaTipo === 'temporal' ? null : 'temporal')}
                                            disabled={disabled}
                                            size="md"
                                        />
                                        <ToggleBadge
                                            label="Permanente"
                                            active={values.exodonciaTipo === 'permanente'}
                                            onChange={() => onChange('exodonciaTipo', values.exodonciaTipo === 'permanente' ? null : 'permanente')}
                                            disabled={disabled}
                                            size="md"
                                        />
                                    </div>
                                    {values.exodonciaTipo && (
                                        <>
                                            <span className="text-slate-300">|</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-600 font-medium">Raíces:</span>
                                                <ToggleBadge
                                                    label="Uniradicular"
                                                    active={values.exodonciaRaices === 'uni'}
                                                    onChange={() => onChange('exodonciaRaices', values.exodonciaRaices === 'uni' ? null : 'uni')}
                                                    disabled={disabled}
                                                    size="md"
                                                />
                                                <ToggleBadge
                                                    label="Multiradicular"
                                                    active={values.exodonciaRaices === 'multi'}
                                                    onChange={() => onChange('exodonciaRaices', values.exodonciaRaices === 'multi' ? null : 'multi')}
                                                    disabled={disabled}
                                                    size="md"
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Radiografías - Solo para IPS Cereté */}
            {mostrarProcedimientosAvanzados && (
                <div className="bg-cyan-50/30 rounded-xl border border-cyan-200 p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <span className="font-semibold text-slate-900 text-sm">Radiografías:</span>
                        <div className="flex flex-wrap justify-end gap-2">
                            <ToggleBadge label="Anterosuperiores" active={values.rxSuperiores} onChange={(a) => onChange('rxSuperiores', a)} disabled={disabled} size="md" />
                            <ToggleBadge label="Anteroinferiores" active={values.rxInferiores} onChange={(a) => onChange('rxInferiores', a)} disabled={disabled} size="md" />
                            <ToggleBadge label="Molares" active={values.rxMolares} onChange={(a) => onChange('rxMolares', a)} disabled={disabled} size="md" />
                            <ToggleBadge label="Premolares" active={values.rxPremolares} onChange={(a) => onChange('rxPremolares', a)} disabled={disabled} size="md" />
                            <ToggleBadge label="Caninos" active={values.rxCaninos} onChange={(a) => onChange('rxCaninos', a)} disabled={disabled} size="md" />
                        </div>
                    </div>
                </div>
            )}

            {/* Tratamiento Finalizado */}
            <div className="bg-green-100/50 rounded-xl border border-green-300 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap size={18} className={values.tratamientoFinalizado ? 'text-green-600' : 'text-slate-400'} />
                        <span className="font-semibold text-slate-900 text-sm">Estado del Tratamiento</span>
                    </div>
                    <ToggleBadge
                        label={values.tratamientoFinalizado ? '✓ Finalizado' : 'En Proceso'}
                        active={values.tratamientoFinalizado}
                        onChange={(a) => onChange('tratamientoFinalizado', a)}
                        disabled={disabled}
                        size="md"
                    />
                </div>
            </div>
        </div>
    )
}

export default ProcedimientosFrame
