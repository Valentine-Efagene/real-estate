import { Body, Controller, Delete, Get, Param, Post, Put, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MortgageTypeService } from './mortgage-type.service';
import { CreateMortgageTypeDto, UpdateMortgageTypeDto } from './mortgage-type.dto';

@Controller('mortgage-types')
@ApiTags('MortgageType')
export class MortgageTypeController {
    constructor(private readonly svc: MortgageTypeService) { }

    @Post()
    async create(@Body() dto: CreateMortgageTypeDto) {
        return this.svc.create(dto);
    }

    @Get()
    async list() {
        return this.svc.findAll();
    }

    @Get(':id')
    async get(@Param('id', ParseIntPipe) id: number) {
        return this.svc.findOne(id);
    }

    @Put(':id')
    async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMortgageTypeDto) {
        return this.svc.update(id, dto);
    }

    @Delete(':id')
    async remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }
}

export default MortgageTypeController;
