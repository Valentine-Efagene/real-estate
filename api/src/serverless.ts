import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import serverlessExpress from '@codegenie/serverless-express'
import { Callback, Handler, Context } from 'aws-lambda';
import { QueryFailedFilter } from './common/common.error';
// import basicAuth from 'express-basic-auth';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const DOCS_PATH = 'docs'
  // const USER = process.env.swagger_user
  // const PASSWORD = process.env.swagger_password

  // app.use([`/${DOCS_PATH}`, `/${DOCS_PATH}-json`], basicAuth({
  //   challenge: true,
  //   users: {
  //     [USER]: PASSWORD,
  //   },
  // }));

  app.enableCors();

  // Register MySQL exception filter globally
  app.useGlobalFilters(new QueryFailedFilter());

  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe());

  const config = new DocumentBuilder()
    .setTitle('mediacraft')
    .setDescription('mediacraft')
    .setVersion('1.0')
    // .addServer('/developer') // Only if you are using subroutes in API Gateway
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(DOCS_PATH, app, document);

  await app.init(); //

  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

// Sort of for caching the function
let server: Handler;

export const handler: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
) => {
  server = server ?? (await bootstrap());
  return server(event, context, callback);
};
