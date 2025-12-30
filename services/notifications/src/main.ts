import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NotificationExceptionFilter } from './helpers/NotificationExceptionFilter';
import { ValidationPipe } from '@nestjs/common';

const DOCS_PATH = 'docs'

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalFilters(new NotificationExceptionFilter());

  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Notification Service')
    .setDescription(`
    \nThe API for Notifications.  
    \n
    Note:  
    
    \nIf you get 'forbidden',
    please check that you have authorized the requests  
    (by using the button that says 'Authorize' to pass a token),  
    and check that you are passing a valid user ID (user_id) in the header.  
    By valid, I mean one with the required role.)
        `)
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(DOCS_PATH, app, document);
  // Swagger end

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
