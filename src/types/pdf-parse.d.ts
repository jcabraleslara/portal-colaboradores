declare module 'pdf-parse' {
    interface Options {
        pagerender?: (pageData: any) => string
        max?: number
        version?: string
    }

    interface Result {
        numpages: number
        numrender: number
        info: any
        metadata: any
        text: string
        version: string
    }

    function pdfParse(dataBuffer: Buffer, options?: Options): Promise<Result>

    export = pdfParse
}
