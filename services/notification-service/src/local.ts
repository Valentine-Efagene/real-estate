import { config } from 'dotenv';

// Load .env BEFORE any other imports to ensure env vars are available
config();

// Use dynamic import to ensure dotenv is loaded first
async function start() {
    // Dynamic import ensures app.ts and its dependencies are loaded AFTER dotenv
    const { app } = await import('./app');

    const port = Number(process.env.PORT ?? 3001);

    app.listen(port, () => {
        console.log(`🔔 Notification service listening on http://localhost:${port}`);
        console.log(`📧 Office365 Sender: ${process.env.OFFICE365_SENDER_EMAIL}`);
        console.log(`📚 Swagger Docs: http://localhost:${port}/api-docs`);
    });
}

start().catch(console.error);
