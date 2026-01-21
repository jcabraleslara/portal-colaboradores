#!/usr/bin/env node

/**
 * Script para generar información de versión automáticamente
 * Ejecutado antes de cada build para mantener la versión actualizada
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getGitInfo() {
    try {
        // Obtener el hash del último commit
        const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

        // Obtener la fecha del último commit en GMT-5 (Colombia)
        const commitDate = execSync('git log -1 --format=%ci', { encoding: 'utf-8' }).trim();

        // Convertir a formato legible en zona horaria de Colombia (GMT-5)
        const date = new Date(commitDate);
        const colombiaDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Bogota' }));

        // Formatear: DD/MM/YYYY HH:mm
        const day = String(colombiaDate.getDate()).padStart(2, '0');
        const month = String(colombiaDate.getMonth() + 1).padStart(2, '0');
        const year = colombiaDate.getFullYear();
        const hours = String(colombiaDate.getHours()).padStart(2, '0');
        const minutes = String(colombiaDate.getMinutes()).padStart(2, '0');

        const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}`;

        return {
            version: '1.0',
            commitHash,
            buildDate: formattedDate,
            buildTimestamp: colombiaDate.toISOString(),
        };
    } catch (error) {
        console.warn('⚠️  No se pudo obtener información de Git, usando valores por defecto');
        const now = new Date();
        const colombiaDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));

        const day = String(colombiaDate.getDate()).padStart(2, '0');
        const month = String(colombiaDate.getMonth() + 1).padStart(2, '0');
        const year = colombiaDate.getFullYear();
        const hours = String(colombiaDate.getHours()).padStart(2, '0');
        const minutes = String(colombiaDate.getMinutes()).padStart(2, '0');

        return {
            version: '1.0',
            commitHash: 'dev',
            buildDate: `${day}/${month}/${year} ${hours}:${minutes}`,
            buildTimestamp: colombiaDate.toISOString(),
        };
    }
}

const buildInfo = getGitInfo();

const content = `// Auto-generado - NO EDITAR MANUALMENTE
// Generado el: ${buildInfo.buildDate}

export const BUILD_INFO = {
    version: '${buildInfo.version}',
    commitHash: '${buildInfo.commitHash}',
    buildDate: '${buildInfo.buildDate}',
    buildTimestamp: '${buildInfo.buildTimestamp}',
} as const;

export default BUILD_INFO;
`;

const outputPath = join(__dirname, '..', 'src', 'version.ts');
writeFileSync(outputPath, content, 'utf-8');

console.log('✅ Version info generada:');
console.log(`   Version: v${buildInfo.version}`);
console.log(`   Commit: ${buildInfo.commitHash}`);
console.log(`   Fecha: ${buildInfo.buildDate} GMT-5`);
