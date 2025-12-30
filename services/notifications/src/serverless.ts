import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { configure as serverlessExpress } from '@vendia/serverless-express';
import { Callback, Handler, Context, SQSEvent } from 'aws-lambda';
import { NotificationExceptionFilter } from './helpers/NotificationExceptionFilter';
import * as basicAuth from 'express-basic-auth';
import { QueryFailedFilter } from './common/common.error';

let cachedServer: Handler;
let cachedApp: INestApplication;

async function bootstrap(event) {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new NotificationExceptionFilter(), new QueryFailedFilter());

  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe());

  if (!event?.Records) {
    const DOCS_PATH = 'docs'
    const USER = process.env.SWAGGER_USER
    const PASSWORD = process.env.SWAGGER_PASSWORD

    app.use([`/${DOCS_PATH}`, `/${DOCS_PATH}-json`], basicAuth({
      challenge: true,
      users: {
        [USER]: PASSWORD,
      },
    }));

    const config = new DocumentBuilder().setTitle('Notification')
      .setDescription('The API for Notification')
      .setVersion('1.0')
      .addBearerAuth()
      .addServer(`/${process.env.BASE_PATH}`) // Prefix in routes (on docs display) endpoint at 
      .build()

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(DOCS_PATH, app, document);
  }

  app.enableCors();

  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  return { expressApp, app }
}

export const handler: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
) => {
  if (!cachedServer || !cachedApp) {
    const { expressApp, app } = await bootstrap(event)
    cachedServer = serverlessExpress({ app: expressApp })
    cachedApp = app
  }
  return cachedServer(event, context, callback);
};
