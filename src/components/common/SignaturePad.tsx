import { useRef, useEffect, useState } from 'react'
import { FaEraser, FaPen } from 'react-icons/fa'

interface SignaturePadProps {
    onChange: (dataUrl: string | null) => void
    width?: number
    height?: number
    className?: string
}

export function SignaturePad({ onChange, className = '' }: Omit<SignaturePadProps, 'width' | 'height'>) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasSignature, setHasSignature] = useState(false)

    // Ajustar tamaño del canvas al contenedor
    useEffect(() => {
        const container = containerRef.current
        const canvas = canvasRef.current
        if (!container || !canvas) return

        const resizeCanvas = () => {
            // Guardar contenido actual si existe (opcional, pero complejo de escalar)
            // Por simplicidad, al redimensionar se limpia, o se podría guardar y repintar.
            // Para firmas, lo mejor es redimensionar solo al inicio o mantener ratio.

            const { width, height } = container.getBoundingClientRect()

            // Ajustar solo si cambiaron las dimensiones para evitar borrados innecesarios
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width
                canvas.height = height

                // Re-configurar contexto tras resize
                const ctx = canvas.getContext('2d')
                if (ctx) {
                    ctx.lineWidth = 2
                    ctx.lineCap = 'round'
                    ctx.strokeStyle = '#000000'
                }
            }
        }

        // Observer para cambios de tamaño
        const resizeObserver = new ResizeObserver(() => resizeCanvas())
        resizeObserver.observe(container)

        // Primera llamada
        resizeCanvas()

        return () => resizeObserver.disconnect()
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        // Prevent scrolling on touch devices
        const preventDefault = (e: TouchEvent) => {
            if (e.target === canvas) {
                e.preventDefault()
            }
        }

        document.body.addEventListener('touchmove', preventDefault, { passive: false })

        return () => document.body.removeEventListener('touchmove', preventDefault)
    }, [])

    // Obtener coordenadas relativas al canvas correctamente
    const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }

        const rect = canvas.getBoundingClientRect()
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        }
    }

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true)
        const ctx = canvasRef.current?.getContext('2d')
        if (!ctx) return

        const { x, y } = getCoordinates(e)
        ctx.beginPath()
        ctx.moveTo(x, y)
    }

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return
        const ctx = canvasRef.current?.getContext('2d')
        if (!ctx) return

        const { x, y } = getCoordinates(e)
        ctx.lineTo(x, y)
        ctx.stroke()

        if (!hasSignature) setHasSignature(true)
    }

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false)
            updateSignature()
        }
    }

    const updateSignature = () => {
        const canvas = canvasRef.current
        if (canvas && hasSignature) {
            onChange(canvas.toDataURL('image/png'))
        }
    }

    const clear = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        setHasSignature(false)
        onChange(null)
    }

    return (
        <div className={`flex flex-col gap-2 ${className} w-full`}>
            {/* Contenedor con altura fija para asegurar espacio */}
            <div
                ref={containerRef}
                className="relative border-2 border-slate-300 border-dashed rounded-lg bg-white overflow-hidden touch-none hover:border-blue-400 transition-colors w-full h-[200px]"
            >
                <div className="absolute top-2 left-2 text-slate-300 pointer-events-none select-none">
                    <FaPen className="text-xl" />
                </div>
                <div className="absolute bottom-2 right-2 text-xs text-slate-300 pointer-events-none select-none">
                    Firmar aquí
                </div>
                <canvas
                    ref={canvasRef}
                    className="block cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{ touchAction: 'none' }}
                />
            </div>

            <div className="flex justify-between items-center text-sm">
                <span className={`transition-opacity ${hasSignature ? 'text-green-600 font-medium' : 'text-slate-400 opacity-0'}`}>
                    Firma capturada
                </span>
                <button
                    type="button"
                    onClick={clear}
                    disabled={!hasSignature}
                    className="flex items-center gap-1 text-red-500 hover:text-red-700 disabled:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-red-50"
                >
                    <FaEraser />
                    Borrar Firma
                </button>
            </div>
        </div>
    )
}
