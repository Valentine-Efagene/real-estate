import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { S3UploaderModule } from '../s3-uploader/s3-uploader.module';
import { RoleModule } from '../role/role.module';
import { UserSeeder } from './user.seeder';
import { Role } from '../role/role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    S3UploaderModule,
    RoleModule,
  ],
  providers: [UserService, UserSeeder],
  controllers: [UserController],
  exports: [UserService, UserSeeder]
})
export class UserModule { }
