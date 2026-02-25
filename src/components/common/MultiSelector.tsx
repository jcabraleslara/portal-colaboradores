import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronsUpDown, X } from 'lucide-react'

interface MultiSelectorProps {
    value: string[]
    onChange: (value: string[]) => void
    options: string[]
    placeholder?: string
    disabled?: boolean
}

/**
 * Normalizar texto para búsqueda
 */
function normalizeForSearch(text: string): string {
    return text
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

export function MultiSelector({
    value = [],
    onChange,
    options = [],
    placeholder = 'Seleccionar...',
    disabled = false
}: MultiSelectorProps) {
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState('')
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
    const containerRef = useRef<HTMLDivElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Filtrar opciones disponibles
    const availableOptions = options.filter(opt => !value.includes(opt))

    // Filtrar por texto de búsqueda
    const filteredOptions = inputValue
        ? availableOptions.filter(opt => normalizeForSearch(opt).includes(normalizeForSearch(inputValue)))
        : availableOptions

    const handleUnselect = (item: string) => {
        onChange(value.filter((i) => i !== item))
    }

    const handleSelect = (item: string) => {
        onChange([...value, item])
        setInputValue('')
    }

    // Calcular posición del dropdown
    useLayoutEffect(() => {
        if (open && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            setCoords({
                top: rect.bottom + window.scrollY + 4, // 4px gap
                left: rect.left + window.scrollX,
                width: rect.width
            })
        }
    }, [open, value.length]) // Recalcular si cambia el tamaño por selección items

    // Gestión de eventos externos (click outside y scroll)
    useEffect(() => {
        if (!open) return

        const handleClickOutside = (event: MouseEvent) => {
            // Verificar si el click fue en el container o en el dropdown (portal)
            const target = event.target as Node
            const isClickInContainer = containerRef.current?.contains(target)
            const isClickInDropdown = dropdownRef.current?.contains(target)

            if (!isClickInContainer && !isClickInDropdown) {
                setOpen(false)
            }
        }

        const handleScroll = (event: Event) => {
            // Verificar si el scroll ocurre dentro del dropdown
            const target = event.target as HTMLElement
            const isScrollInDropdown = dropdownRef.current?.contains(target) || target === dropdownRef.current

            // Si es un scroll dentro del dropdown, no cerrar
            if (isScrollInDropdown) {
                return
            }

            // Si es un scroll fuera (ej: la página principal), cerramos para evitar desalineación
            setOpen(false)
        }

        const handleResize = () => setOpen(false)

        document.addEventListener('mousedown', handleClickOutside)
        window.addEventListener('scroll', handleScroll, { capture: true })
        window.addEventListener('resize', handleResize)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            window.removeEventListener('scroll', handleScroll, { capture: true })
            window.removeEventListener('resize', handleResize)
        }
    }, [open])

    const dropdownContent = (
        <div
            ref={dropdownRef}
            style={{
                top: coords.top,
                left: coords.left,
                width: coords.width,
            }}
            className="absolute z-[9999] bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200"
        >
            {filteredOptions.length === 0 ? (
                <p className="p-3 text-sm text-gray-500 text-center">No se encontraron resultados</p>
            ) : (
                <ul className="py-1">
                    {filteredOptions.map((option) => (
                        <li
                            key={option}
                            onClick={() => handleSelect(option)}
                            className="px-4 py-2 hover:bg-[var(--color-primary-50)] dark:hover:bg-primary-900/30 hover:text-[var(--color-primary)] cursor-pointer flex items-center justify-between transition-colors text-sm text-gray-700 dark:text-slate-200"
                        >
                            {option}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )

    return (
        <div ref={containerRef} className="relative w-full text-sm">
            <div
                className={`
                    w-full min-h-[38px] px-2 py-1.5 rounded border bg-white dark:bg-black dark:text-slate-100 flex flex-wrap items-center gap-1.5 cursor-text transition-colors
                    ${disabled ? 'bg-gray-100 dark:bg-white/5 cursor-not-allowed' : 'hover:border-gray-400 dark:hover:border-white/25 focus-within:ring-2 focus-within:ring-[var(--color-primary-100)] dark:focus-within:ring-primary-900/50 focus-within:border-[var(--color-primary)]'}
                    ${open ? 'ring-2 ring-[var(--color-primary-100)] dark:ring-primary-900/50 border-[var(--color-primary)]' : 'border-gray-300 dark:border-white/15'}
                `}
                onClick={() => !disabled && setOpen(true)}
            >
                {value.map((item) => (
                    <span
                        key={item}
                        className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50 px-1.5 py-0.5 rounded text-[11px] font-medium flex items-center gap-1"
                    >
                        {item}
                        <button
                            type="button"
                            className="bg-transparent hover:bg-blue-200 rounded-full p-0.5 transition-colors focus:outline-none"
                            onMouseDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                            }}
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleUnselect(item)
                            }}
                        >
                            <X size={10} />
                        </button>
                    </span>
                ))}

                <input
                    type="text"
                    className="flex-1 bg-transparent outline-none placeholder:text-gray-400 min-w-[80px] text-sm py-0.5"
                    placeholder={value.length === 0 ? placeholder : ''}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={() => setOpen(true)}
                    disabled={disabled}
                />

                <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
            </div>

            {open && !disabled && createPortal(dropdownContent, document.body)}
        </div>
    )
}
