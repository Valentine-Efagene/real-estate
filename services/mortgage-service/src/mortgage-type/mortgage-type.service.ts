import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MortgageType } from './mortgage-type.entity';
import { CreateMortgageTypeDto, UpdateMortgageTypeDto } from './mortgage-type.dto';

@Injectable()
export class MortgageTypeService {
    constructor(
        @InjectRepository(MortgageType)
        private readonly repo: Repository<MortgageType>,
    ) { }

    async create(dto: CreateMortgageTypeDto) {
        const t = this.repo.create(dto as any);
        return this.repo.save(t);
    }

    async findOne(id: number) {
        const t = await this.repo.findOneBy({ id });
        if (!t) throw new NotFoundException('Mortgage type not found');
        return t;
    }

    async findAll() {
        return this.repo.find();
    }

    async update(id: number, dto: UpdateMortgageTypeDto) {
        const t = await this.findOne(id);
        Object.assign(t, dto);
        return this.repo.save(t);
    }

    async remove(id: number) {
        const t = await this.findOne(id);
        await this.repo.remove(t);
        return { deleted: true };
    }
}

export default MortgageTypeService;
