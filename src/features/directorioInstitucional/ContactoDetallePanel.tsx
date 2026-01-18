/**
 * Panel de Detalle de Contacto
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Panel lateral para ver/editar contactos con:
 * - Visualización de todos los campos
 * - Edición inline de campos
 * - Visor de hoja de vida (PDF)
 * - Visor de firma (imagen)
 * - Upload de archivos
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
    X,
    Save,
    User,
    Mail,
    Phone,
    Building2,
    Briefcase,
    MapPin,
    Calendar,
    FileText,
    PenTool,
    Upload,
    ExternalLink,
    CheckCircle,
    AlertCircle,
    Trash2,
    AlertTriangle,
    Eye,
    Download,
    Globe,
} from 'lucide-react'
import { Button } from '@/components/common'
import { contactosService, obtenerNombreCompleto } from '@/services/contactos.service'
import {
    Contacto,
    ContactoUpdate,
    TRATAMIENTO_LISTA,
} from '@/types/contactos.types'

interface ContactoDetallePanelProps {
    contacto: Contacto
    onClose: () => void
    onGuardar: () => void
}

export function ContactoDetallePanel({
    contacto,
    onClose,
    onGuardar,
}: ContactoDetallePanelProps) {
    // ============================================
    // ESTADO
    // ============================================

    // Campos editables
    const [formData, setFormData] = useState<ContactoUpdate>({
        tratamiento: contacto.tratamiento,
        primer_nombre: contacto.primer_nombre,
        segundo_nombre: contacto.segundo_nombre,
        apellidos: contacto.apellidos,
        identificacion: contacto.identificacion,
        email_personal: contacto.email_personal,
        email_institucional: contacto.email_institucional,
        empresa: contacto.empresa,
        puesto: contacto.puesto,
        celular_1: contacto.celular_1,
        celular_2: contacto.celular_2,
        fecha_nacimiento: contacto.fecha_nacimiento,
        direccion: contacto.direccion,
        ciudad: contacto.ciudad,
        departamento: contacto.departamento,
        pais: contacto.pais,
        notas: contacto.notas,
        area: contacto.area,
    })

    // URLs de archivos (pueden cambiar al subir nuevos)
    const [hojaVidaUrl, setHojaVidaUrl] = useState(contacto.hoja_vida_url)
    const [firmaUrl, setFirmaUrl] = useState(contacto.firma_url)

    // Estado de guardado
    const [guardando, setGuardando] = useState(false)
    const [guardadoExitoso, setGuardadoExitoso] = useState(false)
    const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

    // Estado de uploads
    const [subiendoHV, setSubiendoHV] = useState(false)
    const [subiendoFirma, setSubiendoFirma] = useState(false)

    // Modal de confirmación eliminar
    const [mostrarConfirmacionEliminar, setMostrarConfirmacionEliminar] = useState(false)
    const [eliminando, setEliminando] = useState(false)

    // Visor de archivos
    const [visorPdfAbierto, setVisorPdfAbierto] = useState(false)
    const [visorFirmaAbierto, setVisorFirmaAbierto] = useState(false)

    // Refs para inputs de archivos
    const inputHVRef = useRef<HTMLInputElement>(null)
    const inputFirmaRef = useRef<HTMLInputElement>(null)

    // ============================================
    // HANDLERS
    // ============================================

    const handleChange = useCallback((campo: keyof ContactoUpdate, valor: string | null) => {
        setFormData(prev => ({ ...prev, [campo]: valor }))
    }, [])

    const handleGuardar = useCallback(async () => {
        setGuardando(true)
        setErrorGuardado(null)
        setGuardadoExitoso(false)

        const result = await contactosService.actualizarContacto(contacto.id, formData)

        setGuardando(false)

        if (result.success) {
            setGuardadoExitoso(true)
            setTimeout(() => {
                onGuardar()
            }, 500)
        } else {
            setErrorGuardado(result.error || 'Error al guardar')
        }
    }, [contacto.id, formData, onGuardar])

    const handleEliminar = useCallback(async () => {
        setEliminando(true)
        const result = await contactosService.eliminarContacto(contacto.id)
        setEliminando(false)

        if (result.success) {
            onGuardar()
            onClose()
        } else {
            setErrorGuardado(result.error || 'Error al eliminar')
            setMostrarConfirmacionEliminar(false)
        }
    }, [contacto.id, onGuardar, onClose])

    const handleSubirHojaVida = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const archivo = e.target.files?.[0]
        if (!archivo) return

        setSubiendoHV(true)
        const result = await contactosService.subirHojaVida(archivo, contacto.id)
        setSubiendoHV(false)

        if (result.success && result.data) {
            setHojaVidaUrl(result.data)
        } else {
            setErrorGuardado(result.error || 'Error subiendo hoja de vida')
        }

        // Limpiar input
        if (inputHVRef.current) inputHVRef.current.value = ''
    }, [contacto.id])

    const handleSubirFirma = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const archivo = e.target.files?.[0]
        if (!archivo) return

        setSubiendoFirma(true)
        const result = await contactosService.subirFirma(archivo, contacto.id)
        setSubiendoFirma(false)

        if (result.success && result.data) {
            setFirmaUrl(result.data)
        } else {
            setErrorGuardado(result.error || 'Error subiendo firma')
        }

        // Limpiar input
        if (inputFirmaRef.current) inputFirmaRef.current.value = ''
    }, [contacto.id])

    // Cerrar con Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (visorPdfAbierto) {
                    setVisorPdfAbierto(false)
                } else if (visorFirmaAbierto) {
                    setVisorFirmaAbierto(false)
                } else if (mostrarConfirmacionEliminar) {
                    setMostrarConfirmacionEliminar(false)
                } else {
                    onClose()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose, visorPdfAbierto, visorFirmaAbierto, mostrarConfirmacionEliminar])

    // ============================================
    // RENDER
    // ============================================

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Panel lateral */}
            <div className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-white shadow-2xl animate-slide-in-right overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[var(--color-primary-50)] to-white">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--color-primary-700)]">
                                {obtenerNombreCompleto(contacto)}
                            </h2>
                            <div className="flex items-center gap-3 mt-2">
                                {contacto.puesto && (
                                    <span className="text-sm text-gray-600 flex items-center gap-1">
                                        <Briefcase size={14} />
                                        {contacto.puesto}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/80 transition-colors"
                        >
                            <X size={24} className="text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Contenido scrolleable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* ============================================ */}
                    {/* ARCHIVOS: HOJA DE VIDA Y FIRMA */}
                    {/* ============================================ */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Hoja de Vida */}
                        <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <FileText size={16} className="text-red-500" />
                                Hoja de Vida
                            </h3>
                            {hojaVidaUrl ? (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setVisorPdfAbierto(true)}
                                            leftIcon={<Eye size={14} />}
                                        >
                                            Ver
                                        </Button>
                                        <a
                                            href={hojaVidaUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                                        >
                                            <Download size={14} />
                                            Descargar
                                        </a>
                                    </div>
                                    <button
                                        onClick={() => inputHVRef.current?.click()}
                                        className="text-xs text-primary-600 hover:underline"
                                        disabled={subiendoHV}
                                    >
                                        {subiendoHV ? 'Subiendo...' : 'Cambiar archivo'}
                                    </button>
                                </div>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => inputHVRef.current?.click()}
                                    leftIcon={<Upload size={14} />}
                                    isLoading={subiendoHV}
                                >
                                    Subir PDF
                                </Button>
                            )}
                            <input
                                ref={inputHVRef}
                                type="file"
                                accept=".pdf"
                                className="hidden"
                                onChange={handleSubirHojaVida}
                            />
                        </div>

                        {/* Firma */}
                        <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <PenTool size={16} className="text-blue-500" />
                                Firma
                            </h3>
                            {firmaUrl ? (
                                <div className="space-y-2">
                                    <div
                                        className="w-full h-16 bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary-200"
                                        onClick={() => setVisorFirmaAbierto(true)}
                                    >
                                        <img
                                            src={firmaUrl}
                                            alt="Firma"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <button
                                        onClick={() => inputFirmaRef.current?.click()}
                                        className="text-xs text-primary-600 hover:underline"
                                        disabled={subiendoFirma}
                                    >
                                        {subiendoFirma ? 'Subiendo...' : 'Cambiar firma'}
                                    </button>
                                </div>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => inputFirmaRef.current?.click()}
                                    leftIcon={<Upload size={14} />}
                                    isLoading={subiendoFirma}
                                >
                                    Subir imagen
                                </Button>
                            )}
                            <input
                                ref={inputFirmaRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg"
                                className="hidden"
                                onChange={handleSubirFirma}
                            />
                        </div>
                    </div>

                    {/* ============================================ */}
                    {/* INFORMACIÓN PERSONAL */}
                    {/* ============================================ */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                            <User size={16} />
                            Información Personal
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Tratamiento */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Tratamiento</label>
                                <select
                                    value={formData.tratamiento || ''}
                                    onChange={(e) => handleChange('tratamiento', e.target.value || null)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                >
                                    {TRATAMIENTO_LISTA.map(t => (
                                        <option key={t} value={t}>{t || '(ninguno)'}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Identificación */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Identificación</label>
                                <input
                                    type="text"
                                    value={formData.identificacion || ''}
                                    onChange={(e) => handleChange('identificacion', e.target.value || null)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                    placeholder="Número de documento"
                                />
                            </div>

                            {/* Primer nombre */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Primer Nombre *</label>
                                <input
                                    type="text"
                                    value={formData.primer_nombre || ''}
                                    onChange={(e) => handleChange('primer_nombre', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                    required
                                />
                            </div>

                            {/* Segundo nombre */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Segundo Nombre</label>
                                <input
                                    type="text"
                                    value={formData.segundo_nombre || ''}
                                    onChange={(e) => handleChange('segundo_nombre', e.target.value || null)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                />
                            </div>

                            {/* Apellidos */}
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Apellidos *</label>
                                <input
                                    type="text"
                                    value={formData.apellidos || ''}
                                    onChange={(e) => handleChange('apellidos', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                    required
                                />
                            </div>

                            {/* Fecha nacimiento */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                    <Calendar size={12} className="inline mr-1" />
                                    Fecha de Nacimiento
                                </label>
                                <input
                                    type="date"
                                    value={formData.fecha_nacimiento || ''}
                                    onChange={(e) => handleChange('fecha_nacimiento', e.target.value || null)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                />
                            </div>


                        </div>
                    </div>

                    {/* ============================================ */}
                    {/* CONTACTO */}
                    {/* ============================================ */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                            <Phone size={16} />
                            Información de Contacto
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Celular 1 */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Celular Principal</label>
                                <input
                                    type="tel"
                                    value={formData.celular_1 || ''}
                                    onChange={(e) => handleChange('celular_1', e.target.value || null)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                    placeholder="+57 300 000 0000"
                                />
                            </div>

                            {/* Celular 2 */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Celular Secundario</label>
                                <input
                                    type="tel"
                                    value={formData.celular_2 || ''}
                                    onChange={(e) => handleChange('celular_2', e.target.value || null)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                />
                            </div>

                            {/* Email personal */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                    <Mail size={12} className="inline mr-1" />
                                    Email Personal
                                </label>
                                <input
                                    type="email"
                                    value={formData.email_personal || ''}
                                    onChange={(e) => handleChange('email_personal', e.target.value || null)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                    placeholder="correo@personal.com"
                                />
                            </div>

                            {/* Email institucional */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                    <Building2 size={12} className="inline mr-1" />
                                    Email Institucional
                                </label>
                                <input
                                    type="email"
                                    value={formData.email_institucional || ''}
                                    onChange={(e) => handleChange('email_institucional', e.target.value || null)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                    placeholder="correo@empresa.com"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ============================================ */}
                    {/* UBICACIÓN */}
                    {/* ============================================ */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                            <MapPin size={16} />
                            Ubicación
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Dirección */}
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Dirección</label>
                                <input
                                    type="text"
                                    value={formData.direccion || ''}
                                    onChange={(e) => handleChange('direccion', e.target.value || null)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                    placeholder="Calle, número, barrio..."
                                />
                            </div>

                            {/* Ciudad */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Ciudad</label>
                                <input
                                    type="text"
                                    value={formData.ciudad || ''}
                                    onChange={(e) => handleChange('ciudad', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                />
                            </div>

                            {/* Departamento */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Departamento</label>
                                <input
                                    type="text"
                                    value={formData.departamento || ''}
                                    onChange={(e) => handleChange('departamento', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                />
                            </div>

                            {/* País */}
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                    <Globe size={12} className="inline mr-1" />
                                    País
                                </label>
                                <input
                                    type="text"
                                    value={formData.pais || ''}
                                    onChange={(e) => handleChange('pais', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ============================================ */}
                    {/* TRABAJO */}
                    {/* ============================================ */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                            <Briefcase size={16} />
                            Información Laboral
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Empresa */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Empresa</label>
                                <input
                                    type="text"
                                    value={formData.empresa || ''}
                                    onChange={(e) => handleChange('empresa', e.target.value || null)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                />
                            </div>

                            {/* Puesto */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Puesto / Cargo</label>
                                <input
                                    type="text"
                                    value={formData.puesto || ''}
                                    onChange={(e) => handleChange('puesto', e.target.value || null)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                />
                            </div>

                            {/* Área */}
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Área / Departamento</label>
                                <input
                                    type="text"
                                    value={formData.area || ''}
                                    onChange={(e) => handleChange('area', e.target.value || null)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ============================================ */}
                    {/* NOTAS */}
                    {/* ============================================ */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-600">Notas</h3>
                        <textarea
                            value={formData.notas || ''}
                            onChange={(e) => handleChange('notas', e.target.value || null)}
                            rows={4}
                            placeholder="Notas adicionales sobre este contacto..."
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] resize-y min-h-[100px]"
                        />
                    </div>

                    {/* Mensajes de estado */}
                    {errorGuardado && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            <AlertCircle size={18} />
                            {errorGuardado}
                        </div>
                    )}

                    {guardadoExitoso && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 animate-fade-in">
                            <CheckCircle size={18} />
                            Cambios guardados exitosamente
                        </div>
                    )}

                    {/* Sync IDs (readonly, info) */}
                    {(contacto.google_contact_id || contacto.outlook_contact_id) && (
                        <div className="text-xs text-gray-400 pt-2 border-t border-gray-100 space-y-1">
                            {contacto.google_contact_id && (
                                <p>Google ID: {contacto.google_contact_id}</p>
                            )}
                            {contacto.outlook_contact_id && (
                                <p>Outlook ID: {contacto.outlook_contact_id}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer con botones de acción */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setMostrarConfirmacionEliminar(true)}
                            leftIcon={<Trash2 size={18} />}
                        >
                            Eliminar
                        </Button>
                    </div>
                    <Button
                        onClick={handleGuardar}
                        isLoading={guardando}
                        leftIcon={<Save size={18} />}
                    >
                        Guardar Cambios
                    </Button>
                </div>
            </div>

            {/* ============================================ */}
            {/* MODAL CONFIRMACIÓN ELIMINAR */}
            {/* ============================================ */}
            {mostrarConfirmacionEliminar && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-scale-in">
                        <div className="flex items-center gap-3 text-red-600 mb-4">
                            <div className="p-3 bg-red-50 rounded-full">
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className="text-lg font-bold">¿Eliminar contacto?</h3>
                        </div>
                        <p className="text-gray-600 mb-6">
                            Estás a punto de eliminar a <strong>{obtenerNombreCompleto(contacto)}</strong>.
                            Esta acción no se puede deshacer.
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button
                                variant="ghost"
                                onClick={() => setMostrarConfirmacionEliminar(false)}
                                disabled={eliminando}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                className="!bg-red-600 hover:!bg-red-700 text-white"
                                onClick={handleEliminar}
                                isLoading={eliminando}
                            >
                                Sí, eliminar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================ */}
            {/* VISOR DE PDF (HOJA DE VIDA) */}
            {/* ============================================ */}
            {visorPdfAbierto && hojaVidaUrl && (
                <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col animate-fade-in">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80">
                        <h3 className="text-white font-medium">Hoja de Vida - {obtenerNombreCompleto(contacto)}</h3>
                        <div className="flex items-center gap-2">
                            <a
                                href={hojaVidaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-white hover:bg-white/10 rounded-lg"
                                title="Abrir en nueva pestaña"
                            >
                                <ExternalLink size={20} />
                            </a>
                            <button
                                onClick={() => setVisorPdfAbierto(false)}
                                className="p-2 text-white hover:bg-white/10 rounded-lg"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1">
                        <iframe
                            src={hojaVidaUrl}
                            className="w-full h-full"
                            title="Hoja de Vida"
                        />
                    </div>
                </div>
            )}

            {/* ============================================ */}
            {/* VISOR DE FIRMA (IMAGEN) */}
            {/* ============================================ */}
            {visorFirmaAbierto && firmaUrl && (
                <div
                    className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center animate-fade-in"
                    onClick={() => setVisorFirmaAbierto(false)}
                >
                    <div className="relative max-w-2xl max-h-[80vh] p-4">
                        <img
                            src={firmaUrl}
                            alt="Firma"
                            className="max-w-full max-h-full object-contain bg-white rounded-lg shadow-2xl"
                        />
                        <button
                            onClick={() => setVisorFirmaAbierto(false)}
                            className="absolute top-0 right-0 p-2 text-white bg-black/50 rounded-full hover:bg-black/70"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}

export default ContactoDetallePanel
