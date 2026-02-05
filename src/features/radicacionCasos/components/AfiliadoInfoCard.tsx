import React from 'react'
import { UserCheck } from 'lucide-react'
import { Button, EditablePhone } from '@/components/common'
import { Afiliado } from '@/types'

interface AfiliadoInfoCardProps {
    afiliado: Afiliado
    setAfiliado: React.Dispatch<React.SetStateAction<Afiliado | null>>
    onPhoneUpdate?: (newPhone: string) => void
}

export function AfiliadoInfoCard({ afiliado, setAfiliado, onPhoneUpdate }: AfiliadoInfoCardProps) {
    // Construir nombre completo
    const nombreCompleto = [afiliado.nombres, afiliado.apellido1, afiliado.apellido2]
        .filter(Boolean)
        .join(' ')

    return (
        <div className="mt-4 p-4 rounded-lg border flex flex-col md:flex-row items-start gap-4 transition-colors bg-green-50 border-green-200">
            <div className="flex items-start gap-4 w-full">
                {/* Icono */}
                <div className="p-2 rounded-full flex-shrink-0 bg-green-100">
                    <UserCheck className="text-green-600" size={24} />
                </div>

                {/* Grid de Información */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 w-full">
                    {/* Nombre - Fila completa en móvil/tablet */}
                    <div className="col-span-1 sm:col-span-2 md:col-span-4">
                        <p className="text-xs text-green-600">Nombre Completo</p>
                        <h3 className="font-bold text-lg text-green-900 leading-tight">
                            {nombreCompleto}
                        </h3>
                    </div>

                    {/* Documento */}
                    <div>
                        <p className="text-xs text-green-600">Documento</p>
                        <p className="font-semibold text-green-700">
                            {afiliado.tipoId} {afiliado.id}
                        </p>
                    </div>

                    {/* EPS */}
                    <div>
                        <p className="text-xs text-green-600">EPS</p>
                        <p className="font-bold text-green-700">
                            {afiliado.eps || '—'}
                        </p>
                    </div>

                    {/* Municipio */}
                    <div>
                        <p className="text-xs text-green-600">Municipio</p>
                        <p className="font-medium text-green-700">
                            {afiliado.municipio || '—'}
                        </p>
                    </div>

                    {/* Teléfono Editable */}
                    <div>
                        <p className="text-xs text-green-600">Teléfono</p>
                        <div className="font-medium">
                            {onPhoneUpdate ? (
                                <EditablePhone
                                    initialValue={afiliado.telefono}
                                    tipoId={afiliado.tipoId || ''}
                                    id={afiliado.id || ''}
                                    onUpdate={onPhoneUpdate}
                                />
                            ) : (
                                <span className="text-green-700">{afiliado.telefono || 'Sin teléfono'}</span>
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
                    className="text-green-700 border-green-300 hover:bg-green-100"
                >
                    Cambiar
                </Button>
            </div>
        </div>
    )
}
