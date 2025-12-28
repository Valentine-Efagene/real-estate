import { config } from 'dotenv';
config({ path: '.env.local' });

import { app } from './app';
import { loadConfig } from './lib/config';

async function start() {
    await loadConfig();

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`🚀 User Service V2 running on http://localhost:${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
}

start().catch(console.error);
