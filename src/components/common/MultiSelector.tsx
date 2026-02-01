import { useState, useRef, useEffect } from 'react'
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
    const containerRef = useRef<HTMLDivElement>(null)

    // Filtrar opciones disponibles (que no estén ya seleccionadas)
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
        // Mantener foco si se desea seguir seleccionando, o cerrar
        // setOpen(false) 
    }

    // Gestionar click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    return (
        <div ref={containerRef} className="relative w-full text-sm">
            <div
                className={`
                    w-full min-h-[42px] px-3 py-2 rounded-lg border bg-white flex flex-wrap items-center gap-2 cursor-text transition-colors
                    ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-gray-400 focus-within:ring-2 focus-within:ring-[var(--color-primary-100)] focus-within:border-[var(--color-primary)]'}
                    ${open ? 'ring-2 ring-[var(--color-primary-100)] border-[var(--color-primary)]' : 'border-gray-300'}
                `}
                onClick={() => !disabled && setOpen(true)}
            >
                {value.map((item) => (
                    <span
                        key={item}
                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 animate-in zoom-in-50 duration-200"
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
                            <X size={12} />
                        </button>
                    </span>
                ))}

                <input
                    type="text"
                    className="flex-1 bg-transparent outline-none placeholder:text-gray-400 min-w-[120px]"
                    placeholder={value.length === 0 ? placeholder : ''}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={() => setOpen(true)}
                    disabled={disabled}
                />

                <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
            </div>

            {open && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200">
                    {filteredOptions.length === 0 ? (
                        <p className="p-3 text-sm text-gray-500 text-center">No se encontraron resultados</p>
                    ) : (
                        <ul className="py-1">
                            {filteredOptions.map((option) => (
                                <li
                                    key={option}
                                    onClick={() => handleSelect(option)}
                                    className="px-4 py-2 hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary)] cursor-pointer flex items-center justify-between transition-colors"
                                >
                                    {option}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}
