/**
 * Frame de Promoción y Mantenimiento (PyM) para Salud Oral
 * Permite seleccionar actividades preventivas realizadas
 */

import { Shield } from 'lucide-react'
import { ToggleBadge } from './ToggleBadge'
import { NumberSelector } from './NumberSelector'

interface PymValues {
    pymControlPlaca: boolean
    pymSellantes: boolean
    pymSellantesCantidad: number
    pymFluorBarniz: boolean
    pymDetartraje: boolean
    pymDetartrajeCantidad: number
    pymProfilaxis: boolean
    pymEducacion: boolean
}

interface PymFrameProps {
    values: PymValues
    onChange: (key: keyof PymValues, value: boolean | number) => void
    disabled?: boolean
    edadPaciente?: number | null
}

export function PymFrame({
    values,
    onChange,
    disabled = false,
    edadPaciente,
}: PymFrameProps) {
    // Validaciones por edad
    const edad = edadPaciente ?? null
    const mostrarControlPlaca = edad === null || edad >= 1
    const mostrarProfilaxis = edad === null || edad >= 1
    const mostrarSellantes = edad === null || (edad >= 3 && edad <= 15)
    const mostrarFluor = edad === null || (edad >= 1 && edad <= 17)
    const mostrarDetartraje = edad === null || edad >= 12

    // Contar actividades realizadas (solo las visibles)
    const actividadesVisibles = [
        mostrarControlPlaca && values.pymControlPlaca,
        mostrarSellantes && values.pymSellantes,
        mostrarFluor && values.pymFluorBarniz,
        mostrarDetartraje && values.pymDetartraje,
        mostrarProfilaxis && values.pymProfilaxis,
        values.pymEducacion,
    ]
    const activas = actividadesVisibles.filter(Boolean).length
    const totalVisibles = [mostrarControlPlaca, mostrarSellantes, mostrarFluor, mostrarDetartraje, mostrarProfilaxis, true].filter(Boolean).length

    // Auto-marcar educación si alguna actividad está activa
    const algunaActividadActiva = (
        (mostrarControlPlaca && values.pymControlPlaca) ||
        (mostrarSellantes && values.pymSellantes) ||
        (mostrarFluor && values.pymFluorBarniz) ||
        (mostrarDetartraje && values.pymDetartraje) ||
        (mostrarProfilaxis && values.pymProfilaxis)
    )

    // Manejar cambios con lógica adicional
    const handleChange = (key: keyof PymValues, value: boolean | number) => {
        // Si se desmarca Sellantes, resetear contador
        if (key === 'pymSellantes' && value === false) {
            onChange('pymSellantesCantidad', 2)
        }

        // Si se desmarca Detartraje, resetear contador
        if (key === 'pymDetartraje' && value === false) {
            onChange('pymDetartrajeCantidad', 1)
        }

        onChange(key, value)

        // Si se marca alguna actividad (no educación), auto-marcar educación
        if (key !== 'pymEducacion' && key !== 'pymSellantesCantidad' && value === true) {
            if (!values.pymEducacion) {
                onChange('pymEducacion', true)
            }
        }
    }

    return (
        <div className="bg-green-50/30 rounded-xl border border-green-200 p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Shield className="text-green-500" size={20} />
                    <h3 className="font-bold text-slate-900">Promoción y Mantenimiento (PyM)</h3>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activas === 0 ? 'bg-slate-100 text-slate-500' :
                    activas < 3 ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                }`}>
                    {activas}/{totalVisibles}
                </span>
            </div>

            <div className="flex flex-wrap justify-center gap-2 items-center">
                {/* Control de Placa - No aplica para edad < 1 año */}
                {mostrarControlPlaca && (
                    <ToggleBadge
                        label="Control de Placa"
                        active={values.pymControlPlaca}
                        onChange={(active) => handleChange('pymControlPlaca', active)}
                        disabled={disabled}
                        size="md"
                    />
                )}

                {/* Sellantes con contador - Solo edad 3-15 años */}
                {mostrarSellantes && (
                    <div className="flex items-center gap-1">
                        <ToggleBadge
                            label="Sellantes"
                            active={values.pymSellantes}
                            onChange={(active) => handleChange('pymSellantes', active)}
                            disabled={disabled}
                            size="md"
                        />
                        {values.pymSellantes && (
                            <NumberSelector
                                value={values.pymSellantesCantidad}
                                onChange={(v) => handleChange('pymSellantesCantidad', v)}
                                min={2}
                                max={4}
                                disabled={disabled}
                                size="sm"
                            />
                        )}
                    </div>
                )}

                {/* Flúor Barniz - Solo edad 1-17 años */}
                {mostrarFluor && (
                    <ToggleBadge
                        label="Flúor Barniz"
                        active={values.pymFluorBarniz}
                        onChange={(active) => handleChange('pymFluorBarniz', active)}
                        disabled={disabled}
                        size="md"
                    />
                )}

                {/* Detartraje con contador - Solo edad >= 12 años */}
                {mostrarDetartraje && (
                    <div className="flex items-center gap-1">
                        <ToggleBadge
                            label="Detartraje"
                            active={values.pymDetartraje}
                            onChange={(active) => handleChange('pymDetartraje', active)}
                            disabled={disabled}
                            size="md"
                        />
                        {values.pymDetartraje && (
                            <NumberSelector
                                value={values.pymDetartrajeCantidad}
                                onChange={(v) => handleChange('pymDetartrajeCantidad', v)}
                                min={1}
                                max={4}
                                disabled={disabled}
                                size="sm"
                            />
                        )}
                    </div>
                )}

                {/* Profilaxis - No aplica para edad < 1 año */}
                {mostrarProfilaxis && (
                    <ToggleBadge
                        label="Profilaxis"
                        active={values.pymProfilaxis}
                        onChange={(active) => handleChange('pymProfilaxis', active)}
                        disabled={disabled}
                        size="md"
                    />
                )}

                {/* Educación - Siempre visible, auto-marcada */}
                <ToggleBadge
                    label={algunaActividadActiva ? 'Educación ✓' : 'Educación'}
                    active={values.pymEducacion}
                    onChange={(active) => handleChange('pymEducacion', active)}
                    disabled={disabled || algunaActividadActiva}
                    size="md"
                />
            </div>

            {activas === totalVisibles && totalVisibles > 0 && (
                <div className="mt-4 p-2 bg-green-100 rounded-lg text-center">
                    <span className="text-xs font-semibold text-green-700">
                        ✓ Todas las actividades PyM aplicables completadas
                    </span>
                </div>
            )}
        </div>
    )
}

export default PymFrame
