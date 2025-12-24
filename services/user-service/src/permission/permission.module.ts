import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionController } from './permission.controller';
import { PermissionService } from './permission.service';
import { PermissionSeeder } from './permission.seeder';
import { Permission, Role } from '@valentine-efagene/qshelter-common';

@Module({
  imports: [TypeOrmModule.forFeature([Permission, Role])],
  providers: [PermissionService, PermissionSeeder],
  controllers: [PermissionController],
  exports: [PermissionService, PermissionSeeder]
})
export class PermissionModule { }
