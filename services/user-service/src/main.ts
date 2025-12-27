import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule, initializeSecrets } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@valentine-efagene/qshelter-common';

async function bootstrap() {
    const stage = process.env.NODE_ENV || 'dev';
    const configService = ConfigService.getInstance();

    // Load infrastructure config and populate process.env for TypeORM
    const infraConfig = await configService.getInfrastructureConfig(stage);
    process.env.DB_HOST = infraConfig.dbHost;
    process.env.DB_PORT = infraConfig.dbPort.toString();
    process.env.DB_NAME = 'qshelter-' + stage;

    // Load database credentials from Secrets Manager
    const dbSecret = await configService['getSecret'](infraConfig.databaseSecretArn);
    process.env.DB_USERNAME = (dbSecret as any).username;
    process.env.DB_PASSWORD = (dbSecret as any).password;

    // Initialize JWT secrets from SSM/Secrets Manager
    await initializeSecrets();

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
