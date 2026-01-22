
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Error: Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY (o SERVICE_ROLE_KEY)')
    console.log('Variables disponibles:', Object.keys(process.env).filter(k => k.includes('SUPABASE')))
    process.exit(1)
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ ADVERTENCIA: Ejecutando con ANON_KEY. Si hay políticas RLS restrictivas, la migración puede fallar o ser incompleta.')
    console.warn('   Se recomienda agregar SUPABASE_SERVICE_ROLE_KEY en .env.local para tareas administrativas.')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ==========================================
// TIPOS Y CONSTANTES
// ==========================================
type CategoriaArchivo =
    | 'validacion_derechos' | 'autorizacion' | 'soporte_clinico'
    | 'comprobante_recibo' | 'orden_medica' | 'descripcion_quirurgica'
    | 'registro_anestesia' | 'hoja_medicamentos' | 'notas_enfermeria'

const CATEGORIAS: CategoriaArchivo[] = [
    'validacion_derechos', 'autorizacion', 'soporte_clinico',
    'comprobante_recibo', 'orden_medica', 'descripcion_quirurgica',
    'registro_anestesia', 'hoja_medicamentos', 'notas_enfermeria'
]

const NIT = '900842629'

// ==========================================
// LÓGICA DE NEGOCIO (REPLICADA)
// ==========================================

function getPrefijoArchivo(eps: string, servicio: string, categoria: CategoriaArchivo): string {
    // 1. Reglas Globales
    if (categoria === 'autorizacion') {
        if (eps === 'SALUD TOTAL') return 'OPF'
        return 'PDE'
    }
    if (categoria === 'comprobante_recibo') return 'CRC'
    if (categoria === 'validacion_derechos') {
        if (eps === 'NUEVA EPS') return 'PDE2'
        return 'OPF'
    }
    if (categoria === 'orden_medica') {
        if (eps === 'FAMILIAR') return 'PDE2'
        return 'PDX'
    }
    if (categoria === 'descripcion_quirurgica') return 'DQX'
    if (categoria === 'registro_anestesia') return 'RAN'
    if (categoria === 'hoja_medicamentos') return 'HAM'
    if (categoria === 'notas_enfermeria') return 'HEV'

    // 2. Reglas Dependientes del Servicio
    if (categoria === 'soporte_clinico') {
        const esImagenOLab = servicio === 'Imágenes Diagnósticas' || servicio === 'Laboratorio clínico'

        if (eps === 'SALUD TOTAL') return esImagenOLab ? 'PDX' : 'HEV'
        if (eps === 'NUEVA EPS') return esImagenOLab ? 'PDX' : 'HEV'
        if (eps === 'FAMILIAR') {
            if (servicio === 'Imágenes Diagnósticas') return 'PDX'
            return 'HEV'
        }
    }

    return 'DOC'
}

function getCategoriaColumnName(categoria: CategoriaArchivo): string {
    const mapping: Record<CategoriaArchivo, string> = {
        'validacion_derechos': 'urls_validacion_derechos',
        'autorizacion': 'urls_autorizacion',
        'soporte_clinico': 'urls_soporte_clinico',
        'comprobante_recibo': 'urls_comprobante_recibo',
        'orden_medica': 'urls_orden_medica',
        'descripcion_quirurgica': 'urls_descripcion_quirurgica',
        'registro_anestesia': 'urls_registro_anestesia',
        'hoja_medicamentos': 'urls_hoja_medicamentos',
        'notas_enfermeria': 'urls_notas_enfermeria',
    }
    return mapping[categoria]
}

// ==========================================
// MAIN
// ==========================================

