/**
 * Hook reutilizable para búsqueda de afiliados
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * Centraliza la lógica de búsqueda por documento y texto predictivo
 * usada en SoportesFacturacion, Recobros, RadicacionCasos y Anexo8.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { afiliadosService } from '@/services/afiliados.service'
import { Afiliado, LoadingState } from '@/types'

export interface UseAfiliadoSearchOptions {
    /** Habilita búsqueda predictiva por texto (nombre, apellido, documento) */
    enableTextSearch?: boolean
    /** Milisegundos de debounce para búsqueda por texto. Default: 700 */
    debounceMs?: number
    /** Callback cuando no se encuentra el afiliado por documento */
    onNotFound?: (documento: string) => void
    /** Callback cuando se encuentra el afiliado */
    onFound?: (afiliado: Afiliado) => void
    /** Restringe entrada a solo dígitos */
    digitOnly?: boolean
}

export interface UseAfiliadoSearchReturn {
    /** Valor actual del campo de documento/búsqueda */
    documento: string
    /** Setter para documento (filtra dígitos si digitOnly=true) */
    setDocumento: (value: string) => void
    /** Afiliado encontrado (o seleccionado de sugerencias) */
    afiliado: Afiliado | null
    /** Setter directo para afiliado (útil para navegación con state, crear afiliado, etc.) */
    setAfiliado: (afiliado: Afiliado | null) => void
    /** Estado de la búsqueda */
    searchState: LoadingState
    /** Setter directo para searchState (útil para navegación con state) */
    setSearchState: (state: LoadingState) => void
    /** Mensaje de error de búsqueda */
    searchError: string
    /** Setter directo para searchError */
    setSearchError: (error: string) => void
    /** Lista de sugerencias (solo con enableTextSearch) */
    suggestions: Afiliado[]
    /** Controla visibilidad del dropdown de sugerencias */
    showSuggestions: boolean
    /** Setter para controlar visibilidad de sugerencias */
    setShowSuggestions: (show: boolean) => void
    /** Ejecuta búsqueda por documento exacto */
    handleSearch: () => Promise<void>
    /** Selecciona un afiliado de las sugerencias */
    handleSelectSuggestion: (afiliado: Afiliado) => void
    /** Resetea todos los estados del hook */
    handleClear: () => void
}

export function useAfiliadoSearch(options: UseAfiliadoSearchOptions = {}): UseAfiliadoSearchReturn {
    const {
        enableTextSearch = false,
        debounceMs = 700,
        onNotFound,
        onFound,
        digitOnly = false,
    } = options

    // Refs para callbacks estables
    const onNotFoundRef = useRef(onNotFound)
    const onFoundRef = useRef(onFound)
    onNotFoundRef.current = onNotFound
    onFoundRef.current = onFound

    // Estado principal
    const [documento, setDocumentoRaw] = useState('')
    const [afiliado, setAfiliado] = useState<Afiliado | null>(null)
    const [searchState, setSearchState] = useState<LoadingState>('idle')
    const [searchError, setSearchError] = useState('')

    // Estado de sugerencias (solo enableTextSearch)
    const [suggestions, setSuggestions] = useState<Afiliado[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)

    // Setter con filtro de dígitos
    const setDocumento = useCallback((value: string) => {
        const cleaned = digitOnly ? value.replace(/\D/g, '') : value
        setDocumentoRaw(cleaned)
        setSearchError('')
    }, [digitOnly])

    // Búsqueda por documento exacto
    const handleSearch = useCallback(async () => {
        const doc = documento.trim()
        if (!doc) {
            setSearchError('Ingresa un número de documento')
            return
        }

        setSearchState('loading')
        setSearchError('')
        setAfiliado(null)
        setSuggestions([])
        setShowSuggestions(false)

        const result = await afiliadosService.buscarPorDocumento(doc)

        if (result.success && result.data) {
            setAfiliado(result.data)
            setSearchState('success')
            onFoundRef.current?.(result.data)
        } else {
            setSearchError('')
            setSearchState('error')
            onNotFoundRef.current?.(doc)
        }
    }, [documento])

    // Búsqueda predictiva por texto (debounced)
    useEffect(() => {
        if (!enableTextSearch) return
        if (afiliado) return // No buscar si ya hay afiliado seleccionado

        const text = documento.trim()
        if (text.length < 3) {
            setSuggestions([])
            setShowSuggestions(false)
            return
        }

        const timer = setTimeout(async () => {
            // Primero intentar búsqueda exacta por documento
            const resultDoc = await afiliadosService.buscarPorDocumento(text)
            if (resultDoc.success && resultDoc.data) {
                setSuggestions([resultDoc.data])
                setShowSuggestions(true)
                return
            }

            // Luego buscar por texto
            const resultTexto = await afiliadosService.buscarPorTexto(text, 10)
            if (resultTexto.success && resultTexto.data && resultTexto.data.length > 0) {
                setSuggestions(resultTexto.data)
                setShowSuggestions(true)
            } else {
                setSuggestions([])
                setShowSuggestions(false)
                onNotFoundRef.current?.(text)
            }
        }, debounceMs)

        return () => clearTimeout(timer)
    }, [documento, enableTextSearch, debounceMs, afiliado])

    // Seleccionar afiliado de sugerencias
    const handleSelectSuggestion = useCallback((selected: Afiliado) => {
        setAfiliado(selected)
        setSearchState('success')
        setSuggestions([])
        setShowSuggestions(false)
        setDocumentoRaw('')
        onFoundRef.current?.(selected)
    }, [])

    // Limpiar solo estados del hook
    const handleClear = useCallback(() => {
        setDocumentoRaw('')
        setAfiliado(null)
        setSearchState('idle')
        setSearchError('')
        setSuggestions([])
        setShowSuggestions(false)
    }, [])

    return {
        documento,
        setDocumento,
        afiliado,
        setAfiliado,
        searchState,
        setSearchState,
        searchError,
        setSearchError,
        suggestions,
        showSuggestions,
        setShowSuggestions,
        handleSearch,
        handleSelectSuggestion,
        handleClear,
    }
}
