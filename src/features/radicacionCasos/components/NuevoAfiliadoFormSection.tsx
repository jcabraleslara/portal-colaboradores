import React from 'react'
import { AlertCircle, Plus } from 'lucide-react'
import { Input, Button, Autocomplete } from '@/components/common'
import {
    SEXO_LISTA,
    MUNICIPIOS_CORDOBA,
    REGIMEN_LISTA,
    EPS_LISTA,
    TIPO_COTIZANTE_LISTA
} from '@/types/back.types'
import { NuevoAfiliadoForm } from '../types'

interface NuevoAfiliadoFormSectionProps {
    nuevoAfiliado: NuevoAfiliadoForm
    setNuevoAfiliado: React.Dispatch<React.SetStateAction<NuevoAfiliadoForm>>
    searchError: string
    handleCrearAfiliado: () => void
    creandoAfiliado: boolean
}

export function NuevoAfiliadoFormSection({
    nuevoAfiliado,
    setNuevoAfiliado,
    searchError,
    handleCrearAfiliado,
    creandoAfiliado
}: NuevoAfiliadoFormSectionProps) {
    return (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={18} className="text-amber-600" />
                <p className="text-sm font-medium text-amber-800">
                    Afiliado no encontrado. Complete los datos para crearlo:
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Documento *
                    </label>
                    <select
                        value={nuevoAfiliado.tipoId}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNuevoAfiliado(prev => ({ ...prev, tipoId: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                    >
                        <option value="CC">Cédula de Ciudadanía</option>
                        <option value="TI">Tarjeta de Identidad</option>
                        <option value="CE">Cédula de Extranjería</option>
                        <option value="PA">Pasaporte</option>
                        <option value="RC">Registro Civil</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Número de Documento *
                    </label>
                    <Input
                        value={nuevoAfiliado.id}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, id: e.target.value.replace(/\D/g, '') }))}
                        disabled
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombres *
                    </label>
                    <Input
                        value={nuevoAfiliado.nombres}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, nombres: e.target.value }))}
                        placeholder="Nombres completos"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Primer Apellido *
                    </label>
                    <Input
                        value={nuevoAfiliado.apellido1}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, apellido1: e.target.value }))}
                        placeholder="Primer apellido"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Segundo Apellido
                    </label>
                    <Input
                        value={nuevoAfiliado.apellido2}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, apellido2: e.target.value }))}
                        placeholder="Segundo apellido (opcional)"
                    />
                </div>

                {/* Sexo */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sexo <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={nuevoAfiliado.sexo}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNuevoAfiliado(prev => ({ ...prev, sexo: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] text-sm"
                    >
                        <option value="">Seleccionar...</option>
                        {SEXO_LISTA.map((s: { value: string; label: string }) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </div>

                {/* Fecha Nacimiento */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha de Nacimiento <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        value={nuevoAfiliado.fechaNacimiento}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, fechaNacimiento: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] text-sm"
                    />
                </div>

                {/* Teléfono */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Teléfono <span className="text-red-500">*</span>
                    </label>
                    <Input
                        value={nuevoAfiliado.telefono}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, telefono: e.target.value }))}
                        placeholder="Número de contacto"
                    />
                </div>

                {/* Dirección - campo completo */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dirección
                    </label>
                    <Input
                        value={nuevoAfiliado.direccion}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoAfiliado(prev => ({ ...prev, direccion: e.target.value }))}
                        placeholder="Dirección de residencia"
                    />
                </div>

                {/* Municipio - Autocomplete */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Municipio <span className="text-red-500">*</span>
                    </label>
                    <Autocomplete
                        value={nuevoAfiliado.municipioNombre}
                        onChange={(val: string) => {
                            const municipio = MUNICIPIOS_CORDOBA.find((m: { codigo: string; nombre: string; departamento: string }) => m.nombre === val)
                            setNuevoAfiliado(prev => ({
                                ...prev,
                                municipioNombre: val,
                                municipioCodigo: municipio?.codigo || '',
                                departamento: municipio?.departamento || '23',
                            }))
                        }}
                        options={MUNICIPIOS_CORDOBA.map((m: { codigo: string; nombre: string; departamento: string }) => m.nombre)}
                        placeholder="Buscar municipio..."
                        allowFreeText={false}
                    />
                </div>

                {/* Régimen */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Régimen <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={nuevoAfiliado.regimen}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNuevoAfiliado(prev => ({ ...prev, regimen: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] text-sm"
                    >
                        <option value="">Seleccionar...</option>
                        {REGIMEN_LISTA.map((r: { value: string; label: string }) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </div>

                {/* EPS */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        EPS <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={nuevoAfiliado.eps}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNuevoAfiliado(prev => ({ ...prev, eps: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] text-sm"
                    >
                        <option value="">Seleccionar...</option>
                        {EPS_LISTA.map((eps: string) => (
                            <option key={eps} value={eps}>{eps}</option>
                        ))}
                    </select>
                </div>

                {/* Tipo Cotizante */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo Cotizante <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={nuevoAfiliado.tipoCotizante}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNuevoAfiliado(prev => ({ ...prev, tipoCotizante: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] text-sm"
                    >
                        <option value="">Seleccionar...</option>
                        {TIPO_COTIZANTE_LISTA.map((t: { value: string; label: string }) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {searchError && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                    {searchError}
                </div>
            )}

            <div className="mt-4 flex justify-end">
                <Button
                    onClick={handleCrearAfiliado}
                    isLoading={creandoAfiliado}
                    leftIcon={<Plus size={18} />}
                >
                    Crear y continuar
                </Button>
            </div>
        </div>
    )
}
