/**
 * Modal para importar usuarios masivamente desde Excel
 */

import { useState, useRef, ChangeEvent } from 'react'
import { X, Upload, FileUp, Download, Loader2, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/config/supabase.config'
import { CreateUserData } from '@/services/usuariosPortal.service'
import { toast } from 'sonner'

interface ImportUserModalProps {
    onClose: () => void
    onCreated: () => void
}

interface ImportedUserRow {
    IDENTIFICACION: string
    NOMBRE_COMPLETO: string
    EMAIL_INSTITUCIONAL: string
    ROL: string
    CONTRASENA?: string
    [key: string]: any
}

interface ProcessingResult {
    total: number
    success: number
    failed: number
    errors: Array<{ row: number; user: string; error: string }>
}

export default function ImportUserModal({ onClose, onCreated }: ImportUserModalProps) {
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [result, setResult] = useState<ProcessingResult | null>(null)
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Descargar plantilla
    const handleDownloadTemplate = () => {
        const headers = [
            ['IDENTIFICACION', 'NOMBRE_COMPLETO', 'EMAIL_INSTITUCIONAL', 'ROL', 'CONTRASENA']
        ]
        const example = [
            ['1234567890', 'Usuario Ejemplo', 'usuario@gestarsaludips.com', 'operativo', '123456']
        ]

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...example])

        // Agregar comentarios/validaciones si fuera necesario (opcional)
        // Adjust column widths
        const wscols = [
            { wch: 20 }, // IDENTIFICACION
            { wch: 30 }, // NOMBRE_COMPLETO
            { wch: 30 }, // EMAIL
            { wch: 15 }, // ROL
            { wch: 15 }  // PASSWORD
        ]
        ws['!cols'] = wscols

        XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Usuarios')
        XLSX.writeFile(wb, 'plantilla_usuarios_portal.xlsx')
    }

    // Manejar selección de archivo
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            setResult(null)
        }
    }

    // Parsear y procesar archivo
    const handleImport = async () => {
        if (!file) return

        setIsProcessing(true)
        setResult(null)

        const reader = new FileReader()
        reader.onload = async (e) => {
            try {
                const data = e.target?.result
                const workbook = XLSX.read(data, { type: 'binary' })
                const sheetName = workbook.SheetNames[0]
                const sheet = workbook.Sheets[sheetName]
                const jsonData = XLSX.utils.sheet_to_json<ImportedUserRow>(sheet)

                if (jsonData.length === 0) {
                    toast.error('El archivo está vacío o no tiene el formato correcto')
                    setIsProcessing(false)
                    return
                }

                await processUsers(jsonData)

            } catch (error) {
                console.error('Error al leer el archivo:', error)
                toast.error('Error al procesar el archivo Excel')
                setIsProcessing(false)
            }
        }
        reader.readAsBinaryString(file)
    }

    // Procesar lista de usuarios
    const processUsers = async (users: ImportedUserRow[]) => {
        const results: ProcessingResult = {
            total: users.length,
            success: 0,
            failed: 0,
            errors: []
        }

        setProgress({ current: 0, total: users.length })

        // Obtener sesión
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
            toast.error('No hay sesión activa')
            setIsProcessing(false)
            return
        }

        const token = session.access_token

        for (let i = 0; i < users.length; i++) {
            const row = users[i]
            const rowIndex = i + 2 // +1 header +1 0-index

            // Validar campos mínimos
            if (!row.IDENTIFICACION || !row.NOMBRE_COMPLETO || !row.EMAIL_INSTITUCIONAL) {
                results.failed++
                results.errors.push({
                    row: rowIndex,
                    user: row.NOMBRE_COMPLETO || 'Desconocido',
                    error: 'Faltan campos obligatorios'
                })
                setProgress(prev => ({ ...prev, current: i + 1 }))
                continue
            }

            const userData: CreateUserData = {
                identificacion: String(row.IDENTIFICACION),
                nombre_completo: row.NOMBRE_COMPLETO,
                email_institucional: row.EMAIL_INSTITUCIONAL,
                rol: (['operativo', 'admin', 'superadmin', 'gerencia', 'auditor', 'asistencial', 'externo'].includes(row.ROL?.toLowerCase())
                    ? row.ROL.toLowerCase() as any
                    : 'operativo'),
                password: row.CONTRASENA ? String(row.CONTRASENA) : String(row.IDENTIFICACION) // Default a identificación si no hay pass
            }

            try {
                const response = await fetch('/api/create-user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(userData)
                })

                if (response.ok) {
                    const resJson = await response.json();
                    if (resJson.success) {
                        results.success++
                    } else {
                        results.failed++
                        results.errors.push({
                            row: rowIndex,
                            user: userData.nombre_completo,
                            error: resJson.error || 'Error desconocido'
                        })
                    }
                } else {
                    const text = await response.text()
                    results.failed++
                    results.errors.push({
                        row: rowIndex,
                        user: userData.nombre_completo,
                        error: `Error HTTP ${response.status}: ${text.substring(0, 50)}`
                    })
                }
            } catch (err: any) {
                results.failed++
                results.errors.push({
                    row: rowIndex,
                    user: userData.nombre_completo,
                    error: err.message || 'Error de conexión'
                })
            }

            setProgress(prev => ({ ...prev, current: i + 1 }))
        }

        setResult(results)
        setIsProcessing(false)
        if (results.success > 0) {
            onCreated() // Refrescar lista de usuarios
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={!isProcessing ? onClose : undefined}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <FileSpreadsheet className="w-6 h-6" />
                        Importación Masiva de Usuarios
                    </h2>
                    {!isProcessing && (
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                    )}
                </div>

                <div className="p-6">
                    {/* Paso 1: Descargar Plantilla */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">1. Descargar Plantilla</h3>
                        <p className="text-sm text-gray-500 mb-3">
                            Descarga el formato Excel, rellena los datos de los usuarios y guarda el archivo.
                        </p>
                        <button
                            onClick={handleDownloadTemplate}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-4 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition-colors text-sm font-medium"
                        >
                            <Download className="w-4 h-4" />
                            Descargar Plantilla Excel
                        </button>
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

                    {/* Paso 2: Subir Archivo */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">2. Subir Archivo Completado</h3>

                        {!result ? (
                            <div
                                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400'
                                    }`}
                                onClick={() => !isProcessing && fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                    disabled={isProcessing}
                                />

                                {file ? (
                                    <div className="flex flex-col items-center">
                                        <FileSpreadsheet className="w-12 h-12 text-green-600 mb-2" />
                                        <p className="font-medium text-gray-800">{file.name}</p>
                                        <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                        <button
                                            className="mt-2 text-sm text-red-500 hover:text-red-700 font-medium"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setFile(null)
                                            }}
                                            disabled={isProcessing}
                                        >
                                            Quitar archivo
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center cursor-pointer">
                                        <Upload className="w-10 h-10 text-gray-400 mb-2" />
                                        <p className="text-gray-600 font-medium">Click para seleccionar archivo</p>
                                        <p className="text-xs text-gray-400 mt-1">Soporta .xlsx, .xls</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Resultados del proceso
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-gray-700">Resumen de Importación</span>
                                    {result.failed === 0 ? (
                                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">Exitoso</span>
                                    ) : (
                                        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold">Con Advertencias</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                                    <div className="bg-white p-2 rounded shadow-sm">
                                        <div className="text-lg font-bold text-gray-800">{result.total}</div>
                                        <div className="text-xs text-gray-500">Total</div>
                                    </div>
                                    <div className="bg-white p-2 rounded shadow-sm">
                                        <div className="text-lg font-bold text-green-600">{result.success}</div>
                                        <div className="text-xs text-gray-500">Creados</div>
                                    </div>
                                    <div className="bg-white p-2 rounded shadow-sm">
                                        <div className="text-lg font-bold text-red-600">{result.failed}</div>
                                        <div className="text-xs text-gray-500">Fallidos</div>
                                    </div>
                                </div>

                                {result.errors.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-xs font-semibold text-red-700 mb-1">Errores ({result.errors.length}):</p>
                                        <div className="max-h-32 overflow-y-auto bg-white border border-red-100 rounded text-xs p-2 space-y-1">
                                            {result.errors.map((err, idx) => (
                                                <div key={idx} className="text-red-600 border-b border-gray-50 last:border-0 pb-1 mb-1">
                                                    <span className="font-bold">Fila {err.row}:</span> {err.user} - {err.error}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        setFile(null)
                                        setResult(null)
                                    }}
                                    className="mt-3 w-full py-2 bg-white border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
                                >
                                    Importar otro archivo
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Progreso */}
                    {isProcessing && (
                        <div className="mb-4">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>Procesando...</span>
                                <span>{progress.current} / {progress.total}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Botones de Acción */}
                    {!result && (
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                disabled={isProcessing}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={!file || isProcessing}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Importando...
                                    </>
                                ) : (
                                    <>
                                        <FileUp className="w-5 h-5" />
                                        Comenzar Importación
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
