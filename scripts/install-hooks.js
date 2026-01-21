#!/usr/bin/env node

/**
 * Script para instalar Git hooks automáticamente
 * Se ejecuta después de npm install
 */

import { copyFileSync, chmodSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const hooksDir = join(projectRoot, '.git', 'hooks');

// Verificar si estamos en un repositorio git
if (!existsSync(join(projectRoot, '.git'))) {
    console.log('⚠️  No es un repositorio Git, saltando instalación de hooks');
    process.exit(0);
}

// Crear directorio de hooks si no existe
if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
}

try {
    // Copiar pre-push hook
    const prePushSource = join(__dirname, 'pre-push.js');
    const prePushDest = join(hooksDir, 'pre-push');

    copyFileSync(prePushSource, prePushDest);

    // Hacer ejecutable en sistemas Unix
    if (process.platform !== 'win32') {
        chmodSync(prePushDest, 0o755);
    }

    console.log('✅ Git hooks instalados correctamente');
    console.log('   - pre-push: Actualiza version.ts automáticamente');
} catch (error) {
    console.error('❌ Error instalando Git hooks:', error.message);
    process.exit(1);
}
