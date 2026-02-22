import { config } from 'dotenv';
config({ path: '.env.localstack' });

import { setupAuth } from '@valentine-efagene/qshelter-common';
import { app } from './app';

async function start() {
    await setupAuth();
    const port = Number(process.env.PORT ?? 3002);

    app.listen(port, () => {
        console.log(`🚀 Property Service running on http://localhost:${port}`);
        console.log(`📊 Health check: http://localhost:${port}/health`);
    });
}

start().catch(console.error);
