/**
 * Editor de Texto Enriquecido con TipTap
 * Para mostrar y editar respuestas de auditoría con formato
 * Convierte markdown a HTML visual y permite copiar a Word
 */

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef } from 'react'
import MarkdownIt from 'markdown-it'
import TurndownService from 'turndown'

interface RichTextEditorProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
}

// Configurar markdown-it para convertir markdown a HTML (Input)
const md = new MarkdownIt({
    html: true,
    breaks: true,
    linkify: false
})

// Configurar Turndown para convertir HTML a markdown (Output)
const turndownService = new TurndownService({
    headingStyle: 'atx', // Usar # para encabezados
    bulletListMarker: '-', // Usar - para listas
    codeBlockStyle: 'fenced'
})

/**
 * Convierte markdown a HTML para TipTap
 */
function markdownToHtml(markdown: string): string {
    if (!markdown) return ''
    try {
        return md.render(markdown)
    } catch (error) {
        console.error('[RichTextEditor] Error convirtiendo markdown:', error)
        return `<p>${markdown.replace(/\n/g, '<br>')}</p>`
    }
}

/**
 * Convierte HTML de TipTap a Markdown
 * Preserva formato (negritas, listas) para guardar en BD
 */
function htmlToMarkdown(html: string): string {
    if (!html) return ''
    try {
        return turndownService.turndown(html)
    } catch (error) {
        console.error('[RichTextEditor] Error convirtiendo a markdown:', error)
        return html.replace(/<[^>]+>/g, '') // Fallback a texto plano
    }
}

export function RichTextEditor({ value, onChange, placeholder, disabled, className }: RichTextEditorProps) {
    // Rastrear si el cambio vino del propio editor para evitar re-setear contenido
    // y perder la posición del cursor
    const isInternalChange = useRef(false)

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3]
                }
            })
        ],
        content: value ? markdownToHtml(value) : '',
        editable: !disabled,
        onUpdate: ({ editor }: { editor: Editor }) => {
            const html = editor.getHTML()
            const markdown = htmlToMarkdown(html)
            isInternalChange.current = true
            onChange(markdown)
            // Resetear flag después del ciclo de React para que el useEffect lo vea
            requestAnimationFrame(() => {
                isInternalChange.current = false
            })
        },
    })

    // Actualizar contenido solo cuando cambia desde fuente externa
    // (ej: generación con IA, navegación entre casos, limpieza)
    useEffect(() => {
        if (!editor) return

        // Si el cambio vino del propio editor, NO re-setear (preservar cursor)
        if (isInternalChange.current) return

        const currentHtml = editor.getHTML()
        const newHtml = markdownToHtml(value || '')

        // Valor vacío: limpiar editor si tiene contenido
        if (!value || value.trim() === '') {
            const isVisuallyEmpty = currentHtml === '<p></p>' || editor.isEmpty
            if (!isVisuallyEmpty) {
                editor.commands.setContent('')
            }
            return
        }

        // Cambio externo: actualizar contenido del editor
        if (currentHtml !== newHtml && Math.abs(currentHtml.length - newHtml.length) > 5) {
            editor.commands.setContent(newHtml)
        }
    }, [value, editor])

    // Actualizar estado disabled
    useEffect(() => {
        if (editor) {
            editor.setEditable(!disabled)
        }
    }, [disabled, editor])

    if (!editor) {
        return <div className="animate-pulse bg-gray-100 h-32 rounded-lg" />
    }

    return (
        <div className={`border border-gray-200 rounded-lg bg-white flex flex-col ${className || ''}`}>
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
                className="prose prose-sm max-w-none p-3 min-h-[100px] flex-1 focus:outline-none"
                placeholder={placeholder}
            />

            {/* Character count */}
            <div className="border-t border-gray-200 px-3 py-1 text-xs text-gray-500 bg-gray-50">
                {editor.storage.characterCount?.characters() || 0} caracteres
            </div>
        </div>
    )
}
