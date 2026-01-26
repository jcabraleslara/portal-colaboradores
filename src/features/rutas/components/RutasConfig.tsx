import { useState, useEffect } from 'react'
import { Plus, Trash, Save, X, Mail } from 'lucide-react'
import { Button, Card, Input } from '@/components/common'
import { rutasService, RutaEmailConfig } from '../services/rutas.service'
import { RUTAS_CONFIG } from '@/types/back.types'
import { toast } from 'sonner' // Assuming sonner is used for toasts based on context

export function RutasConfig() {
    const [configs, setConfigs] = useState<RutaEmailConfig[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [tempConfig, setTempConfig] = useState<Partial<RutaEmailConfig>>({})

    // Lista plana de rutas del sistema
    const rutasSistema = RUTAS_CONFIG.map(r => r.ruta)

    const cargarConfigs = async () => {
        setLoading(true)
        const result = await rutasService.obtenerConfigEmails()
        if (result.success && result.data) {
            setConfigs(result.data)
        }
        setLoading(false)
    }

    useEffect(() => {
        cargarConfigs()
    }, [])

    const handleNuevo = () => {
        setTempConfig({ activo: true, ruta: rutasSistema[0] }) // Default first route
        setEditingId(-1) // -1 means new
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
        if (!tempConfig.email || !tempConfig.ruta) return

        try {
            const result = await rutasService.guardarConfigEmail(tempConfig)
            if (result.success) {
                toast.success('Configuración guardada')
                setEditingId(null)
                setTempConfig({})
                cargarConfigs()
            } else {
                toast.error('Error al guardar: ' + result.error)
            }
        } catch (e) {
            toast.error('Error inesperado')
        }
    }

    const handleEliminar = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar esta configuración?')) return

        const result = await rutasService.eliminarConfigEmail(id)
        if (result.success) {
            toast.success('Configuración eliminada')
            cargarConfigs()
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
                                    <th className="px-4 py-2 font-semibold text-gray-600 text-sm">Ruta</th>
                                    <th className="px-4 py-2 font-semibold text-gray-600 text-sm">Email Destino</th>
                                    <th className="px-4 py-2 font-semibold text-gray-600 text-sm">Estado</th>
                                    <th className="px-4 py-2 font-semibold text-gray-600 text-sm w-24">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {/* Fila de Edición (Nueva o Existente) */}
                                {editingId !== null && (
                                    <tr className="bg-blue-50">
                                        <td className="px-4 py-2">
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
                                        <td className="px-4 py-2">
                                            <Input
                                                value={tempConfig.email || ''}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempConfig({ ...tempConfig, email: e.target.value })}
                                                placeholder="correo@ejemplo.com"
                                                className="h-8 text-sm"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <label className="flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={tempConfig.activo}
                                                    onChange={e => setTempConfig({ ...tempConfig, activo: e.target.checked })}
                                                />
                                                Activo
                                            </label>
                                        </td>
                                        <td className="px-4 py-2 flex gap-1">
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
                                            <td className="px-4 py-3 text-sm">{config.ruta}</td>
                                            <td className="px-4 py-3 text-sm flex items-center gap-2">
                                                <Mail size={14} className="text-gray-400" />
                                                {config.email}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${config.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {config.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
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