async function main() {
    const dryRun = process.argv.includes('--dry-run')
    const startDate = '2026-01-15'

    console.log(`🚀 Iniciando migración de nombres de archivos (Desde: ${startDate})`)
    console.log(`🔧 Modo: ${dryRun ? 'DRY-RUN (Simulación)' : 'EJECUCIÓN REAL'}`)

    // 1. Obtener registros
    const { data: registros, error } = await supabase
        .from('soportes_facturacion')
        .select('*')
        .gte('created_at', startDate)

    if (error) {
        console.error('❌ Error obteniendo registros:', error)
        return
    }

    console.log(`📊 Total registros encontrados: ${registros.length}`)

    let procesados = 0
    let errores = 0
    let sinIdentificacion = 0

    for (const row of registros) {
        try {
            const radicado = row.radicado
            const eps = row.eps
            const servicio = row.servicio_prestado
            // Identificación: Prioridad BD. Si no, fallback radicado
            let identificacion = ''
            let usandoFallback = false

            if (row.identificacion) {
                // Formato esperado: TIPO+NUMERO.
                // En BD tenemos tipo_id (ej: 'CC') y identificacion (ej: '123'). Unirlos.
                const tipo = row.tipo_id || ''
                const num = row.identificacion
                // Limpiar tipo
                const tipoLimpio = tipo.replace(/[^a-zA-Z]/g, '').toUpperCase()
                identificacion = `${tipoLimpio}${num}`
            } else {
                identificacion = radicado
                usandoFallback = true
                sinIdentificacion++
            }

            console.log(`\n🔍 Procesando Radicado: ${radicado} | ID: ${identificacion} ${usandoFallback ? '(FALLBACK)' : ''}`)

            let cambiosEnRegistro = false
            const updates: Record<string, string[]> = {}

            // Iterar categorías
            for (const cat of CATEGORIAS) {
                const colName = getCategoriaColumnName(cat)
                const urlsActuales: string[] = row[colName] || []

                if (urlsActuales.length === 0) continue

                const nuevasUrls: string[] = []
                let cambiosEnCategoria = false

                // Iterar archivos de la categoría
                for (let i = 0; i < urlsActuales.length; i++) {
                    const url = urlsActuales[i]

                    // Extraer path del storage desde la URL
                    // URL típica: .../soportes-facturacion/RADICADO/NOMBRE.pdf?...
                    // Necesitamos decodificar por si tiene espacios o caracteres especiales
                    const urlObj = new URL(url)
                    // Path suele ser /storage/v1/object/sign/bucket/path...
                    // Ojo: la estructura de URL firmada de Supabase depende de la versión.
                    // Metodo robusto: buscar el segmento después del bucket 'soportes-facturacion'
                    const pathParts = decodeURIComponent(urlObj.pathname).split('/soportes-facturacion/')
                    if (pathParts.length < 2) {
                        console.warn(`⚠️ URL con formato desconocido: ${url}`)
                        nuevasUrls.push(url)
                        continue
                    }

                    const fullPath = pathParts[1] // RADICADO/NOMBRE.pdf
                    const fileName = fullPath.split('/').pop() || ''
                    const extension = fileName.split('.').pop()?.toLowerCase() || 'pdf'

                    // Calcular nuevo nombre esperado
                    const prefijo = getPrefijoArchivo(eps, servicio, cat)

                    let nuevoNombre = ''
                    if (urlsActuales.length > 1) {
                        nuevoNombre = `${prefijo}_${NIT}_${identificacion}_${i + 1}.${extension}`
                    } else {
                        // Manteniendo lógica del servicio para 1 solo archivo
                        // "Si hay 1 solo archivo, SIN consecutivo" (según lo decidido previamente)
                        // PERO, para evitar colisiones si se ejecuta varias veces o si el nombre ya es ese...
                        // La lógica del servicio decía: if (archivos.length > 1) ... else ...
                        nuevoNombre = `${prefijo}_${NIT}_${identificacion}.${extension}`
                    }

                    const nuevoPath = `${radicado}/${nuevoNombre}`

                    if (fullPath === nuevoPath) {
                        console.log(`  ✅ Archivo ya tiene nombre correcto: ${fileName}`)
                        nuevasUrls.push(url)
                    } else {
                        console.log(`  ✏️ Renombrar: ${fileName} -> ${nuevoNombre}`)
                        cambiosEnRegistro = true
                        cambiosEnCategoria = true

                        if (!dryRun) {
                            // 1. Mover archivo en Storage
                            const { error: moveError } = await supabase.storage
                                .from('soportes-facturacion')
                                .move(fullPath, nuevoPath)

                            if (moveError) {
                                console.error(`  ❌ Error moviendo archivo: ${moveError.message}`)
                                nuevasUrls.push(url) // Conservar URL vieja si falla
                                continue
                            }

                            // 2. Crear nueva URL firmada
                            const { data: urlData, error: signError } = await supabase.storage
                                .from('soportes-facturacion')
                                .createSignedUrl(nuevoPath, 31536000)

                            if (signError || !urlData?.signedUrl) {
                                console.error(`  ❌ Error firmando nueva URL`)
                                // Intentar revertir move? Complejo. Dejamos inconsistencia menor (archivo movido, url vieja rota).
                                // Idealmente revertir.
                                await supabase.storage.from('soportes-facturacion').move(nuevoPath, fullPath)
                                nuevasUrls.push(url)
                            } else {
                                nuevasUrls.push(urlData.signedUrl)
                                console.log(`  ✨ Renombrado OK`)
                            }

                        } else {
                            nuevasUrls.push(url) // Dry run: keep old
                        }
                    }
                } // Fin loop archivos

                if (cambiosEnCategoria) {
                    updates[colName] = nuevasUrls
                }

            } // Fin loop categorías

            // Actualizar DB si hubo cambios
            if (cambiosEnRegistro && !dryRun) {
                const { error: updateError } = await supabase
                    .from('soportes_facturacion')
                    .update(updates)
                    .eq('id', row.id)

                if (updateError) {
                    console.error(`❌ Error actualizando BD para radicado ${radicado}:`, updateError)
                } else {
                    console.log(`💾 DB Actualizada para radicado ${radicado}`)
                    procesados++
                }
            } else if (cambiosEnRegistro && dryRun) {
                console.log(`💾 [DRY-RUN] Se actualizaría DB para radicado ${radicado}`)
            }

        } catch (err) {
            console.error(`🔥 Error procesando registro ${row.id}:`, err)
            errores++
        }
    }

    console.log('\n==========================================')
    console.log(`RESUMEN FINALL`)
    console.log(`Total revisados: ${registros.length}`)
    console.log(`Sin identificación (Usaron Fallback): ${sinIdentificacion}`)
    console.log(`Renombrados/Actualizados: ${procesados}`)
    console.log(`Errores: ${errores}`)
    console.log('==========================================')
}

main()
