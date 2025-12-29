import { Body, Controller, Delete, Get, Param, Post, Put, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MortgageStepService } from './mortgage-step.service';
import { CreateMortgageStepDto, UpdateMortgageStepDto } from './mortgage-step.dto';

@Controller('mortgage-steps')
@ApiTags('MortgageStep')
export class MortgageStepController {
    constructor(private readonly svc: MortgageStepService) { }

    @Post()
    async create(@Body() dto: CreateMortgageStepDto) {
        return this.svc.create(dto);
    }

    @Get()
    async list(@Query('mortgageId') mortgageId?: string) {
        const id = mortgageId ? parseInt(mortgageId, 10) : undefined;
        return this.svc.findAll(id);
    }

    @Get(':id')
    async get(@Param('id', ParseIntPipe) id: number) {
        return this.svc.findOne(id);
    }

    @Put(':id')
    async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMortgageStepDto) {
        return this.svc.update(id, dto);
    }

    @Delete(':id')
    async remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }
}

export default MortgageStepController;
