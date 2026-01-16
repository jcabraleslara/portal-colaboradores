/**
 * Componente Autocomplete Genérico
 * Input con autocompletado fuzzy reutilizable
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'

interface AutocompleteProps {
    value: string
    onChange: (value: string) => void
    options: readonly string[]
    placeholder?: string
    disabled?: boolean
    allowFreeText?: boolean
}

/**
 * Normalizar texto para búsqueda (sin tildes, mayúsculas)
 */
function normalizeForSearch(text: string): string {
    return text
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Búsqueda fuzzy: encuentra coincidencias donde todas las palabras
 * del query aparecen en cualquier parte del texto
 */
function fuzzyMatch(query: string, text: string): boolean {
    const normalizedQuery = normalizeForSearch(query)
    const normalizedText = normalizeForSearch(text)

    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0)
    return queryWords.every(word => normalizedText.includes(word))
}

export function Autocomplete({
    value,
    onChange,
    options,
    placeholder = 'Buscar...',
    disabled = false,
    allowFreeText = true,
}: AutocompleteProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [inputValue, setInputValue] = useState(value)
    const [filteredOptions, setFilteredOptions] = useState<string[]>([])
    const [highlightedIndex, setHighlightedIndex] = useState(-1)

    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLUListElement>(null)

    useEffect(() => {
        setInputValue(value)
    }, [value])

    useEffect(() => {
        if (inputValue.trim().length >= 1) {
            const filtered = options.filter(opt => fuzzyMatch(inputValue, opt))
            setFilteredOptions(filtered.slice(0, 10))
        } else {
            setFilteredOptions([])
        }
        setHighlightedIndex(-1)
    }, [inputValue, options])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
                if (allowFreeText && inputValue.trim() && inputValue !== value) {
                    onChange(normalizeForSearch(inputValue))
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [inputValue, onChange, value, allowFreeText])

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value)
        setIsOpen(true)
    }, [])

    const handleSelect = useCallback((option: string) => {
        setInputValue(option)
        onChange(option)
        setIsOpen(false)
        inputRef.current?.blur()
    }, [onChange])

    const handleClear = useCallback(() => {
        setInputValue('')
        onChange('')
        setFilteredOptions([])
        inputRef.current?.focus()
    }, [onChange])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsOpen(true)
            }
            return
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setHighlightedIndex(prev =>
                    prev < filteredOptions.length - 1 ? prev + 1 : prev
                )
                break
            case 'ArrowUp':
                e.preventDefault()
                setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0)
                break
            case 'Enter':
                e.preventDefault()
                if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
                    handleSelect(filteredOptions[highlightedIndex])
                } else if (allowFreeText && inputValue.trim()) {
                    onChange(normalizeForSearch(inputValue))
                    setIsOpen(false)
                }
                break
            case 'Escape':
                setIsOpen(false)
                break
        }
    }, [isOpen, highlightedIndex, filteredOptions, handleSelect, inputValue, onChange, allowFreeText])

    const handleBlur = useCallback(() => {
        setTimeout(() => {
            if (allowFreeText && inputValue.trim() && inputValue !== value) {
                onChange(normalizeForSearch(inputValue))
            }
        }, 150)
    }, [inputValue, onChange, value, allowFreeText])

    useEffect(() => {
        if (listRef.current && highlightedIndex >= 0) {
            const item = listRef.current.children[highlightedIndex] as HTMLElement
            if (item) {
                item.scrollIntoView({ block: 'nearest' })
            }
        }
    }, [highlightedIndex])

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search size={18} />
                </span>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`
                        w-full pl-10 pr-16 py-2.5 rounded-lg border bg-white text-sm
                        focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] focus:border-[var(--color-primary)]
                        ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300'}
                    `}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {inputValue && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                        >
                            <X size={16} />
                        </button>
                    )}
                    <ChevronDown
                        size={18}
                        className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                </div>
            </div>

            {isOpen && filteredOptions.length > 0 && (
                <ul
                    ref={listRef}
                    className="absolute z-50 w-full mt-1 max-h-48 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg"
                >
                    {filteredOptions.map((option, index) => (
                        <li
                            key={option}
                            onClick={() => handleSelect(option)}
                            className={`
                                px-4 py-2 cursor-pointer text-sm transition-colors
                                ${index === highlightedIndex
                                    ? 'bg-[var(--color-primary-50)] text-[var(--color-primary)]'
                                    : 'hover:bg-gray-50'
                                }
                            `}
                        >
                            {option}
                        </li>
                    ))}
                </ul>
            )}

            {isOpen && inputValue.length >= 1 && filteredOptions.length === 0 && (
                <div className="absolute z-50 w-full mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
                    <p className="text-sm text-gray-500 text-center">
                        No se encontraron coincidencias
                        {allowFreeText && <><br /><span className="text-xs">Presiona Enter para usar el texto ingresado</span></>}
                    </p>
                </div>
            )}
        </div>
    )
}

export default Autocomplete
