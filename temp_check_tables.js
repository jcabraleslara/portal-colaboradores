
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkCitas() {
    // Intentar buscar en 'citas'
    const { data: citas, error: citasError } = await supabase
        .from('citas')
        .select('*')
        .limit(1)

    if (citasError) {
        console.log('Table "citas" not found or error:', citasError.message)
    } else {
        console.log('Table "citas" exists!')
    }

    // Intentar buscar en 'rips'
    const { data: rips, error: ripsError } = await supabase
        .from('rips')
        .select('*')
        .limit(1)

    if (ripsError) {
        console.log('Table "rips" not found or error:', ripsError.message)
    } else {
        console.log('Table "rips" exists!')
    }
}

checkCitas()
