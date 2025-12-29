import { config } from 'dotenv';
config({ path: '.env.local' });

import { app } from './app.js';

const port = Number(process.env.PORT ?? 3002);

app.listen(port, () => {
    console.log(`property-service listening on http://localhost:${port}`);
});
