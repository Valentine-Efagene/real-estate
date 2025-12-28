import { app } from './app.js';
import { loadConfig } from './lib/config.js';

async function start() {
    await loadConfig();

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`🚀 User Service V2 running on http://localhost:${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
}

start().catch(console.error);
