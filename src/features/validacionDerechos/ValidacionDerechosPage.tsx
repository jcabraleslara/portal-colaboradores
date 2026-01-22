/**
 * Página de Validación de Derechos
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState, useCallback, useEffect } from 'react'
import { Search, User, MapPin, Phone, Mail, Calendar, Building, FileText, Eraser } from 'lucide-react'
import { Card, Button, Input, LoadingOverlay, EditablePhone } from '@/components/common'
import { afiliadosService } from '@/services/afiliados.service'
import { Afiliado, LoadingState } from '@/types'
import { UI } from '@/config/constants'

import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/config/constants'

export function ValidacionDerechosPage() {
    const navigate = useNavigate()
    const [documento, setDocumento] = useState('')
    const [afiliado, setAfiliado] = useState<Afiliado | null>(null)
    const [loadingState, setLoadingState] = useState<LoadingState>('idle')
    const [error, setError] = useState('')

    // Estados para búsqueda por nombre
    const [suggestions, setSuggestions] = useState<Afiliado[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)

    // Efecto para búsqueda predictiva (Búsqueda por nombre)
    useEffect(() => {
        const timer = setTimeout(async () => {
            // Si es un número o está vacío, no buscar por nombre
            const isNumeric = /^\d+$/.test(documento)
            const query = documento.trim()

            if (!query || isNumeric || query.length < 3) {
                setSuggestions([])
                setShowSuggestions(false)
                return
            }

            // Si ya tenemos un afiliado seleccionado y coincide el nombre, no buscar
            if (afiliado && (
                `${afiliado.nombres} ${afiliado.apellido1}`.includes(query.toUpperCase())
            )) {
                return
            }

            try {
                const result = await afiliadosService.buscarPorTexto(query)
                if (result.success && result.data) {
                    setSuggestions(result.data)
                    setShowSuggestions(true)
                } else {
                    setSuggestions([])
                    setShowSuggestions(false)
                }
            } catch (err) {
                console.error(err)
            }
        }, 500) // 500ms debounce

        return () => clearTimeout(timer)
    }, [documento, afiliado])

    // Búsqueda manual (Botón Consultar o Enter)
    const handleSearch = useCallback(async () => {
        if (!documento.trim()) {
            setError('Ingresa un número de documento o nombre')
            return
        }

        setShowSuggestions(false) // Ocultar sugerencias al buscar
        setLoadingState('loading')
        setError('')
        setAfiliado(null)

        // Simular debounce visual
        await new Promise(resolve => setTimeout(resolve, UI.SEARCH_DEBOUNCE_MS))

        // Determinar tipo de búsqueda
        const isNumeric = /^\d+$/.test(documento.trim())

        let result
        if (isNumeric) {
            result = await afiliadosService.buscarPorDocumento(documento.trim())
        } else {
            // Si fuerza búsqueda por texto con el botón, busca el primero o muestra error si hay muchos?
            // Para mantener consistencia, si busca texto, usamos buscarPorTexto y tomamos el primero si hay coincidencia exacta o similar?
            // Mejor: Si es texto, usamos buscarPorTexto.
            const textResult = await afiliadosService.buscarPorTexto(documento.trim(), 10)
            if (textResult.success && textResult.data && textResult.data.length > 0) {
                // Si hay resultados, mostramos el primero o dejamos que el usuario elija de la lista (que ya debería haberse mostrado)
                // Si el usuario da Enter, seleccionamos el primero si existe.
                result = { success: true, data: textResult.data[0] }
            } else {
                result = { success: false, error: 'No se encontraron coincidencias' }
            }
        }

        if (result.success && result.data) {
            setAfiliado(result.data)
            setLoadingState('success')
        } else {
            setError(result.error || 'No se encontró el afiliado')
            setLoadingState('error')
        }
    }, [documento])

    const handleSelectSuggestion = (suggestion: Afiliado) => {
        setAfiliado(suggestion)
        setDocumento(suggestion.id || '') // Poner el ID en el input
        setSuggestions([])
        setShowSuggestions(false)
        setLoadingState('success')
        setError('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch()
        }
    }

    const handleClear = () => {
        setDocumento('')
        setAfiliado(null)
        setError('')
        setLoadingState('idle')
    }

    const handleRadicarCaso = () => {
        if (afiliado) {
            navigate(ROUTES.RADICACION_CASOS, {
                state: {
                    afiliado: afiliado,
                    action: 'radicar'
                }
            })
        }
    }

    const handlePhoneUpdate = (newPhone: string) => {
        if (afiliado) {
            setAfiliado({ ...afiliado, telefono: newPhone })
        }
    }

    // Cerrar sugerencias al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = () => setShowSuggestions(false)
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    return (
        <div className="space-y-6">
            {/* Header de página */}
            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                    Validación de Derechos
                </h1>
                <p className="text-gray-500 mt-1">
                    Consulta el estado y datos de afiliados por número de documento
                </p>
            </div>

            {/* Búsqueda */}
            <Card>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative" onClick={(e) => e.stopPropagation()}>
                        <Input
                            placeholder="Ingresa número de documento o también nombres y apellidos"
                            value={documento}
                            onChange={(e) => {
                                // Permitir cualquier caracter para búsqueda por nombre
                                setDocumento(e.target.value)
                                setError('')
                            }}
                            onKeyDown={handleKeyDown}
                            leftIcon={<Search size={20} />}
                            size="lg"
                            className={suggestions.length > 0 && showSuggestions ? 'rounded-b-none' : ''}
                        />

                        {/* Dropdown de Sugerencias */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute z-50 w-full bg-white border border-t-0 border-gray-200 rounded-b-lg shadow-lg max-h-80 overflow-y-auto">
                                {suggestions.map((suggestion) => (
                                    <div
                                        key={`${suggestion.tipoId}-${suggestion.id}`}
                                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                                        onClick={() => handleSelectSuggestion(suggestion)}
                                    >
                                        <div className="font-semibold text-gray-800">
                                            {[suggestion.nombres, suggestion.apellido1, suggestion.apellido2].filter(Boolean).join(' ')}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                                {suggestion.id}
                                            </span>
                                            <span>•</span>
                                            <span className={suggestion.estado === 'ACTIVO' ? 'text-green-600' : 'text-red-500'}>
                                                {suggestion.estado}
                                            </span>
                                            {suggestion.eps && (
                                                <>
                                                    <span>•</span>
                                                    <span>{suggestion.eps}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={handleSearch}
                            isLoading={loadingState === 'loading'}
                            size="lg"
                            leftIcon={<Search size={20} />}
                        >
                            Consultar
                        </Button>

                        {afiliado && (
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleRadicarCaso}
                                leftIcon={<FileText size={20} />}
                                className="animate-scale-in bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-md hover:shadow-lg transition-all"
                            >
                                Radicar Caso
                            </Button>
                        )}

                        {(afiliado || error) && (
                            <Button
                                variant="accent"
                                size="lg"
                                onClick={handleClear}
                                leftIcon={<Eraser size={20} />}
                                className="animate-scale-in"
                            >
                                Limpiar
                            </Button>
                        )}
                    </div>
                </div>

                {/* Error */}
                {error && loadingState !== 'loading' && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-[var(--color-error)]">{error}</p>
                    </div>
                )}
            </Card>

            {/* Resultado */}
            <LoadingOverlay isLoading={loadingState === 'loading'} label="Buscando afiliado...">
                {afiliado && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Datos Personales */}
                        <Card>
                            <Card.Header>
                                <div className="flex items-center gap-2">
                                    <User size={20} className="text-[var(--color-primary)]" />
                                    Datos Personales
                                </div>
                            </Card.Header>
                            <Card.Body>
                                <DataGrid>
                                    <DataItem label="Tipo Documento" value={afiliado.tipoId} />
                                    <DataItem label="Documento" value={afiliado.id} highlight />
                                    <DataItem
                                        label="Nombre Completo"
                                        value={
                                            <span className="text-base font-bold text-[var(--color-primary)]">
                                                {[afiliado.nombres, afiliado.apellido1, afiliado.apellido2]
                                                    .filter(Boolean).join(' ')}
                                            </span>
                                        }
                                        fullWidth
                                    />
                                    <DataItem label="Sexo" value={afiliado.sexo} />
                                    <DataItem label="Edad" value={afiliado.edad ? `${afiliado.edad} años` : null} />
                                    <DataItem
                                        label="Fecha Nacimiento"
                                        value={afiliado.fechaNacimiento?.toLocaleDateString('es-CO')}
                                        icon={<Calendar size={14} />}
                                    />
                                    <DataItem label="Rango" value={afiliado.rango} />
                                </DataGrid>
                            </Card.Body>
                        </Card>

                        {/* Datos de Afiliación */}
                        <Card>
                            <Card.Header>
                                <div className="flex items-center gap-2">
                                    <Building size={20} className="text-[var(--color-primary)]" />
                                    Afiliación
                                </div>
                            </Card.Header>
                            <Card.Body>
                                <DataGrid>
                                    <DataItem label="EPS" value={renderEPS(afiliado.eps)} />
                                    <DataItem label="Régimen" value={afiliado.regimen} />
                                    <DataItem
                                        label="Estado"
                                        value={
                                            <span className={`px-2.5 py-1 rounded-md text-sm font-bold border ${afiliado.estado?.toUpperCase() === 'ACTIVO'
                                                ? 'bg-green-100 text-green-700 border-green-200'
                                                : 'bg-red-100 text-red-700 border-red-200 animate-pulse'
                                                }`}>
                                                {afiliado.estado}
                                            </span>
                                        }
                                    />
                                    <DataItem label="Tipo Cotizante" value={afiliado.tipoCotizante} />
                                    <DataItem label="IPS Primaria" value={renderIPS(afiliado.ipsPrimaria)} fullWidth />
                                    <DataItem
                                        label="Fuente"
                                        value={
                                            <span>
                                                {afiliado.fuente}
                                                {afiliado.updatedAt && (
                                                    <span className="text-xs text-gray-400 ml-1 font-normal">
                                                        (Datos actualizados el {afiliado.updatedAt.toLocaleDateString('es-CO')})
                                                    </span>
                                                )}
                                            </span>
                                        }
                                    />
                                </DataGrid>
                            </Card.Body>
                        </Card>

                        {/* Datos de Contacto */}
                        <Card>
                            <Card.Header>
                                <div className="flex items-center gap-2">
                                    <Phone size={20} className="text-[var(--color-primary)]" />
                                    Contacto y Ubicación
                                </div>
                            </Card.Header>
                            <Card.Body>
                                <DataGrid>
                                    <DataItem
                                        label="Dirección"
                                        value={afiliado.direccion}
                                        icon={<MapPin size={14} />}
                                        fullWidth
                                    />
                                    <DataItem
                                        label="Teléfono"
                                        value={
                                            <EditablePhone
                                                initialValue={afiliado.telefono}
                                                tipoId={afiliado.tipoId || ''}
                                                id={afiliado.id || ''}
                                                onUpdate={handlePhoneUpdate}
                                            />
                                        }
                                        icon={<Phone size={14} />}
                                    />
                                    <DataItem
                                        label="Email"
                                        value={renderEmail(afiliado.email)}
                                        icon={<Mail size={14} />}
                                        fullWidth
                                    />
                                    <DataItem label="Departamento" value={afiliado.departamento} />
                                    <DataItem label="Municipio" value={afiliado.municipio} />
                                </DataGrid>
                            </Card.Body>
                        </Card>

                        {/* Observaciones */}
                        <Card>
                            <Card.Header>
                                <div className="flex items-center gap-2">
                                    <FileText size={20} className="text-[var(--color-primary)]" />
                                    Observaciones
                                </div>
                            </Card.Header>
                            <Card.Body>
                                <p className="text-[var(--color-text-secondary)] whitespace-pre-wrap">
                                    {afiliado.observaciones || 'Sin observaciones'}
                                </p>
                            </Card.Body>
                        </Card>
                    </div>
                )}
            </LoadingOverlay>
        </div>
    )
}

