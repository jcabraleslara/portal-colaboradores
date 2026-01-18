import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
    html: true,
    breaks: true,
    linkify: false
})

/**
 * Copia texto al portapapeles en formato enriquecido (HTML) y plano (Markdown/Texto).
 * Esto permite que al pegar en Word o Outlook se mantenga el formato.
 */
export async function copyRichText(markdown: string): Promise<boolean> {
    if (!markdown) return false

    try {
        // Generar HTML desde el markdown
        const html = md.render(markdown)

        // Crear el objeto de portapapeles con múltiples tipos
        const typeHtml = 'text/html'
        const typePlain = 'text/plain'

        const blobHtml = new Blob([html], { type: typeHtml })
        const blobPlain = new Blob([markdown], { type: typePlain })

        const data = [
            new ClipboardItem({
                [typeHtml]: blobHtml,
                [typePlain]: blobPlain,
            })
        ]

        await navigator.clipboard.write(data)
        return true
    } catch (error) {
        console.error('[Clipboard] Error al copiar texto enriquecido:', error)

        // Fallback a texto plano si falla ClipboardItem (algunos navegadores antiguos o contextos no seguros)
        try {
            await navigator.clipboard.writeText(markdown)
            return true
        } catch (fallbackError) {
            console.error('[Clipboard] Error en fallback de copia:', fallbackError)
            return false
        }
    }
}
