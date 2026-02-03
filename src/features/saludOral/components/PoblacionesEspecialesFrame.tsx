/**
 * Frame de Poblaciones Especiales para Salud Oral
 * Permite seleccionar condiciones especiales del paciente
 * Controla restricciones según sexo y edad
 */

import { Users } from 'lucide-react'
import { ToggleBadge } from './ToggleBadge'

interface PoblacionesValues {
    gestante: boolean
    cronicosHta: boolean
    cronicosDm: boolean
    cronicosErc: boolean
    discapacidad: boolean
    hemofilia: boolean
    vih: boolean
    cancer: boolean
    menor5Anios: boolean
}

interface PoblacionesEspecialesFrameProps {
    values: PoblacionesValues
    onChange: (key: keyof PoblacionesValues, value: boolean) => void
    sexoPaciente?: 'M' | 'F' | null
    edadPaciente?: number | null
    disabled?: boolean
}

export function PoblacionesEspecialesFrame({
    values,
    onChange,
    sexoPaciente,
    edadPaciente,
    disabled = false,
}: PoblacionesEspecialesFrameProps) {
    // Restricciones
    const esMasculino = sexoPaciente === 'M'
    const esMenor13 = edadPaciente !== null && edadPaciente !== undefined && edadPaciente < 13
    const esMenor5 = edadPaciente !== null && edadPaciente !== undefined && edadPaciente < 5
    const esMayor5 = edadPaciente !== null && edadPaciente !== undefined && edadPaciente > 5
    const noMostrarGestante = esMasculino || esMenor13

    // Contar poblaciones activas
    const activas = Object.values(values).filter(Boolean).length

    // Manejar cambio con validaciones
    const handleChange = (key: keyof PoblacionesValues, value: boolean) => {
        // Si es gestante y no aplica (masculino o menor de 13), no permitir
        if (key === 'gestante' && noMostrarGestante) return

        // Si es menor5Anios y es menor de 5, no permitir desmarcar
        if (key === 'menor5Anios' && esMenor5 && !value) return

        onChange(key, value)
    }

    return (
        <div className="bg-purple-50/50 rounded-xl border border-purple-200 p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Users className="text-purple-500" size={20} />
                    <h3 className="font-bold text-slate-900">Poblaciones Especiales</h3>
                </div>
                {activas > 0 && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                        {activas} activa{activas > 1 ? 's' : ''}
                    </span>
                )}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
                {/* Gestante - NO mostrar si es masculino o menor de 13 años */}
                {!noMostrarGestante && (
                    <ToggleBadge
                        label="Gestante"
                        active={values.gestante}
                        onChange={(active) => handleChange('gestante', active)}
                        disabled={disabled}
                        size="md"
                    />
                )}

                <ToggleBadge
                    label="HTA"
                    active={values.cronicosHta}
                    onChange={(active) => handleChange('cronicosHta', active)}
                    disabled={disabled}
                    size="md"
                />

                <ToggleBadge
                    label="Diabetes"
                    active={values.cronicosDm}
                    onChange={(active) => handleChange('cronicosDm', active)}
                    disabled={disabled}
                    size="md"
                />

                <ToggleBadge
                    label="ERC"
                    active={values.cronicosErc}
                    onChange={(active) => handleChange('cronicosErc', active)}
                    disabled={disabled}
                    size="md"
                />

                <ToggleBadge
                    label="Discapacidad"
                    active={values.discapacidad}
                    onChange={(active) => handleChange('discapacidad', active)}
                    disabled={disabled}
                    size="md"
                />

                <ToggleBadge
                    label="Hemofilia"
                    active={values.hemofilia}
                    onChange={(active) => handleChange('hemofilia', active)}
                    disabled={disabled}
                    size="md"
                />

                <ToggleBadge
                    label="VIH"
                    active={values.vih}
                    onChange={(active) => handleChange('vih', active)}
                    disabled={disabled}
                    size="md"
                />

                <ToggleBadge
                    label="Cáncer"
                    active={values.cancer}
                    onChange={(active) => handleChange('cancer', active)}
                    disabled={disabled}
                    size="md"
                />

                {/* Menor de 5 años - automático si edad < 5, oculto si edad > 5 */}
                {!esMayor5 && (
                    <ToggleBadge
                        label={esMenor5 ? '< 5 años ✓' : '< 5 años'}
                        active={esMenor5 ? true : values.menor5Anios}
                        onChange={(active) => handleChange('menor5Anios', active)}
                        disabled={disabled || esMenor5}
                        size="md"
                    />
                )}
            </div>

            {activas === 0 && !esMenor5 && (
                <p className="text-xs text-slate-400 mt-3 text-center">
                    Seleccione las poblaciones especiales aplicables al paciente
                </p>
            )}
        </div>
    )
}

export default PoblacionesEspecialesFrame
