import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './role.entity';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { RoleSeeder } from './role.seeder';

@Module({
  imports: [TypeOrmModule.forFeature([Role])],
  providers: [RoleService, RoleSeeder],
  controllers: [RoleController],
  exports: [RoleService, RoleSeeder],
})
export class RoleModule { }
