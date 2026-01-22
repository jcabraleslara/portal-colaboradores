
import dotenv from 'dotenv';
import path from 'path';

// Cargar .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;

async function testConnection() {
    console.log('🔄 Probando autenticación con Microsoft Graph...');
    console.log(` Tenant ID: ${AZURE_TENANT_ID}`);
    console.log(` Client ID: ${AZURE_CLIENT_ID}`);

    if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_TENANT_ID) {
        console.error('❌ Faltan credenciales en .env.local');
        return;
    }

    const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
    });

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ Error obteniendo token:', error);
            return;
        }

        const data = await response.json();
        const accessToken = data.access_token;
        console.log('✅ Token obtenido exitosamente!');

        // 2. Probar acceso al usuario específico
        const userEmail = 'coordinacionmedica@gestarsaludips.com';
        console.log(`\n🔄 Verificando acceso al drive de: ${userEmail}...`);

        const driveUrl = `https://graph.microsoft.com/v1.0/users/${userEmail}/drive`;
        const driveResponse = await fetch(driveUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!driveResponse.ok) {
            const error = await driveResponse.text();
            console.error(`❌ Error accediendo al drive de ${userEmail}:`, error);
            return;
        }

        console.log('✅ Acceso al drive confirmado!');

    } catch (error) {
        console.error('❌ Error fatal:', error);
    }
}

testConnection();
