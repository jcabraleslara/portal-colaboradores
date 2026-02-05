import React from 'react'
import { UserCheck, AlertTriangle } from 'lucide-react'
import { Button, EditablePhone } from '@/components/common'
import { Afiliado } from '@/types'

interface AfiliadoInfoCardProps {
    afiliado: Afiliado
    setAfiliado: React.Dispatch<React.SetStateAction<Afiliado | null>>
    onPhoneUpdate?: (newPhone: string) => void
}

export function AfiliadoInfoCard({ afiliado, setAfiliado, onPhoneUpdate }: AfiliadoInfoCardProps) {
    // Detectar si es SALUD TOTAL para mostrar advertencias visuales
    const isSaludTotal = afiliado.eps?.toUpperCase().includes('SALUD TOTAL')

    // Construir nombre completo
    const nombreCompleto = [afiliado.nombres, afiliado.apellido1, afiliado.apellido2]
        .filter(Boolean)
        .join(' ')

    // Colores basados en el estado
    const colors = isSaludTotal
        ? {
            bg: 'bg-rose-50',
            border: 'border-rose-200',
            text: 'text-rose-900',
            label: 'text-rose-500',
            value: 'text-rose-700',
            iconBg: 'bg-rose-100',
            iconColor: 'text-rose-600',
            buttonClass: 'text-rose-700 border-rose-300 hover:bg-rose-100'
        }
        : {
            bg: 'bg-green-50',
            border: 'border-green-200',
            text: 'text-green-900',
            label: 'text-green-600',
            value: 'text-green-700',
            iconBg: 'bg-green-100',
            iconColor: 'text-green-600',
            buttonClass: 'text-green-700 border-green-300 hover:bg-green-100'
        }

    return (
        <div className={`mt-4 p-4 rounded-lg border flex flex-col md:flex-row items-start gap-4 transition-colors ${colors.bg} ${colors.border}`}>
            <div className="flex items-start gap-4 w-full">
                {/* Icono */}
                <div className={`p-2 rounded-full flex-shrink-0 ${colors.iconBg}`}>
                    {isSaludTotal ? (
                        <AlertTriangle className={colors.iconColor} size={24} />
                    ) : (
                        <UserCheck className={colors.iconColor} size={24} />
                    )}
                </div>

                {/* Grid de Información */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 w-full">
                    {/* Nombre - Fila completa en móvil/tablet */}
                    <div className="col-span-1 sm:col-span-2 md:col-span-4">
                        <p className={`text-xs ${colors.label}`}>Nombre Completo</p>
                        <h3 className={`font-bold text-lg ${colors.text} leading-tight`}>
                            {nombreCompleto}
                            {isSaludTotal && <span className="text-xs ml-2 font-normal bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full inline-block align-middle">Requiere Atención</span>}
                        </h3>
                    </div>

                    {/* Documento */}
                    <div>
                        <p className={`text-xs ${colors.label}`}>Documento</p>
                        <p className={`font-semibold ${colors.value}`}>
                            {afiliado.tipoId} {afiliado.id}
                        </p>
                    </div>

                    {/* EPS */}
                    <div>
                        <p className={`text-xs ${colors.label}`}>EPS</p>
                        <p className={`font-bold ${colors.value}`}>
                            {afiliado.eps || '—'}
                        </p>
                    </div>

                    {/* Municipio */}
                    <div>
                        <p className={`text-xs ${colors.label}`}>Municipio</p>
                        <p className={`font-medium ${colors.value}`}>
                            {afiliado.municipio || '—'}
                        </p>
                    </div>

                    {/* Teléfono Editable */}
                    <div>
                        <p className={`text-xs ${colors.label}`}>Teléfono</p>
                        <div className="font-medium">
                            {onPhoneUpdate ? (
                                <EditablePhone
                                    initialValue={afiliado.telefono}
                                    tipoId={afiliado.tipoId || ''}
                                    id={afiliado.id || ''}
                                    onUpdate={onPhoneUpdate}
                                />
                            ) : (
                                <span className={colors.value}>{afiliado.telefono || 'Sin teléfono'}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Botón Cambiar */}
            <div className="mt-2 md:mt-0 flex-shrink-0 self-start md:self-center">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setAfiliado(null)}
                    className={colors.buttonClass}
                >
                    Cambiar
                </Button>
            </div>
        </div>
    )
}
