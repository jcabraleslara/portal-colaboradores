/**
 * Página de Gestión de Recobros
 * Portal de Colaboradores GESTAR SALUD IPS
 *
 * Módulo para radicación y gestión de solicitudes de recobro a EPS
 * - Pestaña Radicación: disponible para todos los roles
 * - Pestaña Gestión: solo admin/superadmin/gerencia/auditor
 */

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { RadicacionRecobrosView } from './RadicacionRecobrosView'
import { GestionRecobrosView } from './GestionRecobrosView'

type TabView = 'radicacion' | 'gestion'

export function RecobrosPage() {
    const { user } = useAuth()

    // Roles que pueden ver la pestaña de gestión
    const puedeGestionar = ['superadmin', 'admin', 'gerencia', 'auditor'].includes(user?.rol || '')

    // Estado de la vista actual
    const [vistaActual, setVistaActual] = useState<TabView>('radicacion')

    // Redireccionar si está en gestión y no tiene permisos
    useEffect(() => {
        if (vistaActual === 'gestion' && !puedeGestionar) {
            setVistaActual('radicacion')
        }
    }, [vistaActual, puedeGestionar])

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
                        <RefreshCw className="text-[var(--color-primary)]" size={28} />
                        Gestión de Recobros
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Radica y gestiona solicitudes de recobro a EPS por procedimientos realizados
                    </p>
                </div>
            </div>

            {/* Tabs de Navegación */}
            <div className="border-b border-gray-200">
                <div className="flex gap-1">
                    <button
                        onClick={() => setVistaActual('radicacion')}
                        className={`
                            px-6 py-3 text-sm font-medium border-b-2 transition-colors
                            ${vistaActual === 'radicacion'
                                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }
                        `}
                    >
                        Radicación de Recobros
                    </button>
                    {puedeGestionar && (
                        <button
                            onClick={() => setVistaActual('gestion')}
                            className={`
                                px-6 py-3 text-sm font-medium border-b-2 transition-colors
                                ${vistaActual === 'gestion'
                                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }
                            `}
                        >
                            Gestión de Recobros
                        </button>
                    )}
                </div>
            </div>

            {/* Contenido */}
            {vistaActual === 'radicacion' && <RadicacionRecobrosView />}
            {vistaActual === 'gestion' && puedeGestionar && <GestionRecobrosView />}
        </div>
    )
}

export default RecobrosPage
