import { config } from 'dotenv';
config(); // Load .env file

import { app } from './app';

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
    console.log(`🔔 Notification service listening on http://localhost:${port}`);
    console.log(`📧 Office365 Sender: ${process.env.OFFICE365_SENDER_EMAIL}`);
    console.log(`📚 Swagger Docs: http://localhost:${port}/api-docs`);
});
