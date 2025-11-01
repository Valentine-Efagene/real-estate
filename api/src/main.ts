import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { ValidationPipe } from '@nestjs/common'
import { QueryFailedFilter } from './common/common.error'
import { RoleSeeder } from './role/role.seeder'
import { PermissionSeeder } from './permission/permission.seeder'
import { MortgageTypeSeeder } from './mortgage-type/mortgage-type.seeder'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  //app.setGlobalPrefix('developer/api')
  app.enableCors()

  const roleSeeder = app.get(RoleSeeder)
  await roleSeeder.seed();

  const permissionSeeder = app.get(PermissionSeeder)
  await permissionSeeder.seed();

  const mortgageTypeSeeder = app.get(MortgageTypeSeeder)
  await mortgageTypeSeeder.seed();

  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({
    transform: true
  }))

  // Register MySQL exception filter globally
  app.useGlobalFilters(new QueryFailedFilter())

  const config = new DocumentBuilder()
    .setTitle('Real Estate API')
    .setDescription('The API for Real Estate Management System')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('docs', app, document)

  await app.listen(parseInt(process.env.PORT))
}
bootstrap()
