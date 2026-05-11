import { config } from 'dotenv';
config({ path: '.env.localstack' });

import { app } from './app';

async function start() {
    const port = Number(process.env.PORT ?? 3005);

    app.listen(port, () => {
        console.log(`🚀 Payment Service running on http://localhost:${port}`);
        console.log(`📊 Health check: http://localhost:${port}/health`);
    });
}

start().catch(console.error);