// Componentes auxiliares para la grilla de datos
function DataGrid({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-2 gap-4">
            {children}
        </div>
    )
}


// Helper para estilizar EPS
const renderEPS = (epsName: string | null | undefined) => {
    if (!epsName) return null
    const name = epsName.toUpperCase()
    let className = "text-lg font-black tracking-tight " // Base style

    if (name.includes('NUEVA EPS')) {
        return <span className={`${className} text-blue-600`}>{epsName}</span>
    } else if (name.includes('SALUD TOTAL')) {
        return <span className={`${className} text-amber-500`}>{epsName}</span>
    }

    return <span className={className}>{epsName}</span>
}

// Helper para estilizar IPS
const renderIPS = (ipsName: string | null | undefined) => {
    if (!ipsName) return null
    return (
        <div className="mt-1">
            <span className="text-lg font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">
                {ipsName}
            </span>
        </div>
    )
}

// Helper para estilizar Email
const renderEmail = (email: string | null | undefined) => {
    if (!email) return null
    return (
        <a
            href={`mailto:${email.toLowerCase()}`}
            className="text-base text-blue-600 hover:text-blue-700 hover:underline transition-all lowercase truncate font-semibold"
            title={email}
        >
            {email.toLowerCase()}
        </a>
    )
}

function DataItem({
    label,
    value,
    icon,
    fullWidth = false,
    highlight = false,
}: {
    label: string
    value: React.ReactNode
    icon?: React.ReactNode
    fullWidth?: boolean
    highlight?: boolean
}) {
    return (
        <div className={fullWidth ? 'col-span-2 min-w-0' : 'min-w-0'}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <div className={`text-sm flex items-center gap-1.5 min-w-0 ${highlight
                ? 'font-semibold text-[var(--color-primary)]'
                : 'text-[var(--color-text-primary)]'
                }`}>
                {icon && <span className="text-gray-400 flex-shrink-0">{icon}</span>}
                <div className="truncate flex-1">
                    {value || <span className="text-gray-400">—</span>}
                </div>
            </div>
        </div>
    )
}



export default ValidacionDerechosPage
