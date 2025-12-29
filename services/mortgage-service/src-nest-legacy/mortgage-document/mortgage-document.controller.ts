import { Body, Controller, Delete, Get, Param, Post, Put, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MortgageDocumentService } from './mortgage-document.service';
import { CreateMortgageDocumentDto, UpdateMortgageDocumentDto } from './mortgage-document.dto';

@Controller('mortgage-documents')
@ApiTags('MortgageDocument')
export class MortgageDocumentController {
    constructor(private readonly svc: MortgageDocumentService) { }

    @Post()
    async create(@Body() dto: CreateMortgageDocumentDto) {
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
    async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMortgageDocumentDto) {
        return this.svc.update(id, dto);
    }

    @Delete(':id')
    async remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }
}

export default MortgageDocumentController;
