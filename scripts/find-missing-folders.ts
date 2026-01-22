
import dotenv from 'dotenv';
import path from 'path';

// Cargar .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;

async function findFolders() {
    console.log('🕵️‍♀️ Buscando carpetas en OneDrive...');

    // 1. Obtener Token
    const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
    });

    const tokenResp = await fetch(tokenUrl, { method: 'POST', body: params.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const { access_token } = await tokenResp.json();

    const userEmail = 'coordinacionmedica@gestarsaludips.com';
    const driveUrl = `https://graph.microsoft.com/v1.0/users/${userEmail}/drive`;

    // 2. Listar raíz
    console.log('\n📂 Carpetas en la RAÍZ:');
    const rootResp = await fetch(`${driveUrl}/root/children`, { headers: { 'Authorization': `Bearer ${access_token}` } });
    const rootData = await rootResp.json();
    rootData.value?.forEach((item: any) => {
        if (item.folder) console.log(`   - 📁 ${item.name} (ID: ${item.id})`);
    });

    // 3. Revisar carpeta "Documents" si existe (a veces es el nombre interno de la raíz, a veces una carpeta real)
    // Intentaremos buscar "Documents"
    /*
    console.log('\n📂 Buscando dentro de "Documents"...');
    try {
        const docsResp = await fetch(`${driveUrl}/root:/Documents:/children`, { headers: { 'Authorization': `Bearer ${access_token}` } });
        if (docsResp.ok) {
            const docsData = await docsResp.json();
            docsData.value?.forEach((item: any) => {
                if (item.folder) console.log(`   - 📁 ${item.name} (ID: ${item.id})`);
            });
        } else {
            console.log('   (No se pudo acceder a /Documents o no existe)');
        }
    } catch (e) { console.log(e); }
    */
}

findFolders();
