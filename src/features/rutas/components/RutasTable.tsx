import {
    ChevronLeft,
    ChevronRight,
    Search,
    AlertCircle
} from 'lucide-react'
import { Button, Card, LoadingOverlay } from '@/components/common'
import {
    BackRadicacionExtendido,
    ESTADO_COLORES,
    RUTA_COLORES
} from '@/types/back.types'

interface RutasTableProps {
    casos: BackRadicacionExtendido[]
    total: number
    paginaActual: number
    cargando: boolean
    error: string | null
    onPaginaAnterior: () => void
    onPaginaSiguiente: () => void
    onSeleccionarCaso: (caso: BackRadicacionExtendido, index: number) => void
    onSort: (field: string) => void
    sortField?: string
    sortOrder?: 'asc' | 'desc'
}

export function RutasTable({
    casos,
    total,
    paginaActual,
    cargando,
    error,
    onPaginaAnterior,
    onPaginaSiguiente,
    onSeleccionarCaso,
    onSort,
    sortField,
    sortOrder
}: RutasTableProps) {
    const totalPaginas = Math.ceil(total / 50) // ITEMS_POR_PAGINA hardcoded 50 por ahora

    const SortIndicator = ({ field }: { field: string }) => {
        if (sortField !== field) return null
        return <span className="text-[var(--color-primary)] ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
    }

    const HeaderCell = ({ field, label, width }: { field: string, label: string, width?: string }) => (
        <th
            className={`text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${width}`}
            onClick={() => onSort(field)}
        >
            <div className="flex items-center">
                {label}
                <SortIndicator field={field} />
            </div>
        </th>
    )

    return (
        <LoadingOverlay isLoading={cargando} label="Cargando rutas...">
            <Card>
                <Card.Body className="p-0">
                    {error ? (
                        <div className="p-8 text-center">
                            <AlertCircle className="mx-auto mb-4 text-red-400" size={48} />
                            <p className="text-red-600">{error}</p>
                        </div>
                    ) : casos.length === 0 ? (
                        <div className="p-12 text-center">
                            <Search className="mx-auto mb-4 text-gray-300" size={48} />
                            <p className="text-gray-500">No se encontraron solicitudes con los filtros seleccionados</p>
                        </div>
                    ) : (
                        <>
                            {/* Header paginación */}
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                <p className="text-sm text-gray-600">
                                    Mostrando <span className="font-semibold">{casos.length}</span> de <span className="font-semibold">{total}</span>
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onPaginaAnterior}
                                        disabled={paginaActual === 0}
                                        leftIcon={<ChevronLeft size={16} />}
                                    >
                                        Anterior
                                    </Button>
                                    <span className="text-sm text-gray-600">
                                        Pág. {paginaActual + 1} de {totalPaginas || 1}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onPaginaSiguiente}
                                        disabled={paginaActual >= totalPaginas - 1}
                                        rightIcon={<ChevronRight size={16} />}
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            </div>

                            {/* Tabla */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <HeaderCell field="radicado" label="Radicado" width="w-32" />
                                            <HeaderCell field="id" label="Paciente" />
                                            <HeaderCell field="ruta" label="Ruta" />
                                            <HeaderCell field="estado_radicado" label="Estado" />
                                            <HeaderCell field="created_at" label="Fecha" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {casos.map((caso, index) => {
                                            const estadoColor = ESTADO_COLORES[caso.estadoRadicado] || ESTADO_COLORES['Pendiente']
                                            const rutaColor = caso.ruta ? RUTA_COLORES[caso.ruta] : undefined

                                            return (
                                                <tr
                                                    key={caso.radicado}
                                                    className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                                                    onClick={() => onSeleccionarCaso(caso, index)}
                                                >
                                                    <td className="px-4 py-3">
                                                        <span className="font-mono font-semibold text-[var(--color-primary)]">
                                                            {caso.radicado}
                                                        </span>
                                                        {caso.soportes && caso.soportes.length > 0 && (
                                                            <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                                PDF
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-gray-900">
                                                                {caso.paciente?.nombres} {caso.paciente?.apellido1}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {caso.paciente?.tipoId} {caso.id}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {caso.ruta ? (
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${rutaColor?.bg} ${rutaColor?.text}`}>
                                                                {caso.ruta}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${estadoColor?.bg} ${estadoColor?.text} border ${estadoColor?.border}`}>
                                                            {caso.estadoRadicado}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">
                                                        {new Date(caso.createdAt).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </Card.Body>
            </Card>
        </LoadingOverlay>
    )
}
