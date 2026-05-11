import { config } from 'dotenv';

// Load .env.localstack BEFORE any other imports to ensure env vars are available
config({ path: '.env.localstack' });

// Use dynamic import to ensure app.ts and its dependencies are loaded AFTER dotenv
async function start() {
    const { app } = await import('./app');

    const port = Number(process.env.PORT ?? 3006);

    app.listen(port, () => {
        console.log(`🚀 Notification Service running on http://localhost:${port}`);
        console.log(`📊 Health check: http://localhost:${port}/health`);
    });
}

start().catch(console.error);
