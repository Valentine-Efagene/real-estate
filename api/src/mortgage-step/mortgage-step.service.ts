import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MortgageStep } from 'src/mortgage/mortgage-step.entity';
import { CreateMortgageStepDto, UpdateMortgageStepDto } from './mortgage-step.dto';

@Injectable()
export class MortgageStepService {
    constructor(
        @InjectRepository(MortgageStep)
        private readonly repo: Repository<MortgageStep>,
    ) { }

    async create(dto: CreateMortgageStepDto) {
        const step = this.repo.create(dto as any);
        return this.repo.save(step);
    }

    async findOne(id: number) {
        const step = await this.repo.findOneBy({ id });
        if (!step) throw new NotFoundException('Step not found');
        return step;
    }

    async findAll(mortgageId?: number) {
        const where = mortgageId ? { mortgageId } : {};
        return this.repo.find({ where, order: { sequence: 'ASC' } });
    }

    async update(id: number, dto: UpdateMortgageStepDto) {
        const step = await this.findOne(id);
        Object.assign(step, dto);
        return this.repo.save(step);
    }

    async remove(id: number) {
        const step = await this.findOne(id);
        await this.repo.remove(step);
        return { deleted: true };
    }
}

export default MortgageStepService;
