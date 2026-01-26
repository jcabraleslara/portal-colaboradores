import { useRef, useEffect, useState } from 'react'
import { FaEraser, FaPen } from 'react-icons/fa'

interface SignaturePadProps {
    onChange: (dataUrl: string | null) => void
    width?: number
    height?: number
    className?: string
}

export function SignaturePad({ onChange, width = 500, height = 200, className = '' }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasSignature, setHasSignature] = useState(false)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (ctx) {
            ctx.lineWidth = 2
            ctx.lineCap = 'round'
            ctx.strokeStyle = '#000000'
        }

        // Prevent scrolling on touch devices
        const preventDefault = (e: TouchEvent) => {
            if (e.target === canvas) {
                e.preventDefault()
            }
        }

        // Add non-passive event listener for touch move to prevent scrolling
        document.body.addEventListener('touchmove', preventDefault, { passive: false })

        return () => {
            document.body.removeEventListener('touchmove', preventDefault)
        }
    }, [])

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return

        setIsDrawing(true)
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

        ctx.beginPath()
        ctx.moveTo(clientX - rect.left, clientY - rect.top)
    }

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

        ctx.lineTo(clientX - rect.left, clientY - rect.top)
        ctx.stroke()

        if (!hasSignature) {
            setHasSignature(true)
        }
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
            // Check if canvas is empty is harder without iterating pixels, 
            // but we trust hasSignature state set on draw
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
        <div className={`flex flex-col gap-2 ${className}`}>
            <div className="relative border-2 border-slate-300 border-dashed rounded-lg bg-white overflow-hidden touch-none hover:border-blue-400 transition-colors">
                <div className="absolute top-2 left-2 text-slate-300 pointer-events-none select-none">
                    <FaPen className="text-xl" />
                </div>
                <div className="absolute bottom-2 right-2 text-xs text-slate-300 pointer-events-none select-none">
                    Firmar aquí
                </div>
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    className="w-full h-full cursor-crosshair touch-none"
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
