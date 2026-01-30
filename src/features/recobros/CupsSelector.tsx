/**
 * Selector de CUPS con búsqueda dinámica
 * Para radicación de recobros
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, Plus, Trash2, Star } from 'lucide-react'
import { Input, Button } from '@/components/common'
import { cupsService } from '@/services/cups.service'
import { CupsSeleccionado } from '@/types/recobros.types'
import type { Cups } from '@/types'

interface CupsSelectorProps {
    value: CupsSeleccionado[]
    onChange: (cups: CupsSeleccionado[]) => void
    disabled?: boolean
}

export function CupsSelector({ value, onChange, disabled }: CupsSelectorProps) {
    const [busqueda, setBusqueda] = useState('')
    const [resultados, setResultados] = useState<Cups[]>([])
    const [buscando, setBuscando] = useState(false)
    const [mostrarDropdown, setMostrarDropdown] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    // Buscar CUPS con debounce
    const buscarCups = useCallback(async (termino: string) => {
        if (termino.length < 2) {
            setResultados([])
            setMostrarDropdown(false)
            return
        }

        setBuscando(true)
        const result = await cupsService.buscar(termino)

        if (result.success && result.data) {
            setResultados(result.data.slice(0, 15)) // Limitar a 15 resultados
            setMostrarDropdown(true)
        } else {
            setResultados([])
        }
        setBuscando(false)
    }, [])

    // Manejar cambio en el input con debounce
    const handleBusquedaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const valor = e.target.value
        setBusqueda(valor)

        if (debounceRef.current) {
            clearTimeout(debounceRef.current)
        }

        debounceRef.current = setTimeout(() => {
            buscarCups(valor)
        }, 300)
    }

    // Agregar CUPS seleccionado
    const handleAgregarCups = (cups: Cups) => {
        // Verificar si ya está en la lista
        if (value.some(c => c.cups === cups.cups)) {
            return
        }

        const nuevoCups: CupsSeleccionado = {
            cups: cups.cups,
            descripcion: cups.descripcion || '',
            cantidad: 1,
            es_principal: value.length === 0, // El primero es principal por defecto
        }

        onChange([...value, nuevoCups])
        setBusqueda('')
        setResultados([])
        setMostrarDropdown(false)
    }

    // Eliminar CUPS de la lista
    const handleEliminarCups = (index: number) => {
        const nuevaLista = value.filter((_, i) => i !== index)

        // Si eliminamos el principal, asignar el primero como nuevo principal
        if (value[index].es_principal && nuevaLista.length > 0) {
            nuevaLista[0].es_principal = true
        }

        onChange(nuevaLista)
    }

    // Cambiar cantidad
    const handleCantidadChange = (index: number, cantidad: number) => {
        const nuevaLista = [...value]
        nuevaLista[index].cantidad = Math.max(1, cantidad)
        onChange(nuevaLista)
    }

    // Marcar como principal
    const handleMarcarPrincipal = (index: number) => {
        const nuevaLista = value.map((cups, i) => ({
            ...cups,
            es_principal: i === index,
        }))
        onChange(nuevaLista)
    }

    // Cerrar dropdown al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setMostrarDropdown(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="space-y-4">
            {/* Buscador */}
            <div className="relative">
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <Input
                            ref={inputRef}
                            placeholder="Buscar CUPS por código o descripción..."
                            value={busqueda}
                            onChange={handleBusquedaChange}
                            onFocus={() => resultados.length > 0 && setMostrarDropdown(true)}
                            leftIcon={<Search size={18} />}
                            disabled={disabled}
                        />
                        {buscando && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-500" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Dropdown de resultados */}
                {mostrarDropdown && resultados.length > 0 && (
                    <div
                        ref={dropdownRef}
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                    >
                        {resultados.map((cups) => {
                            const yaAgregado = value.some(c => c.cups === cups.cups)
                            return (
                                <button
                                    key={cups.cups}
                                    type="button"
                                    onClick={() => !yaAgregado && handleAgregarCups(cups)}
                                    disabled={yaAgregado}
                                    className={`
                                        w-full text-left px-4 py-3 border-b border-gray-100 last:border-0
                                        ${yaAgregado
                                            ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                            : 'hover:bg-blue-50 cursor-pointer'
                                        }
                                    `}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <code className="text-sm font-bold text-blue-600">
                                                {cups.cups}
                                            </code>
                                            <p className="text-sm text-gray-700 truncate mt-0.5">
                                                {cups.descripcion}
                                            </p>
                                        </div>
                                        {yaAgregado ? (
                                            <span className="text-xs text-gray-400 whitespace-nowrap">Agregado</span>
                                        ) : (
                                            <Plus size={18} className="text-blue-500 flex-shrink-0" />
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Tabla de CUPS seleccionados */}
            {value.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Principal
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Código
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Descripción
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-24">
                                    Cantidad
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-16">
                                    Acción
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {value.map((cups, index) => (
                                <tr key={cups.cups} className={cups.es_principal ? 'bg-yellow-50' : ''}>
                                    <td className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => handleMarcarPrincipal(index)}
                                            disabled={disabled}
                                            className={`p-1 rounded-full transition-colors ${
                                                cups.es_principal
                                                    ? 'text-yellow-500'
                                                    : 'text-gray-300 hover:text-yellow-400'
                                            }`}
                                            title={cups.es_principal ? 'CUPS Principal' : 'Marcar como principal'}
                                        >
                                            <Star
                                                size={20}
                                                fill={cups.es_principal ? 'currentColor' : 'none'}
                                            />
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <code className="text-sm font-bold text-blue-600">
                                            {cups.cups}
                                        </code>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-sm text-gray-700 line-clamp-2">
                                            {cups.descripcion}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="number"
                                            min="1"
                                            value={cups.cantidad}
                                            onChange={(e) => handleCantidadChange(index, parseInt(e.target.value) || 1)}
                                            disabled={disabled}
                                            className="w-20 px-2 py-1 text-center border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEliminarCups(index)}
                                            disabled={disabled}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Mensaje si no hay CUPS */}
            {value.length === 0 && (
                <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <Search className="mx-auto text-gray-300 mb-2" size={32} />
                    <p className="text-sm text-gray-500">
                        Busca y agrega los procedimientos CUPS para este recobro
                    </p>
                </div>
            )}
        </div>
    )
}

export default CupsSelector
