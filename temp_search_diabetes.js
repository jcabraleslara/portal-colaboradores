
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDiabetes() {
    // Buscar en afiliados por ips_primaria
    const { data: afiliados, error: afError, count } = await supabase
        .from('afiliados')
        .select('*', { count: 'exact' })
        .ilike('ips_primaria', '%gestar%cerete%')

    if (afError) {
        console.error('Error afiliados:', afError)
    } else {
        console.log(`Afiliados with Gestar Cerete: ${count}`)
        // Ver si alguno tiene algo de diabetes en algun campo
        const diabetes = afiliados.filter(a => JSON.stringify(a).toLowerCase().includes('diabetes'))
        console.log(`Afiliados with "diabetes" in data: ${diabetes.length}`)
    }

    // Buscar en demanda_inducida
    const { data: demanda, error: demError } = await supabase
        .from('demanda_inducida')
        .select('*')
        .ilike('programa_direccionado', '%diabetes%')

    if (demError) {
        console.log('Error demanda_inducida:', demError.message)
    } else {
        console.log(`Demanda Inducida with "diabetes" in program: ${demanda.length}`)
    }
}

checkDiabetes()
