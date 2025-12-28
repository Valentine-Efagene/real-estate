#!/usr/bin/env node

import { readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const modelsDir = join(__dirname, '../generated/client/models');

try {
    const files = readdirSync(modelsDir)
        .filter(file => file.endsWith('.ts') && file !== 'index.ts')
        .map(file => file.replace('.ts', ''));

    const exports = files.map(file => `export * from './${file}';`).join('\n');

    writeFileSync(join(modelsDir, 'index.ts'), exports + '\n');

    console.log(`✅ Generated models/index.ts with ${files.length} exports`);
} catch (error) {
    console.error('❌ Failed to generate models/index.ts:', error.message);
    process.exit(1);
}
