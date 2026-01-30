/**
 * Type declarations for html2pdf.js
 */

declare module 'html2pdf.js' {
    interface Html2PdfOptions {
        margin?: number | [number, number, number, number]
        filename?: string
        image?: {
            type?: 'jpeg' | 'png' | 'webp'
            quality?: number
        }
        html2canvas?: {
            scale?: number
            useCORS?: boolean
            letterRendering?: boolean
            logging?: boolean
            backgroundColor?: string
            windowWidth?: number
            windowHeight?: number
        }
        jsPDF?: {
            unit?: 'pt' | 'mm' | 'cm' | 'in'
            format?: 'a4' | 'letter' | 'legal' | [number, number]
            orientation?: 'portrait' | 'landscape'
            compress?: boolean
        }
        pagebreak?: {
            mode?: string | string[]
            before?: string | string[]
            after?: string | string[]
            avoid?: string | string[]
        }
    }

    interface Html2PdfWorker {
        set(options: Html2PdfOptions): Html2PdfWorker
        from(element: HTMLElement | string): Html2PdfWorker
        save(): Promise<void>
        outputPdf(type: 'blob'): Promise<Blob>
        outputPdf(type: 'datauristring'): Promise<string>
        outputPdf(type: 'arraybuffer'): Promise<ArrayBuffer>
        toPdf(): Html2PdfWorker
        get(type: 'pdf'): Promise<unknown>
    }

    function html2pdf(): Html2PdfWorker
    function html2pdf(element: HTMLElement, options?: Html2PdfOptions): Html2PdfWorker

    export = html2pdf
}
