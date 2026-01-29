
import { useState } from 'react'
import { FileSpreadsheet, History } from 'lucide-react'
import { CitasImportForm, ImportHistoryTable } from './components'

export default function ImportarFuentesPage() {
    const [activeTab, setActiveTab] = useState<'citas' | 'history'>('citas')

    return (
        <div className="container mx-auto p-6 max-w-7xl animate-in fade-in duration-500">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                    Importación de Fuentes
                </h1>
                <p className="text-slate-500 mt-1">
                    Carga masiva de datos para actualización de bases de datos.
                </p>
            </div>

            {/* Tabs / Navigation inside module */}
            <div className="flex gap-4 mb-6 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('citas')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${activeTab === 'citas'
                        ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                >
                    <FileSpreadsheet size={18} />
                    Carga de Archivos
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${activeTab === 'history'
                        ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                >
                    <History size={18} />
                    Historial de Importaciones
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                {activeTab === 'citas' && <CitasImportForm />}
                {activeTab === 'history' && <ImportHistoryTable />}
            </div>
        </div>
    )
}
