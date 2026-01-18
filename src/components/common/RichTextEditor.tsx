/**
 * Editor de Texto Enriquecido con TipTap
 * Para mostrar y editar respuestas de auditoría con formato
 * Convierte markdown a HTML visual y permite copiar a Word
 */

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { useEffect } from 'react'
import MarkdownIt from 'markdown-it'

interface RichTextEditorProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
}

// Configurar markdown-it para convertir markdown a HTML
const md = new MarkdownIt({
    html: true,
    breaks: true,
    linkify: false
})

/**
 * Convierte markdown a HTML para TipTap
 */
function markdownToHtml(markdown: string): string {
    if (!markdown) return ''

    try {
        const html = md.render(markdown)
        return html
    } catch (error) {
        console.error('[RichTextEditor] Error convirtiendo markdown:', error)
        // Fallback: retornar el texto tal cual envuelto en párrafo
        return `<p>${markdown.replace(/\n/g, '<br>')}</p>`
    }
}

/**
 * Convierte HTML de TipTap a texto con formato básico preservado
 * (para guardar en BD y poder copiar a Word)
 */
function htmlToText(html: string): string {
    if (!html) return ''

    // Crear elemento temporal para parsear HTML
    const temp = document.createElement('div')
    temp.innerHTML = html

    // Convertir elementos HTML a texto con formato básico
    let text = html

    // Convertir encabezados
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n\n$1\n\n')
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\n$1\n\n')
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n$1\n')

    // Convertir párrafos
    text = text.replace(/<\/p>/gi, '\n')
    text = text.replace(/<p[^>]*>/gi, '')

    // Convertir listas
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
    text = text.replace(/<\/?(ul|ol)[^>]*>/gi, '\n')

    // Convertir saltos de línea
    text = text.replace(/<br\s*\/?>/gi, '\n')

    // Limpiar tags HTML restantes
    text = text.replace(/<[^>]+>/g, '')

    // Decodificar entidades HTML
    const textarea = document.createElement('textarea')
    textarea.innerHTML = text
    text = textarea.value

    // Limpiar espacios múltiples y saltos de línea excesivos
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n')
    text = text.trim()

    return text
}

export function RichTextEditor({ value, onChange, placeholder, disabled }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3]
                }
            }),
            Underline,
        ],
        content: value ? markdownToHtml(value) : '',
        editable: !disabled,
        onUpdate: ({ editor }) => {
            // Obtener HTML y convertir a texto con formato preservado
            const html = editor.getHTML()
            const formattedText = htmlToText(html)
            onChange(formattedText)
        },
    })

    // Actualizar contenido cuando cambia externamente (ej: generación con IA)
    useEffect(() => {
        if (editor && value && editor.getHTML() !== markdownToHtml(value)) {
            const html = markdownToHtml(value)
            editor.commands.setContent(html)
        }
    }, [value, editor])

    if (!editor) {
        return <div className="animate-pulse bg-gray-100 h-32 rounded-lg" />
    }

    return (
        <div className="border border-gray-200 rounded-lg bg-white">
            {/* Toolbar */}
            <div className="border-b border-gray-200 p-2 flex gap-1 flex-wrap bg-gray-50">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run() || disabled}
                    className={`px-2 py-1 rounded text-sm font-bold transition-colors ${editor.isActive('bold')
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-200 text-gray-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Negrita (Ctrl+B)"
                >
                    B
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run() || disabled}
                    className={`px-2 py-1 rounded text-sm italic transition-colors ${editor.isActive('italic')
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-200 text-gray-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Cursiva (Ctrl+I)"
                >
                    I
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    disabled={disabled}
                    className={`px-2 py-1 rounded text-sm transition-colors ${editor.isActive('bulletList')
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-200 text-gray-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Lista con viñetas"
                >
                    • Lista
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    disabled={disabled}
                    className={`px-2 py-1 rounded text-sm transition-colors ${editor.isActive('orderedList')
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-200 text-gray-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Lista numerada"
                >
                    1. Lista
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    disabled={disabled}
                    className={`px-2 py-1 rounded text-sm font-semibold transition-colors ${editor.isActive('heading', { level: 2 })
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-200 text-gray-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Encabezado"
                >
                    H2
                </button>
            </div>

            {/* Editor Content */}
            <EditorContent
                editor={editor}
                className="prose prose-sm max-w-none p-3 min-h-[150px] focus:outline-none"
                placeholder={placeholder}
            />

            {/* Character count */}
            <div className="border-t border-gray-200 px-3 py-1 text-xs text-gray-500 bg-gray-50">
                {editor.storage.characterCount?.characters() || 0} caracteres
            </div>
        </div>
    )
}
