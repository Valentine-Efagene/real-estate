import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { RoleSeeder } from './role.seeder';
import { Role } from '@valentine-efagene/qshelter-common';

@Module({
  imports: [TypeOrmModule.forFeature([Role])],
  providers: [RoleService, RoleSeeder],
  controllers: [RoleController],
  exports: [RoleService, RoleSeeder],
})
export class RoleModule { }
