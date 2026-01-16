/**
 * Página Placeholder para módulos en planeación
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { Construction } from 'lucide-react'
import { Card } from '@/components/common'

interface PlaceholderPageProps {
    moduleName: string
}

export function PlaceholderPage({ moduleName }: PlaceholderPageProps) {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="max-w-md text-center" padding="lg">
                <div className="p-4 bg-gray-100 rounded-full inline-block mx-auto mb-4">
                    <Construction size={48} className="text-gray-400" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                    {moduleName}
                </h2>
                <p className="text-gray-500 mb-4">
                    Este módulo está actualmente en planeación y estará disponible próximamente.
                </p>
                <div className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                    En desarrollo
                </div>
            </Card>
        </div>
    )
}

export default PlaceholderPage
