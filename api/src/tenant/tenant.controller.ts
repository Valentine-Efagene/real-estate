import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CreateTenantDto, UpdateTenantDto } from './tenant.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('tenants')
@Controller('tenants')
export class TenantController {
    constructor(private readonly tenantService: TenantService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new tenant' })
    create(@Body() createTenantDto: CreateTenantDto) {
        return this.tenantService.create(createTenantDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all tenants' })
    findAll() {
        return this.tenantService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a tenant by ID' })
    findOne(@Param('id') id: string) {
        return this.tenantService.findOne(+id);
    }

    @Get('subdomain/:subdomain')
    @ApiOperation({ summary: 'Get a tenant by subdomain' })
    findBySubdomain(@Param('subdomain') subdomain: string) {
        return this.tenantService.findBySubdomain(subdomain);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a tenant' })
    update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
        return this.tenantService.update(+id, updateTenantDto);
    }

    @Patch(':id/suspend')
    @ApiOperation({ summary: 'Suspend a tenant' })
    suspend(@Param('id') id: string) {
        return this.tenantService.suspend(+id);
    }

    @Patch(':id/activate')
    @ApiOperation({ summary: 'Activate a tenant' })
    activate(@Param('id') id: string) {
        return this.tenantService.activate(+id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a tenant' })
    remove(@Param('id') id: string) {
        return this.tenantService.remove(+id);
    }
}

export default TenantController;
