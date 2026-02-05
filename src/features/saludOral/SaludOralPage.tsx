/**
 * Página Principal de Salud Oral
 * Contiene tabs para Registro de Caso e Histórico
 */

import { useState } from 'react'
import { PlusCircle, History } from 'lucide-react'
import { RegistroCasoTab } from './components/RegistroCasoTab'
import { HistoricoTab } from './components/HistoricoTab'
import type { OdRegistro } from '@/types/saludOral.types'

type TabId = 'registro' | 'historico'

interface Tab {
    id: TabId
    label: string
    icon: React.ReactNode
}

const TABS: Tab[] = [
    { id: 'registro', label: 'Registro de Caso', icon: <PlusCircle size={18} /> },
    { id: 'historico', label: 'Histórico', icon: <History size={18} /> },
]

// Icono de muela con raíces (igual al del Sidebar)
const ToothIcon = ({ size = 28, className }: { size?: number, className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        {/* Corona de la muela */}
        <path d="M12 2C8.5 2 5 4.5 5 8c0 2 1 3.5 1 5.5 0 1-.5 2-.5 3.5 0 2 1.5 3 2.5 3s1.5-1 2-3c.3-1.2.5-2 2-2s1.7.8 2 2c.5 2 1 3 2 3s2.5-1 2.5-3c0-1.5-.5-2.5-.5-3.5 0-2 1-3.5 1-5.5 0-3.5-3.5-6-7-6z" />
        {/* Surcos de la corona */}
        <path d="M9 6c0 1.5 1.5 2.5 3 2.5s3-1 3-2.5" />
    </svg>
)

export default function SaludOralPage() {
    const [activeTab, setActiveTab] = useState<TabId>('registro')
    const [recordToEdit, setRecordToEdit] = useState<OdRegistro | undefined>(undefined)

    const handleEdit = (record: OdRegistro) => {
        setRecordToEdit(record)
        setActiveTab('registro')
    }

    const handleSuccess = () => {
        setRecordToEdit(undefined)
        setActiveTab('historico')
    }

    const handleCancel = () => {
        setRecordToEdit(undefined)
        setActiveTab('historico')
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg shadow-primary-500/30">
                        <ToothIcon className="text-white" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Salud Oral</h1>
                        <p className="text-slate-500">Registro y gestión de atenciones odontológicas</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                {/* Tab Headers */}
                <div className="border-b border-slate-200">
                    <nav className="flex" role="tablist">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                role="tab"
                                aria-selected={activeTab === tab.id}
                                onClick={() => {
                                    if (activeTab === 'registro' && recordToEdit) {
                                        // If switching away from edit, maybe confirm? 
                                        // For now just allow switch but keep state or clear?
                                        // Let's clear state to avoid confusion if they come back
                                        setRecordToEdit(undefined)
                                    }
                                    setActiveTab(tab.id)
                                }}
                                className={`
                                    flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-all
                                    border-b-2 -mb-px
                                    ${activeTab === tab.id
                                        ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }
                                `}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {activeTab === 'registro' && (
                        <RegistroCasoTab
                            initialData={recordToEdit}
                            onSuccess={handleSuccess}
                            onCancel={handleCancel}
                        />
                    )}
                    {activeTab === 'historico' && (
                        <HistoricoTab onEdit={handleEdit} />
                    )}
                </div>
            </div>
        </div>
    )
}
