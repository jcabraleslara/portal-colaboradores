/**
 * Modal de Cambio de Contraseña
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState } from 'react'
import { Lock, Check, X, AlertCircle } from 'lucide-react'
import { Button, Input, Card } from '@/components/common'
import { authService } from '@/services/auth.service'
import { SECURITY } from '@/config/constants'

interface ChangePasswordModalProps {
    identificacion: string
    isFirstLogin?: boolean
    onSuccess: () => void
    onClose: () => void
}

export function ChangePasswordModal({
    identificacion,
    isFirstLogin = false,
    onSuccess,
    onClose,
}: ChangePasswordModalProps) {
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    // Validación en tiempo real
    const passwordChecks = {
        minLength: newPassword.length >= SECURITY.PASSWORD_MIN_LENGTH,
        hasUppercase: /[A-Z]/.test(newPassword),
        hasNumber: /[0-9]/.test(newPassword),
        matches: newPassword === confirmPassword && newPassword.length > 0,
    }

    const allChecksPass = Object.values(passwordChecks).every(Boolean)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!allChecksPass) {
            setError('La contraseña no cumple con todos los requisitos')
            return
        }

        setIsLoading(true)

        try {
            const result = await authService.changePassword(identificacion, {
                currentPassword: isFirstLogin ? identificacion : currentPassword,
                newPassword,
                confirmPassword,
            })

            if (result.success) {
                onSuccess()
            } else {
                setError(result.error || 'Error al cambiar la contraseña')
            }
        } catch (err) {
            console.error('Error en cambio de contraseña', err)
            setError('Error del servidor. Intenta más tarde.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card shadow="lg" padding="lg" className="w-full max-w-md animate-in fade-in zoom-in">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--color-primary-50)] rounded-lg">
                            <Lock className="text-[var(--color-primary)]" size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                                {isFirstLogin ? 'Crear Nueva Contraseña' : 'Cambiar Contraseña'}
                            </h2>
                            {isFirstLogin && (
                                <p className="text-sm text-gray-500">
                                    Debes crear una contraseña segura para continuar
                                </p>
                            )}
                        </div>
                    </div>

                    {!isFirstLogin && (
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            aria-label="Cerrar"
                        >
                            <X size={20} className="text-gray-400" />
                        </button>
                    )}
                </div>

                {/* Mensaje de primer login */}
                {isFirstLogin && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                        <AlertCircle size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-800">
                            Por seguridad, debes cambiar tu contraseña inicial antes de acceder al portal.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Contraseña actual (si no es primer login) */}
                    {!isFirstLogin && (
                        <Input
                            label="Contraseña Actual"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Tu contraseña actual"
                            required
                        />
                    )}

                    <Input
                        label="Nueva Contraseña"
                        type="password"
                        value={newPassword}
                        onChange={(e) => {
                            setNewPassword(e.target.value)
                            setError('')
                        }}
                        placeholder="Crea una contraseña segura"
                        required
                    />

                    <Input
                        label="Confirmar Nueva Contraseña"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => {
                            setConfirmPassword(e.target.value)
                            setError('')
                        }}
                        placeholder="Repite la nueva contraseña"
                        required
                    />

                    {/* Checklist de requisitos */}
                    <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-600 mb-2">
                            Requisitos de contraseña:
                        </p>
                        <PasswordCheck
                            passed={passwordChecks.minLength}
                            label={`Mínimo ${SECURITY.PASSWORD_MIN_LENGTH} caracteres`}
                        />
                        <PasswordCheck
                            passed={passwordChecks.hasUppercase}
                            label="Al menos una letra mayúscula"
                        />
                        <PasswordCheck
                            passed={passwordChecks.hasNumber}
                            label="Al menos un número"
                        />
                        <PasswordCheck
                            passed={passwordChecks.matches}
                            label="Las contraseñas coinciden"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-[var(--color-error)]">{error}</p>
                        </div>
                    )}

                    {/* Botones */}
                    <div className="flex gap-3 pt-2">
                        {!isFirstLogin && (
                            <Button
                                type="button"
                                variant="secondary"
                                fullWidth
                                onClick={onClose}
                                disabled={isLoading}
                            >
                                Cancelar
                            </Button>
                        )}
                        <Button
                            type="submit"
                            fullWidth
                            isLoading={isLoading}
                            disabled={!allChecksPass}
                        >
                            {isFirstLogin ? 'Crear y Continuar' : 'Guardar Cambios'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    )
}

// Componente para cada check de contraseña
function PasswordCheck({ passed, label }: { passed: boolean; label: string }) {
    return (
        <div className="flex items-center gap-2">
            {passed ? (
                <Check size={14} className="text-[var(--color-success)]" />
            ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />
            )}
            <span className={`text-xs ${passed ? 'text-[var(--color-success)]' : 'text-gray-500'}`}>
                {label}
            </span>
        </div>
    )
}

export default ChangePasswordModal
