/**
 * Formulario de Login - Diseño Premium
 * Portal de Colaboradores GESTAR SALUD IPS
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, ArrowRight, AlertCircle, Heart, Activity } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { authService } from '@/services/auth.service'
import { ROUTES, ERROR_MESSAGES } from '@/config/constants'
import { ChangePasswordModal } from './ChangePasswordModal'

export function LoginForm() {
    const navigate = useNavigate()
    const { login } = useAuth()

    // Estado del formulario
    const [identificacion, setIdentificacion] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
    const [lockedUntil, setLockedUntil] = useState<Date | null>(null)

    // Estado del modal de cambio de contraseña
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [tempUserData, setTempUserData] = useState<{
        identificacion: string
        user: Parameters<typeof login>[0]
    } | null>(null)

    const handleIdentificacionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '')
        setIdentificacion(value)
        setError('')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setRemainingAttempts(null)
        setLockedUntil(null)

        if (!identificacion.trim()) {
            setError(ERROR_MESSAGES.REQUIRED_FIELD)
            return
        }

        if (!password.trim()) {
            setError(ERROR_MESSAGES.REQUIRED_FIELD)
            return
        }

        setIsLoading(true)

        try {
            const result = await authService.login({
                identificacion: identificacion.trim(),
                password: password.trim(),
            })

            if (!result.success) {
                setError(result.error || ERROR_MESSAGES.INVALID_CREDENTIALS)
                if (result.remainingAttempts !== undefined) {
                    setRemainingAttempts(result.remainingAttempts)
                }
                if (result.lockedUntil) {
                    setLockedUntil(result.lockedUntil)
                }
                return
            }

            if (result.requiresPasswordChange && result.user) {
                setTempUserData({
                    identificacion: identificacion.trim(),
                    user: result.user,
                })
                setShowPasswordModal(true)
            } else if (result.user) {
                login(result.user)
                navigate(ROUTES.DASHBOARD)
            }
        } catch (err) {
            console.error('Error en login', err)
            setError(ERROR_MESSAGES.SERVER_ERROR)
        } finally {
            setIsLoading(false)
        }
    }

    const handlePasswordChanged = () => {
        if (tempUserData?.user) {
            const updatedUser = { ...tempUserData.user, primerLogin: false }
            login(updatedUser)
            navigate(ROUTES.DASHBOARD)
        }
        setShowPasswordModal(false)
        setTempUserData(null)
    }

    const getLockedTimeRemaining = () => {
        if (!lockedUntil) return null
        const now = new Date()
        const diff = lockedUntil.getTime() - now.getTime()
        if (diff <= 0) return null
        const minutes = Math.ceil(diff / 60000)
        return `${minutes} minuto${minutes > 1 ? 's' : ''}`
    }

    return (
        <>
            {/* Contenedor principal con fondo */}
            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
                }}
            >
                {/* Efectos de fondo */}
                <div style={{
                    position: 'absolute',
                    top: '5rem',
                    left: '2rem',
                    width: '20rem',
                    height: '20rem',
                    background: 'rgba(0, 149, 235, 0.15)',
                    borderRadius: '50%',
                    filter: 'blur(100px)',
                }} />
                <div style={{
                    position: 'absolute',
                    bottom: '5rem',
                    right: '2rem',
                    width: '24rem',
                    height: '24rem',
                    background: 'rgba(243, 88, 93, 0.1)',
                    borderRadius: '50%',
                    filter: 'blur(120px)',
                }} />

                {/* Grid pattern */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }} />

                {/* Contenido */}
                <div style={{
                    position: 'relative',
                    zIndex: 10,
                    width: '100%',
                    maxWidth: '420px',
                    padding: '1.5rem',
                }}>
                    {/* Logo y título */}
                    <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                        <div style={{ marginBottom: '1.5rem', display: 'inline-block', position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(0, 149, 235, 0.3)',
                                filter: 'blur(30px)',
                                borderRadius: '50%',
                            }} />
                            <img
                                src="/logo_gestar.png"
                                alt="GESTAR SALUD IPS"
                                style={{ position: 'relative', height: '80px', width: 'auto' }}
                            />
                        </div>
                        <h1 style={{
                            fontSize: '1.875rem',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            marginBottom: '0.5rem',
                            letterSpacing: '-0.025em',
                        }}>
                            Portal de Colaboradores
                        </h1>
                        <p style={{
                            color: '#94A3B8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            fontSize: '0.875rem',
                        }}>
                            <Heart size={14} style={{ color: '#F3585D' }} />
                            GESTAR SALUD IPS
                            <Activity size={14} style={{ color: '#85C54C' }} />
                        </p>
                    </div>

                    {/* Card del formulario */}
                    <div style={{
                        background: '#FFFFFF',
                        borderRadius: '1.5rem',
                        padding: '2rem',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 60px -15px rgba(0, 149, 235, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}>
                        <form onSubmit={handleSubmit}>
                            {/* Campo Identificación */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: '#334155',
                                    marginBottom: '0.5rem',
                                }}>
                                    Número de Identificación
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <div style={{
                                        position: 'absolute',
                                        left: '1rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: '#94A3B8',
                                    }}>
                                        <User size={20} />
                                    </div>
                                    <input
                                        type="text"
                                        value={identificacion}
                                        onChange={handleIdentificacionChange}
                                        placeholder="Ingresa tu documento"
                                        disabled={isLoading || !!lockedUntil}
                                        autoComplete="username"
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '0.875rem 1rem 0.875rem 3rem',
                                            fontSize: '1rem',
                                            borderRadius: '0.75rem',
                                            border: '2px solid #E2E8F0',
                                            background: '#FFFFFF',
                                            color: '#1E293B',
                                            outline: 'none',
                                            transition: 'all 0.2s',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#0095EB'
                                            e.target.style.boxShadow = '0 0 0 4px rgba(0, 149, 235, 0.1)'
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = '#E2E8F0'
                                            e.target.style.boxShadow = 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Campo Contraseña */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: '#334155',
                                    marginBottom: '0.5rem',
                                }}>
                                    Contraseña
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <div style={{
                                        position: 'absolute',
                                        left: '1rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: '#94A3B8',
                                    }}>
                                        <Lock size={20} />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value)
                                            setError('')
                                        }}
                                        placeholder="Ingresa tu contraseña"
                                        disabled={isLoading || !!lockedUntil}
                                        autoComplete="current-password"
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '0.875rem 1rem 0.875rem 3rem',
                                            fontSize: '1rem',
                                            borderRadius: '0.75rem',
                                            border: '2px solid #E2E8F0',
                                            background: '#FFFFFF',
                                            color: '#1E293B',
                                            outline: 'none',
                                            transition: 'all 0.2s',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#0095EB'
                                            e.target.style.boxShadow = '0 0 0 4px rgba(0, 149, 235, 0.1)'
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = '#E2E8F0'
                                            e.target.style.boxShadow = 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Mensaje de error */}
                            {error && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '0.75rem',
                                    padding: '1rem',
                                    background: '#FEF2F2',
                                    border: '1px solid #FECACA',
                                    borderRadius: '0.75rem',
                                    marginBottom: '1.5rem',
                                }}>
                                    <AlertCircle size={20} style={{ color: '#DC2626', flexShrink: 0, marginTop: '2px' }} />
                                    <div>
                                        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#B91C1C', margin: 0 }}>
                                            {error}
                                        </p>
                                        {remainingAttempts !== null && remainingAttempts > 0 && (
                                            <p style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '0.25rem', margin: 0 }}>
                                                Intentos restantes: {remainingAttempts}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Mensaje de bloqueo */}
                            {lockedUntil && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '0.75rem',
                                    padding: '1rem',
                                    background: '#FFFBEB',
                                    border: '1px solid #FDE68A',
                                    borderRadius: '0.75rem',
                                    marginBottom: '1.5rem',
                                }}>
                                    <AlertCircle size={20} style={{ color: '#D97706', flexShrink: 0, marginTop: '2px' }} />
                                    <div>
                                        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#92400E', margin: 0 }}>
                                            Cuenta bloqueada temporalmente
                                        </p>
                                        {getLockedTimeRemaining() && (
                                            <p style={{ fontSize: '0.75rem', color: '#B45309', marginTop: '0.25rem', margin: 0 }}>
                                                Intenta de nuevo en {getLockedTimeRemaining()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Botón de login */}
                            <button
                                type="submit"
                                disabled={isLoading || !!lockedUntil}
                                style={{
                                    width: '100%',
                                    padding: '1rem 2rem',
                                    fontWeight: 600,
                                    fontSize: '1rem',
                                    borderRadius: '0.75rem',
                                    border: 'none',
                                    cursor: isLoading || lockedUntil ? 'not-allowed' : 'pointer',
                                    background: 'linear-gradient(135deg, #0095EB 0%, #0077BC 100%)',
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.75rem',
                                    opacity: isLoading || lockedUntil ? 0.6 : 1,
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 14px -3px rgba(0, 149, 235, 0.4)',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isLoading && !lockedUntil) {
                                        e.currentTarget.style.transform = 'translateY(-2px)'
                                        e.currentTarget.style.boxShadow = '0 8px 25px -5px rgba(0, 149, 235, 0.5)'
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)'
                                    e.currentTarget.style.boxShadow = '0 4px 14px -3px rgba(0, 149, 235, 0.4)'
                                }}
                            >
                                {isLoading ? (
                                    <>
                                        <svg
                                            style={{ animation: 'spin 1s linear infinite', height: '20px', width: '20px' }}
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                style={{ opacity: 0.25 }}
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                fill="none"
                                            />
                                            <path
                                                style={{ opacity: 0.75 }}
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            />
                                        </svg>
                                        <span>Iniciando sesión...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Iniciar Sesión</span>
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Texto de ayuda */}
                        <p style={{
                            marginTop: '2rem',
                            textAlign: 'center',
                            fontSize: '0.875rem',
                            color: '#64748B',
                        }}>
                            ¿Olvidaste tu contraseña?{' '}
                            <span style={{ color: '#0095EB', fontWeight: 500 }}>
                                Contacta al administrador
                            </span>
                        </p>
                    </div>

                    {/* Footer */}
                    <p style={{
                        textAlign: 'center',
                        fontSize: '0.75rem',
                        color: '#64748B',
                        marginTop: '2rem',
                    }}>
                        © {new Date().getFullYear()} GESTAR SALUD DE COLOMBIA IPS S.A.S
                    </p>
                </div>

                {/* Keyframe animation for spinner */}
                <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
            </div>

            {/* Modal de cambio de contraseña */}
            {showPasswordModal && tempUserData && (
                <ChangePasswordModal
                    identificacion={tempUserData.identificacion}
                    isFirstLogin
                    onSuccess={handlePasswordChanged}
                    onClose={() => { }}
                />
            )}
        </>
    )
}

export default LoginForm
