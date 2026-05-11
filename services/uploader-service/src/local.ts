import { config } from 'dotenv';
config({ path: '.env.localstack' });

import { app } from './app';

async function start() {
    const PORT = process.env.PORT || 3007;

    app.listen(PORT, () => {
        console.log(`🚀 Uploader Service running on http://localhost:${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
}

start().catch(console.error);
