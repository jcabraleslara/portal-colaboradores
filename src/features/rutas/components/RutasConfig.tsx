import { useState, useEffect } from 'react'
import { Plus, Trash, Save, X, Mail, Copy, Building2, MapPin } from 'lucide-react'
import { Button, Card, MultiSelector } from '@/components/common'
import { rutasService, RutaEmailConfig, EPS_DISPONIBLES } from '../services/rutas.service'
import { RUTAS_CONFIG } from '@/types/back.types'
import { toast } from 'sonner'

export function RutasConfig() {
    const [configs, setConfigs] = useState<RutaEmailConfig[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [tempConfig, setTempConfig] = useState<Partial<RutaEmailConfig>>({})
    const [provinciasOptions, setProvinciasOptions] = useState<string[]>([])

    // Lista plana de rutas del sistema
    const rutasSistema = RUTAS_CONFIG.map(r => r.ruta)

    const cargarDatos = async () => {
        setLoading(true)
        try {
            const [configsResult, provinciasResult] = await Promise.all([
                rutasService.obtenerConfigEmails(),
                rutasService.obtenerProvincias()
            ])

            if (configsResult.success && configsResult.data) {
                setConfigs(configsResult.data)
            }

            if (provinciasResult.success && provinciasResult.data) {
                setProvinciasOptions(provinciasResult.data)
            }
        } catch (error) {
            toast.error('Error cargando datos')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        cargarDatos()
    }, [])

    const handleNuevo = () => {
        setTempConfig({ estado: true, ruta: rutasSistema[0], eps: 'TODAS', provincia: [] })
        setEditingId('new')
    }

    const handleEditar = (config: RutaEmailConfig) => {
        setTempConfig({ ...config })
        setEditingId(config.id)
    }

    const handleCancelar = () => {
        setEditingId(null)
        setTempConfig({})
    }

    const handleGuardar = async () => {
        if (!tempConfig.destinatarios || !tempConfig.ruta) {
            toast.error('Ruta y destinatarios son obligatorios')
            return
        }

        try {
            const configToSave = editingId === 'new'
                ? { ...tempConfig, id: undefined }
                : tempConfig
            const result = await rutasService.guardarConfigEmail(configToSave)
            if (result.success) {
                toast.success('Configuración guardada')
                setEditingId(null)
                setTempConfig({})
                cargarDatos()
            } else {
                toast.error('Error al guardar: ' + result.error)
            }
        } catch (e) {
            toast.error('Error inesperado')
        }
    }

    const handleEliminar = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta configuración?')) return

        const result = await rutasService.eliminarConfigEmail(id)
        if (result.success) {
            toast.success('Configuración eliminada')
            cargarDatos()
        } else {
            toast.error('Error al eliminar')
        }
    }

    return (
        <Card>
            <Card.Header>
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Configuración de Correos por Ruta</h3>
                        <p className="text-sm text-gray-500">Define a qué correos se notifican las novedades de cada ruta</p>
                    </div>
                    <Button onClick={handleNuevo} leftIcon={<Plus size={16} />} size="sm">
                        Nueva Configuración
                    </Button>
                </div>
            </Card.Header>
            <Card.Body>
                {loading ? (
                    <div className="flex justify-center p-8">Cargando...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 text-left">
                                    <th className="px-3 py-2 font-semibold text-gray-600 text-sm">Ruta</th>
                                    <th className="px-3 py-2 font-semibold text-gray-600 text-sm">EPS</th>
                                    <th className="px-3 py-2 font-semibold text-gray-600 text-sm w-[200px]">Provincia</th>
                                    <th className="px-3 py-2 font-semibold text-gray-600 text-sm">Destinatarios</th>
                                    <th className="px-3 py-2 font-semibold text-gray-600 text-sm">Copias (CC)</th>
                                    <th className="px-3 py-2 font-semibold text-gray-600 text-sm">Estado</th>
                                    <th className="px-3 py-2 font-semibold text-gray-600 text-sm w-24">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {/* Fila de Edición (Nueva o Existente) */}
                                {editingId !== null && (
                                    <tr className="bg-blue-50">
                                        <td className="px-3 py-2 align-top">
                                            <select
                                                className="w-full p-1.5 border rounded text-sm"
                                                value={tempConfig.ruta || ''}
                                                onChange={e => setTempConfig({ ...tempConfig, ruta: e.target.value })}
                                            >
                                                {rutasSistema.map(ruta => (
                                                    <option key={ruta} value={ruta}>{ruta}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <select
                                                className="w-full p-1.5 border rounded text-sm"
                                                value={tempConfig.eps || 'TODAS'}
                                                onChange={e => setTempConfig({ ...tempConfig, eps: e.target.value })}
                                            >
                                                {EPS_DISPONIBLES.map(eps => (
                                                    <option key={eps} value={eps}>{eps}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <div className="min-w-[200px]">
                                                <MultiSelector
                                                    value={tempConfig.provincia || []}
                                                    onChange={val => setTempConfig({ ...tempConfig, provincia: val })}
                                                    options={provinciasOptions}
                                                    placeholder="Todas las provincias"
                                                />
                                                <p className="text-[10px] text-gray-500 mt-1">Dejar vacío para todas</p>
                                            </div>
                                        </td>

                                        <td className="px-3 py-2 align-top">
                                            <textarea
                                                value={tempConfig.destinatarios || ''}
                                                onChange={(e) => setTempConfig({ ...tempConfig, destinatarios: e.target.value })}
                                                placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
                                                className="w-full p-2 border rounded text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] focus:border-[var(--color-primary)]"
                                            />
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <textarea
                                                value={tempConfig.copias || ''}
                                                onChange={(e) => setTempConfig({ ...tempConfig, copias: e.target.value })}
                                                placeholder="copia1@ejemplo.com, copia2@ejemplo.com"
                                                className="w-full p-2 border rounded text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] focus:border-[var(--color-primary)]"
                                            />
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <label className="flex items-center gap-2 text-sm mt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={tempConfig.estado}
                                                    onChange={e => setTempConfig({ ...tempConfig, estado: e.target.checked })}
                                                />
                                                Activo
                                            </label>
                                        </td>
                                        <td className="px-3 py-2 flex gap-1 align-top">
                                            <Button size="sm" variant="ghost" onClick={handleGuardar} className="text-green-600 p-1">
                                                <Save size={16} />
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={handleCancelar} className="text-gray-500 p-1">
                                                <X size={16} />
                                            </Button>
                                        </td>
                                    </tr>
                                )}

                                {/* Lista */}
                                {configs.map(config => {
                                    if (config.id === editingId) return null // Hide if editing

                                    return (
                                        <tr key={config.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-3 text-sm">{config.ruta}</td>
                                            <td className="px-3 py-3 text-sm">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${config.eps === 'TODAS' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    <Building2 size={12} />
                                                    {config.eps}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-sm">
                                                {config.provincia && config.provincia.length > 0 ? (
                                                    <div className="flex items-start gap-1 max-w-[200px]">
                                                        <MapPin size={14} className="text-gray-400 mt-1 flex-shrink-0" />
                                                        <span className="text-xs text-gray-600 whitespace-normal block">
                                                            {config.provincia.slice(0, 3).join(', ')}
                                                            {config.provincia.length > 3 && (
                                                                <span className="text-gray-400 ml-1">
                                                                    +{config.provincia.length - 3} más
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">Todas</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Mail size={14} className="text-gray-400 flex-shrink-0" />
                                                    <span className="truncate max-w-[200px]" title={config.destinatarios}>
                                                        {config.destinatarios}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-sm">
                                                {config.copias ? (
                                                    <div className="flex items-center gap-2">
                                                        <Copy size={14} className="text-gray-400 flex-shrink-0" />
                                                        <span className="truncate max-w-[150px] text-gray-500" title={config.copias}>
                                                            {config.copias}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-sm">
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${config.estado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {config.estado ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleEditar(config)}
                                                        className="text-blue-600 h-7 w-7 p-0"
                                                    >
                                                        <span className="text-xs">Edit</span>
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleEliminar(config.id)}
                                                        className="text-red-600 h-7 w-7 p-0"
                                                    >
                                                        <Trash size={14} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        {configs.length === 0 && editingId === null && (
                            <div className="text-center py-6 text-gray-400 text-sm">
                                No hay configuraciones. Crea una nueva.
                            </div>
                        )}
                    </div>
                )}
            </Card.Body>
        </Card>
    )
}
