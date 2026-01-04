import { config } from 'dotenv';
config();

import { app } from './app';

const PORT = process.env.PORT || 3006;

app.listen(PORT, () => {
    console.log(`Documents service running on http://localhost:${PORT}`);
    console.log(`API docs: http://localhost:${PORT}/api-docs`);
});
