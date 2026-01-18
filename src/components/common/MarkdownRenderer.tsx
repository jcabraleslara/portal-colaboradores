import MarkdownIt from 'markdown-it'
import { useMemo } from 'react'

const md = new MarkdownIt({
    html: true,
    breaks: true,
    linkify: false
})

interface MarkdownRendererProps {
    markdown: string
    className?: string
}

/**
 * Componente para renderizar Markdown de forma segura y consistente con el editor TipTap
 */
export function MarkdownRenderer({ markdown, className = '' }: MarkdownRendererProps) {
    const html = useMemo(() => {
        if (!markdown || markdown === 'NaN') return ''
        try {
            return md.render(markdown)
        } catch (error) {
            console.error('[MarkdownRenderer] Error al renderizar markdown:', error)
            return markdown
        }
    }, [markdown])

    if (!markdown || markdown === 'NaN' || markdown === '-') {
        return <span className="text-gray-400 italic">Sin respuesta</span>
    }

    return (
        <div
            className={`markdown-content prose prose-sm max-w-none ${className}`}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    )
}
