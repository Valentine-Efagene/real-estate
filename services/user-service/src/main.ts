import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.enableCors();

    // Enable validation globally
    app.useGlobalPipes(new ValidationPipe({
        transform: true
    }));

    const config = new DocumentBuilder()
        .setTitle('User Service API')
        .setDescription('User Authentication and Management Service')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);

    const port = parseInt(process.env.PORT || '3001');
    await app.listen(port);
    console.log(`User Service is running on: http://localhost:${port}`);
    console.log(`Swagger docs available at: http://localhost:${port}/docs`);
}

bootstrap();
