import { config } from 'dotenv';
config({ path: '.env.test' });

import { app } from './app';

async function start() {
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`🚀 User Service V2 running on http://localhost:${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`📖 API Docs: http://localhost:${PORT}/api-docs`);
    });
}

start().catch(console.error);
