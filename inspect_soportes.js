import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// Cargar variables de entorno manualmente porque el script corre fuera del contexto de Vite
const envConfig = dotenv.parse(fs.readFileSync('.env.local'))
const supabaseUrl = envConfig.VITE_SUPABASE_URL
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Faltan credenciales en .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    const radicado = 'AUD15748'
    console.log(`Consultando soportes para ${radicado}...`)

    const { data, error } = await supabase
        .from('back')
        .select('soportes')
        .eq('radicado', radicado)
        .single()

    if (error) {
        console.error('Error:', error)
        return
    }

    if (!data) {
        console.log('No se encontró el caso')
        return
    }

    console.log('Soportes encontrados:')
    if (data.soportes && Array.isArray(data.soportes)) {
        data.soportes.forEach((url, i) => {
            console.log(`[${i}]: ${url}`)
        })
    } else {
        console.log('Campo soportes es vacio o no es array:', data.soportes)
    }
}

main()
