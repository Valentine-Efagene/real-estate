import { config } from 'dotenv';
config();
import { app } from './app';

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
    console.log(`Permissions API running on http://localhost:${port}`);
    console.log(`Health: http://localhost:${port}/health`);
    console.log(`Docs: http://localhost:${port}/api-docs`);
});
