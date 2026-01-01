import { config } from 'dotenv';
config({ path: '.env.local' });

import { app } from './app';

const port = Number(process.env.PORT ?? 3004);

app.listen(port, () => {
    console.log(`notifications listening on http://localhost:${port}`);
});
