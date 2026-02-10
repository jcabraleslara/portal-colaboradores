/**
 * Selector de usuario radicador con autocompletado
 * Busca usuarios activos del portal para asignar la radicación
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { X, ChevronDown, UserCheck, Mail } from 'lucide-react'
import { supabase } from '@/config/supabase.config'

interface UsuarioPortal {
    id: string
    nombreCompleto: string
    email: string
    rol: string
}

interface UsuarioRadicadorSelectorProps {
    onSelect: (usuario: { nombre: string; email: string } | null) => void
    disabled?: boolean
}

/** Normalizar texto para búsqueda (sin tildes, minúsculas) */
function normalizar(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

/** Etiqueta legible del rol */
function rolLabel(rol: string): string {
    const MAP: Record<string, string> = {
        superadmin: 'Super Admin',
        admin: 'Administrador',
        gerencia: 'Gerencia',
        auditor: 'Auditor',
        operativo: 'Operativo',
        asistencial: 'Asistencial',
        externo: 'Externo',
    }
    return MAP[rol] || rol
}

export function UsuarioRadicadorSelector({ onSelect, disabled = false }: UsuarioRadicadorSelectorProps) {
    const [inputValue, setInputValue] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [opciones, setOpciones] = useState<UsuarioPortal[]>([])
    const [seleccionado, setSeleccionado] = useState<UsuarioPortal | null>(null)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [cargando, setCargando] = useState(false)

    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLUListElement>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    // Cerrar dropdown al hacer clic afuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Scroll al elemento resaltado
    useEffect(() => {
        if (listRef.current && highlightedIndex >= 0) {
            const item = listRef.current.children[highlightedIndex] as HTMLElement
            item?.scrollIntoView({ block: 'nearest' })
        }
    }, [highlightedIndex])

    /** Buscar usuarios activos en la BD */
    const buscarUsuarios = useCallback(async (termino: string) => {
        if (termino.trim().length < 2) {
            setOpciones([])
            return
        }

        setCargando(true)
        try {
            const { data, error } = await supabase
                .from('usuarios_portal')
                .select('id, nombre_completo, email_institucional, rol')
                .eq('activo', true)
                .or(`nombre_completo.ilike.%${termino}%,email_institucional.ilike.%${termino}%`)
                .order('nombre_completo')
                .limit(10)

            if (!error && data) {
                setOpciones(
                    data.map(u => ({
                        id: u.id,
                        nombreCompleto: u.nombre_completo,
                        email: u.email_institucional,
                        rol: u.rol,
                    }))
                )
            }
        } catch {
            // silenciar error de red
        } finally {
            setCargando(false)
        }
    }, [])

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setInputValue(val)
        setIsOpen(true)
        setHighlightedIndex(-1)

        // Debounce de 300ms para no hacer queries por cada keystroke
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => buscarUsuarios(val), 300)
    }, [buscarUsuarios])

    const handleSelect = useCallback((usuario: UsuarioPortal) => {
        setSeleccionado(usuario)
        setInputValue(usuario.nombreCompleto)
        setIsOpen(false)
        onSelect({ nombre: usuario.nombreCompleto, email: usuario.email })
        inputRef.current?.blur()
    }, [onSelect])

    const handleClear = useCallback(() => {
        setSeleccionado(null)
        setInputValue('')
        setOpciones([])
        onSelect(null)
        inputRef.current?.focus()
    }, [onSelect])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown') setIsOpen(true)
            return
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setHighlightedIndex(prev => (prev < opciones.length - 1 ? prev + 1 : prev))
                break
            case 'ArrowUp':
                e.preventDefault()
                setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0))
                break
            case 'Enter':
                e.preventDefault()
                if (highlightedIndex >= 0 && opciones[highlightedIndex]) {
                    handleSelect(opciones[highlightedIndex])
                }
                break
            case 'Escape':
                setIsOpen(false)
                break
        }
    }, [isOpen, highlightedIndex, opciones, handleSelect])

    /** Resaltar coincidencia en texto */
    const resaltarCoincidencia = (texto: string, query: string) => {
        if (!query.trim()) return texto
        const norm = normalizar(query)
        const idx = normalizar(texto).indexOf(norm)
        if (idx === -1) return texto
        return (
            <>
                {texto.slice(0, idx)}
                <mark className="bg-yellow-200 rounded px-0.5">{texto.slice(idx, idx + query.length)}</mark>
                {texto.slice(idx + query.length)}
            </>
        )
    }

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <UserCheck size={18} />
                </span>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => { if (inputValue.length >= 2) setIsOpen(true) }}
                    onKeyDown={handleKeyDown}
                    placeholder="Buscar usuario por nombre o correo..."
                    disabled={disabled}
                    className={`
                        w-full pl-10 pr-16 py-2.5 rounded-lg border bg-white text-sm
                        focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] focus:border-[var(--color-primary)]
                        ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300'}
                        ${seleccionado ? 'border-green-300 bg-green-50' : ''}
                    `}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {(inputValue || seleccionado) && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                        >
                            <X size={16} />
                        </button>
                    )}
                    {cargando ? (
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-[var(--color-primary)] rounded-full animate-spin" />
                    ) : (
                        <ChevronDown
                            size={18}
                            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                    )}
                </div>
            </div>

            {/* Info del usuario seleccionado */}
            {seleccionado && (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-md border border-green-200">
                    <Mail size={13} />
                    <span>{seleccionado.email}</span>
                    <span className="ml-auto px-1.5 py-0.5 bg-green-100 text-green-800 rounded text-[10px] font-medium">
                        {rolLabel(seleccionado.rol)}
                    </span>
                </div>
            )}

            {/* Dropdown de resultados */}
            {isOpen && opciones.length > 0 && (
                <ul
                    ref={listRef}
                    className="absolute z-50 w-full mt-1 max-h-56 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg"
                >
                    {opciones.map((usuario, index) => (
                        <li
                            key={usuario.id}
                            onClick={() => handleSelect(usuario)}
                            className={`
                                px-4 py-2.5 cursor-pointer text-sm transition-colors border-b border-gray-50 last:border-0
                                ${index === highlightedIndex
                                    ? 'bg-[var(--color-primary-50)] text-[var(--color-primary)]'
                                    : 'hover:bg-gray-50'
                                }
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-medium">
                                    {resaltarCoincidencia(usuario.nombreCompleto, inputValue)}
                                </span>
                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium ml-2 shrink-0">
                                    {rolLabel(usuario.rol)}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {resaltarCoincidencia(usuario.email, inputValue)}
                            </p>
                        </li>
                    ))}
                </ul>
            )}

            {isOpen && inputValue.length >= 2 && opciones.length === 0 && !cargando && (
                <div className="absolute z-50 w-full mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
                    <p className="text-sm text-gray-500 text-center">
                        No se encontraron usuarios activos
                    </p>
                </div>
            )}
        </div>
    )
}

export default UsuarioRadicadorSelector
