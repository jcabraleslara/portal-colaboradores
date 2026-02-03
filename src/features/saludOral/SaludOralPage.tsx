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

// Icono de muela/diente personalizado
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
        <path d="M4.2 10c-.6 0-1.2.5-1.2 1.1v2.7c0 4.1 2.3 8 6 9.6.9.4 2 .4 2.9 0 3.8-1.7 6.1-5.5 6.1-9.6v-2.7c0-.6-.5-1.1-1.2-1.1H16V7c0-2.9-2.4-5.3-5.3-5.3h-.4C7.4 1.7 5 4.1 5 7v3h-.8z" />
        <path d="M10 2c0 3 1.5 5 4 5" />
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
