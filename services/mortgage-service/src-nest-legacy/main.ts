import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.enableCors();

    app.useGlobalPipes(new ValidationPipe({
        transform: true
    }));

    const config = new DocumentBuilder()
        .setTitle('Mortgage Service API')
        .setDescription('Mortgage Management and Processing Service')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);

    const port = parseInt(process.env.PORT || '3002');
    await app.listen(port);
    console.log(`Mortgage Service is running on: http://localhost:${port}`);
    console.log(`Swagger docs available at: http://localhost:${port}/docs`);
}

bootstrap();
