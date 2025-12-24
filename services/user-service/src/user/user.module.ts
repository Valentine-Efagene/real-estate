import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Role } from '@valentine-efagene/qshelter-common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { RoleModule } from '../role/role.module';
import { UserSeeder } from './user.seeder';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    RoleModule,
  ],
  providers: [UserService, UserSeeder],
  controllers: [UserController],
  exports: [UserService, UserSeeder]
})
export class UserModule { }
