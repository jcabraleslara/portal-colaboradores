
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

// Cargar variables de entorno
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
} else {
    dotenv.config()
}

// Configuración
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID
const ONEDRIVE_FOLDER_ID = process.env.ONEDRIVE_FOLDER_ID || ''
const ONEDRIVE_FOLDER_PATH = process.env.ONEDRIVE_FOLDER_PATH || '/Soportes Facturación' // Ajusta según tu estructura real

if (!SUPABASE_URL || !SUPABASE_KEY || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_TENANT_ID) {
    console.error('❌ Error: Faltan variables de entorno críticas (Supabase o Azure AD)')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Interfaces Graph
interface GraphTokenResponse {
    access_token: string
    expires_in: number
}
interface GraphDriveItem {
    id: string
    name: string
    webUrl: string
}

// ==========================================
// FUNCIONES AUXILIARES (Portadas de upload-onedrive.ts)
// ==========================================

async function getGraphAccessToken(): Promise<string> {
    const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`
    const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: AZURE_CLIENT_ID!,
        client_secret: AZURE_CLIENT_SECRET!,
        scope: 'https://graph.microsoft.com/.default',
    })

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    })

    if (!response.ok) throw new Error(`Error Auth Graph: ${response.status}`)
    const data = await response.json() as GraphTokenResponse
    return data.access_token
}

async function obtenerIdPorPath(accessToken: string, folderPath: string): Promise<string> {
    const driveUrl = 'https://graph.microsoft.com/v1.0/users/coordinacionmedica@gestarsaludips.com/drive'
    const url = `${driveUrl}/root:${folderPath}`
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
    })
    if (!response.ok) throw new Error(`Error obteniendo carpeta root ${folderPath}: ${response.status}`)
    const data = await response.json() as GraphDriveItem
    return data.id
}

async function crearCarpetaOneDrive(accessToken: string, nombreCarpeta: string, parentFolderId: string): Promise<GraphDriveItem> {
    const driveUrl = 'https://graph.microsoft.com/v1.0/users/coordinacionmedica@gestarsaludips.com/drive'
    const url = `${driveUrl}/items/${parentFolderId}/children`
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: nombreCarpeta,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename',
        }),
    })
    if (!response.ok) throw new Error(`Error creando carpeta ${nombreCarpeta}: ${response.status}`)
    return response.json() as Promise<GraphDriveItem>
}

async function subirArchivoOneDrive(accessToken: string, folderId: string, nombreArchivo: string, contenido: ArrayBuffer): Promise<GraphDriveItem> {
    const driveUrl = 'https://graph.microsoft.com/v1.0/users/coordinacionmedica@gestarsaludips.com/drive'
    const url = `${driveUrl}/items/${folderId}:/${nombreArchivo}:/content`
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
        },
        body: contenido,
    })
    if (!response.ok) throw new Error(`Error subiendo archivo ${nombreArchivo}: ${response.status}`)
    return response.json() as Promise<GraphDriveItem>
}

function generarNombreCarpeta(soporte: any): string {
    const radicado = soporte.radicado || 'FACT0000'
    const fecha = new Date(soporte.fecha_atencion)
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const dia = String(fecha.getDate()).padStart(2, '0')

    const epsCorta: Record<string, string> = { 'NUEVA EPS': 'NEPS', 'SALUD TOTAL': 'STOT', 'MUTUAL SER': 'MSER', 'FAMILIAR': 'FAMI' }
    const regimenCorto: Record<string, string> = { 'CONTRIBUTIVO': 'CON', 'SUBSIDIADO': 'SUB' }
    const servicioCorto: Record<string, string> = {
        'Laboratorio': 'Lab', 'Imágenes': 'Img', 'Consulta Especializada': 'ConsultaEsp',
        'Procedimiento': 'Proc', 'Cirugía': 'Cir', 'Hospitalización': 'Hosp', 'Urgencias': 'Urg', 'Terapias': 'Ter',
        'Consulta Ambulatoria': 'ConsultaAmb', 'Procedimientos Menores': 'ProcMen', 'Imágenes Diagnósticas': 'ImgDiag',
        'Aplicación de medicamentos': 'AppMed', 'Laboratorio clínico': 'LabClin'
    }

    const eps = epsCorta[soporte.eps] || 'EPS'
    const regimen = regimenCorto[soporte.regimen] || 'REG'
    const servicio = servicioCorto[soporte.servicio_prestado] || 'Serv'

    return `${radicado}_${mes}${dia}_${eps}_${regimen}_${servicio}`
}

// ==========================================
// MAIN
// ==========================================

async function main() {
    console.log('🚀 Iniciando RESINCRONIZACIÓN MASIVA a OneDrive...')
    const startDate = '2026-01-15'

    // 1. Obtener Token Graph
    console.log('🔑 Obteniendo token Azure AD...')
    const accessToken = await getGraphAccessToken()

    // 2. Obtener Carpeta Raíz
    let rootFolderId = ONEDRIVE_FOLDER_ID
    if (!rootFolderId) {
        console.log(`📂 Buscando carpeta raíz: ${ONEDRIVE_FOLDER_PATH}`)
        try {
            rootFolderId = await obtenerIdPorPath(accessToken, ONEDRIVE_FOLDER_PATH)
        } catch (e) {
            console.log('⚠️ Carpeta no encontrada. Intentando crearla...')
            try {
                // Obtener ID de la raíz del drive
                const driveUrl = 'https://graph.microsoft.com/v1.0/users/coordinacionmedica@gestarsaludips.com/drive/root'
                const rootResp = await fetch(driveUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } })

                if (!rootResp.ok) throw new Error('No se pudo acceder a la raíz del Drive')
                const rootData = await rootResp.json()

                // Nombre de la carpeta a crear (último segmento del path)
                const segments = ONEDRIVE_FOLDER_PATH.split('/').filter(Boolean)
                const folderName = segments[segments.length - 1] || 'Soportes Facturación'

                console.log(`🔨 Creando carpeta "${folderName}" en la raíz...`)
                const nuevaCarpeta = await crearCarpetaOneDrive(accessToken, folderName, rootData.id)
                rootFolderId = nuevaCarpeta.id
                console.log(`✅ Carpeta creada exitosamente: ${folderName} (${rootFolderId})`)
            } catch (createErr) {
                console.error('❌ Error fatal: No se pudo encontrar ni crear la carpeta raíz.', createErr)
                return
            }
        }
    }
    console.log(`✅ Carpeta raíz ID: ${rootFolderId}`)

    // 3. Obtener Registros
    const { data: registros, error } = await supabase
        .from('soportes_facturacion')
        .select('*')
        .gte('created_at', startDate)
        .order('created_at', { ascending: true })

    if (error || !registros) {
        console.error('❌ Error leyendo Supabase:', error)
        return
    }

    console.log(`📊 Procesando ${registros.length} radicados...`)

    let exitosos = 0
    let fallidos = 0

    for (const soporte of registros) {
        const radicado = soporte.radicado
        console.log(`\n🔄 [${radicado}] Sincronizando...`)

        try {
            // A. Crear Carpeta Radicado
            const nombreCarpeta = generarNombreCarpeta(soporte)
            const carpetaRadicado = await crearCarpetaOneDrive(accessToken, nombreCarpeta, rootFolderId)

            // B. Recopilar y subir archivos
            const categorias = [
                'urls_validacion_derechos', 'urls_autorizacion', 'urls_soporte_clinico',
                'urls_comprobante_recibo', 'urls_orden_medica', 'urls_descripcion_quirurgica',
                'urls_registro_anestesia', 'urls_hoja_medicamentos', 'urls_notas_enfermeria'
            ]

            let archivosSubidos = 0
            for (const cat of categorias) {
                const urls: string[] = soporte[cat] || []

                for (let i = 0; i < urls.length; i++) {
                    const url = urls[i]
                    // Descargar de Supabase
                    const resp = await fetch(url)
                    if (!resp.ok) {
                        console.warn(`  ⚠️ Error descargando archivo Supabase: ${url}`)
                        continue
                    }
                    const buffer = await resp.arrayBuffer()

                    // Extraer nombre real de la URL
                    let nombreArchivo = ''
                    try {
                        const urlObj = new URL(url)
                        nombreArchivo = decodeURIComponent(urlObj.pathname).split('/').pop() || ''
                    } catch (e) { }

                    if (!nombreArchivo) nombreArchivo = `DOC_${radicado}_${i}.pdf`

                    // Subir a OneDrive
                    await subirArchivoOneDrive(accessToken, carpetaRadicado.id, nombreArchivo, buffer)
                    process.stdout.write('.') // Progreso visual
                    archivosSubidos++
                }
            }
            console.log(` OK (${archivosSubidos} archivos)`)

            // C. Actualizar BD
            await supabase.from('soportes_facturacion').update({
                onedrive_folder_id: carpetaRadicado.id,
                onedrive_folder_url: carpetaRadicado.webUrl,
                onedrive_sync_status: 'synced',
                onedrive_sync_at: new Date().toISOString()
            }).eq('id', soporte.id)

            exitosos++
        } catch (err) {
            console.error(`  ❌ Falló radicado ${radicado}:`, err)
            fallidos++
            // Marcar error en BD
            await supabase.from('soportes_facturacion').update({
                onedrive_sync_status: 'failed'
            }).eq('id', soporte.id)
        }
    }

    console.log('\n==========================================')
    console.log(`FIN PROCESO`)
    console.log(`Exitosos: ${exitosos}`)
    console.log(`Fallidos: ${fallidos}`)
    console.log('==========================================')
}

main()
