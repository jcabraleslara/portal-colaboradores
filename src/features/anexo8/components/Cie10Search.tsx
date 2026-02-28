/**
 * Componente de búsqueda CIE-10
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { buscarCie10, Cie10 } from '@/services/cie10.service'
import { FaSearch, FaTimes } from 'react-icons/fa'

interface Cie10SearchProps {
    value: { codigo: string; descripcion: string }
    onChange: (data: { codigo: string; descripcion: string }) => void
    placeholder?: string
    disabled?: boolean
}

export function Cie10Search({ value, onChange, placeholder = 'Buscar CIE-10...', disabled }: Cie10SearchProps) {
    const [busqueda, setBusqueda] = useState('')
    const [resultados, setResultados] = useState<Cie10[]>([])
    const [buscando, setBuscando] = useState(false)
    const [mostrarResultados, setMostrarResultados] = useState(false)
    const [seleccionado, setSeleccionado] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Mostrar valor seleccionado
    const displayValue = seleccionado && value.codigo
        ? `${value.codigo} - ${value.descripcion}`
        : busqueda

    // Buscar con debounce
    const buscar = useCallback(async (texto: string) => {
        if (texto.length < 2) {
            setResultados([])
            return
        }

        setBuscando(true)
        const result = await buscarCie10(texto, 15)
        if (result.success && result.data) {
            setResultados(result.data)
            setMostrarResultados(true)
        }
        setBuscando(false)
    }, [])

    useEffect(() => {
        if (seleccionado) return // No buscar si ya seleccionó

        const timer = setTimeout(() => {
            if (busqueda) buscar(busqueda)
        }, 300)

        return () => clearTimeout(timer)
    }, [busqueda, buscar, seleccionado])

    // Click fuera cierra resultados
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setMostrarResultados(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Seleccionar diagnóstico
    const seleccionar = (cie: Cie10) => {
        onChange({ codigo: cie.cie10, descripcion: cie.cie10_descripcion })
        setBusqueda(`${cie.cie10} - ${cie.cie10_descripcion}`)
        setSeleccionado(true)
        setMostrarResultados(false)
        setResultados([])
    }

    // Limpiar selección
    const limpiar = () => {
        onChange({ codigo: '', descripcion: '' })
        setBusqueda('')
        setSeleccionado(false)
        setResultados([])
    }

    // Editar después de seleccionar
    const handleInputChange = (texto: string) => {
        if (seleccionado) {
            setSeleccionado(false)
            onChange({ codigo: '', descripcion: '' })
        }
        setBusqueda(texto)
    }

    return (
        <div ref={containerRef} className="relative">
            <div className="flex items-center border border-slate-300 dark:border-white/15 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-amber-400">
                <FaSearch className="text-slate-400 dark:text-slate-500 ml-3" />
                <input
                    type="text"
                    placeholder={placeholder}
                    value={displayValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onFocus={() => !seleccionado && resultados.length > 0 && setMostrarResultados(true)}
                    disabled={disabled}
                    className="w-full px-3 py-2.5 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-white/5 bg-transparent dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                {buscando && (
                    <div className="mr-3 w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                )}
                {seleccionado && (
                    <button
                        type="button"
                        onClick={limpiar}
                        className="mr-3 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                    >
                        <FaTimes />
                    </button>
                )}
            </div>

            {/* Resultados de búsqueda */}
            {mostrarResultados && resultados.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-black border border-slate-200 dark:border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {resultados.map((cie) => (
                        <button
                            key={cie.cie10}
                            type="button"
                            onClick={() => seleccionar(cie)}
                            className="w-full text-left px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/20 border-b dark:border-white/10 last:border-b-0 transition-colors"
                        >
                            <p className="font-medium text-slate-800 dark:text-slate-100">
                                <span className="text-amber-600 dark:text-amber-400 font-bold">{cie.cie10}</span>
                                {' - '}{cie.cie10_descripcion}
                            </p>
                        </button>
                    ))}
                </div>
            )}

            {/* No resultados */}
            {mostrarResultados && busqueda.length >= 2 && resultados.length === 0 && !buscando && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-black border border-slate-200 dark:border-white/10 rounded-lg shadow-xl p-4 text-center">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No se encontraron diagnósticos</p>
                </div>
            )}
        </div>
    )
}

export default Cie10Search
