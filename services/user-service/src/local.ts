import { config } from 'dotenv';
config({ path: '.env.localstack' });

import { app } from './app';

async function start() {
    const PORT = process.env.PORT || 3001;

    app.listen(PORT, () => {
        console.log(`🚀 User Service running on http://localhost:${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`📖 API Docs: http://localhost:${PORT}/api-docs`);
    });
}

start().catch(console.error);
