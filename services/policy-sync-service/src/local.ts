/**
 * Local development entry point
 */

import { config } from 'dotenv';
config();

import { app } from './app';

const PORT = process.env.PORT || 3006;

app.listen(PORT, () => {
    console.log(`[Local] Policy Sync Service running on port ${PORT}`);
});
