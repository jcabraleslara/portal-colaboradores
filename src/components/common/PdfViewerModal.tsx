import { useEffect } from 'react'
import { X, ExternalLink, Download } from 'lucide-react'

interface PdfViewerModalProps {
    url: string
    title?: string
    onClose: () => void
}

export function PdfViewerModal({ url, title, onClose }: PdfViewerModalProps) {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [onClose])

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-medium text-gray-900 truncate flex-1 pr-4 max-w-3xl">
                        {title || 'Visor de Archivo'}
                    </h3>
                    <div className="flex items-center gap-2">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Abrir en nueva pestaña"
                        >
                            <ExternalLink size={20} />
                        </a>
                        <a
                            href={url}
                            download
                            className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Descargar"
                        >
                            <Download size={20} />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                            title="Cerrar"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-gray-100 relative group">
                    <iframe
                        src={url}
                        className="w-full h-full"
                        title="PDF Viewer"
                    />
                </div>
            </div>
        </div>
    )
}
