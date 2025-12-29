import { Body, Controller, Get, Param, Post, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MortgageService } from './mortgage.service';
import { CreateMortgageDto, CreateMortgageDocumentDto, CreateMortgageStepDto } from './mortgage.dto';

@Controller('mortgages')
@ApiTags('Mortgage')
export class MortgageController {
    constructor(private readonly mortgageService: MortgageService) { }

    @Post()
    async create(@Body() dto: CreateMortgageDto) {
        return this.mortgageService.create(dto);
    }

    @Get(':id')
    async get(@Param('id', ParseIntPipe) id: number) {
        return this.mortgageService.get(id);
    }

    @Post(':id/documents')
    async addDocument(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateMortgageDocumentDto) {
        return this.mortgageService.addDocument(id, dto);
    }

    @Post(':id/steps')
    async addStep(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateMortgageStepDto) {
        return this.mortgageService.addStep(id, dto);
    }

    @Get(':id/steps')
    async getSteps(@Param('id', ParseIntPipe) id: number) {
        return this.mortgageService.getSteps(id);
    }

    @Post('steps/:stepId/complete')
    async completeStep(@Param('stepId', ParseIntPipe) stepId: number) {
        return this.mortgageService.completeStep(stepId);
    }
}

export default MortgageController;
