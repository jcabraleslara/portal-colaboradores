/**
 * Página de Consulta de Tablas (CUPS, Medicamentos, CIE-10)
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState } from 'react'
import { FileText, Pill, Stethoscope } from 'lucide-react'
import { CupsTab } from './components/CupsTab'
import { MedicamentosTab } from './components/MedicamentosTab'
import { Cie10Tab } from './components/Cie10Tab'

type TabId = 'cups' | 'medicamentos' | 'cie10'

const TABS = [
    { id: 'cups' as const, label: 'CUPS', icon: FileText },
    { id: 'medicamentos' as const, label: 'Medicamentos', icon: Pill },
    { id: 'cie10' as const, label: 'CIE-10', icon: Stethoscope },
]

export function ConsultarCupsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('cups')

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                    Consultar Tablas
                </h1>
                <p className="text-gray-500 mt-1">
                    Buscar procedimientos, medicamentos y diagnósticos
                </p>
            </div>

            {/* Pestañas */}
            <div className="border-b border-gray-200 dark:border-white/10">
                <nav className="flex gap-1 -mb-px" aria-label="Pestañas">
                    {TABS.map(({ id, label, icon: Icon }) => {
                        const isActive = activeTab === id
                        return (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                    isActive
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 hover:border-gray-300 dark:hover:border-white/20'
                                }`}
                                aria-selected={isActive}
                                role="tab"
                            >
                                <Icon size={18} />
                                {label}
                            </button>
                        )
                    })}
                </nav>
            </div>

            {/* Contenido de la pestaña activa */}
            {activeTab === 'cups' && <CupsTab />}
            {activeTab === 'medicamentos' && <MedicamentosTab />}
            {activeTab === 'cie10' && <Cie10Tab />}
        </div>
    )
}

export default ConsultarCupsPage
