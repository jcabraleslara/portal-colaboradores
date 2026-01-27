
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function getCount() {
    const { count, error } = await supabase
        .from('citas')
        .select('*', { count: 'exact', head: true })

    if (error) {
        console.error('Error:', error)
    } else {
        console.log('Count:', count)
    }
}

getCount()
