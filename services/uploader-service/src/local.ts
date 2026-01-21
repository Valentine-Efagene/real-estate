import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';

const PORT = process.env.PORT || 3006;

app.listen(PORT, () => {
    console.log(`🚀 Uploader service running on http://localhost:${PORT}`);
    console.log(`📚 API docs: http://localhost:${PORT}/api-docs`);
});
