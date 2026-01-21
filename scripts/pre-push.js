#!/usr/bin/env node

/**
 * Git Pre-Push Hook
 * Genera automáticamente la información de versión antes de cada push
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Obtener la raíz del repositorio Git
const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

console.log('🔄 Actualizando información de versión...');

try {
    // Ejecutar el generador de versión desde la raíz del repo
    execSync('node scripts/generate-version.js', {
        stdio: 'inherit',
        cwd: gitRoot
    });

    // Verificar si hay cambios en version.ts
    const status = execSync('git status --porcelain src/version.ts', {
        encoding: 'utf-8',
        cwd: gitRoot
    }).trim();

    if (status) {
        console.log('📝 Agregando archivo de versión actualizado al commit...');
        execSync('git add src/version.ts', {
            stdio: 'inherit',
            cwd: gitRoot
        });

        // Hacer commit automático si hay cambios
        try {
            execSync('git commit -m "chore: update version info [skip ci]"', {
                stdio: 'inherit',
                cwd: gitRoot
            });
        } catch (e) {
            // Es posible que no haya cambios o ya esté en el commit actual
            console.log('ℹ️  Version info ya actualizada');
        }
    }

    console.log('✅ Version info lista para push');
    process.exit(0);
} catch (error) {
    console.error('❌ Error generando version info:', error.message);
    process.exit(1);
}
