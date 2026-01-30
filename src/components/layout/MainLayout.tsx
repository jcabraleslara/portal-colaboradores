/**
 * Layout Principal - Diseño Premium
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function MainLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(false)

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)
    const closeSidebar = () => setIsSidebarOpen(false)
    const toggleCollapse = () => setIsCollapsed(!isCollapsed)

    return (
        <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
            {/* Patrón de fondo sutil */}
            <div className="fixed inset-0 bg-pattern pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(0,149,235,0.03) 0%, rgba(243,88,93,0.02) 50%, rgba(133,197,76,0.02) 100%)' }} />

            {/* Header fijo */}
            <Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />

            {/* Sidebar */}
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={closeSidebar}
                isCollapsed={isCollapsed}
                toggleCollapse={toggleCollapse}
            />

            {/* Contenido principal */}
            <main
                className={`
                    relative pt-16 min-h-screen transition-all duration-300 ease-out
                    ${isCollapsed ? 'lg:pl-20' : 'lg:pl-72'}
                `}
            >
                <div className="p-4 md:p-6 lg:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}

export default MainLayout
