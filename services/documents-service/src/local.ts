import { config } from 'dotenv';
config({ path: '.env.localstack' });

import { setupAuth } from '@valentine-efagene/qshelter-common';
import { app } from './app';

async function start() {
    await setupAuth();
    const PORT = process.env.PORT || 3004;

    app.listen(PORT, () => {
        console.log(`🚀 Documents Service running on http://localhost:${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
}

start().catch(console.error);
