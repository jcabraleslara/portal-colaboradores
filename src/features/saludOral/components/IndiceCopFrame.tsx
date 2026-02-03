/**
 * Frame de Índice COP para Salud Oral
 * Permite registrar el índice de caries, obturados, perdidos
 */

import { Activity, AlertTriangle } from 'lucide-react'
import { NumberSelector } from './NumberSelector'
import { validarIndiceCOP } from '../schemas/saludOral.schema'

interface CopValues {
    copCariesNoCavitacional: number
    copCariesCavitacional: number
    copObturados: number
    copPerdidos: number
    copSanos: number
}

interface IndiceCopFrameProps {
    values: CopValues
    onChange: (key: keyof CopValues, value: number) => void
    edadPaciente?: number | null
    disabled?: boolean
}

const COP_FIELDS: { key: keyof CopValues; label: string; shortLabel: string; color: string }[] = [
    { key: 'copCariesNoCavitacional', label: 'Caries No Cavitacional', shortLabel: 'No Cav.', color: 'text-amber-600' },
    { key: 'copCariesCavitacional', label: 'Caries Cavitacional', shortLabel: 'Cavit.', color: 'text-red-600' },
    { key: 'copObturados', label: 'Obturados', shortLabel: 'Obtur.', color: 'text-blue-600' },
    { key: 'copPerdidos', label: 'Perdidos', shortLabel: 'Perd.', color: 'text-slate-600' },
    { key: 'copSanos', label: 'Sanos', shortLabel: 'Sanos', color: 'text-green-600' },
]

export function IndiceCopFrame({
    values,
    onChange,
    edadPaciente,
    disabled = false,
}: IndiceCopFrameProps) {
    // Calcular totales
    const totalCop = values.copCariesNoCavitacional + values.copCariesCavitacional +
                     values.copObturados + values.copPerdidos + values.copSanos

    // Máximo según edad
    const maxDientes = edadPaciente !== undefined && edadPaciente !== null && edadPaciente < 5 ? 22 : 32

    // Validar
    const errorValidacion = validarIndiceCOP(edadPaciente ?? null, values)

    // Calcular índice COP-D (solo cavitacionales + obturados + perdidos)
    const copD = values.copCariesCavitacional + values.copObturados + values.copPerdidos

    return (
        <div className="bg-blue-50/30 rounded-xl border border-blue-200 p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Activity className="text-blue-500" size={20} />
                    <h3 className="font-bold text-slate-900">Índice COP</h3>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                        Máx: {maxDientes} dientes
                        {edadPaciente !== undefined && edadPaciente !== null && (
                            <span className="ml-1">({edadPaciente < 5 ? 'temporal' : 'permanente'})</span>
                        )}
                    </span>
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                        totalCop > maxDientes
                            ? 'bg-red-100 text-red-700'
                            : totalCop > 0
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-500'
                    }`}>
                        Total: {totalCop}
                    </div>
                </div>
            </div>

            {/* Error de validación */}
            {errorValidacion && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
                    <AlertTriangle size={16} />
                    {errorValidacion}
                </div>
            )}

            {/* Selectores */}
            <div className="grid grid-cols-5 gap-4">
                {COP_FIELDS.map(({ key, label, shortLabel, color }) => (
                    <div key={key} className="flex flex-col items-center">
                        <span className={`text-xs font-semibold ${color} mb-2 text-center`}>
                            <span className="hidden sm:inline">{label}</span>
                            <span className="sm:hidden">{shortLabel}</span>
                        </span>
                        <NumberSelector
                            value={values[key]}
                            onChange={(val) => onChange(key, val)}
                            max={maxDientes}
                            disabled={disabled}
                            size="md"
                        />
                    </div>
                ))}
            </div>

            {/* Resumen COP-D */}
            <div className="mt-4 pt-4 border-t border-blue-200">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                        <strong>COP-D:</strong> Caries Cavit. ({values.copCariesCavitacional}) +
                        Obturados ({values.copObturados}) +
                        Perdidos ({values.copPerdidos})
                    </span>
                    <span className={`font-bold text-lg ${
                        copD === 0 ? 'text-green-600' :
                        copD <= 5 ? 'text-amber-600' :
                        'text-red-600'
                    }`}>
                        = {copD}
                    </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                    {copD === 0 ? 'Excelente salud oral' :
                     copD <= 2 ? 'Muy bajo riesgo' :
                     copD <= 5 ? 'Riesgo moderado' :
                     'Alto riesgo - requiere intervención'}
                </p>
            </div>
        </div>
    )
}

export default IndiceCopFrame
