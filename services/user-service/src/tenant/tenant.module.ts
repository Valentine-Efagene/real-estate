import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '@valentine-efagene/qshelter-common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { TenantContextService } from './tenant-context.service';

@Module({
    imports: [TypeOrmModule.forFeature([Tenant])],
    controllers: [TenantController],
    providers: [TenantService, TenantContextService],
    exports: [TenantService, TenantContextService],
})
export class TenantModule { }

export default TenantModule;
