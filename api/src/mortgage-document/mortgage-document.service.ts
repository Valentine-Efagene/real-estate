import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MortgageDocument } from 'src/mortgage/mortgage-document.entity';
import { CreateMortgageDocumentDto, UpdateMortgageDocumentDto } from './mortgage-document.dto';

@Injectable()
export class MortgageDocumentService {
    constructor(
        @InjectRepository(MortgageDocument)
        private readonly repo: Repository<MortgageDocument>,
    ) { }

    async create(dto: CreateMortgageDocumentDto) {
        const doc = this.repo.create(dto as any);
        return this.repo.save(doc);
    }

    async findOne(id: number) {
        const doc = await this.repo.findOneBy({ id });
        if (!doc) throw new NotFoundException('Document not found');
        return doc;
    }

    async findAll(mortgageId?: number) {
        const where = mortgageId ? { mortgageId } : {};
        return this.repo.find({ where });
    }

    async update(id: number, dto: UpdateMortgageDocumentDto) {
        const doc = await this.findOne(id);
        Object.assign(doc, dto);
        return this.repo.save(doc);
    }

    async remove(id: number) {
        const doc = await this.findOne(id);
        await this.repo.remove(doc);
        return { deleted: true };
    }
}

export default MortgageDocumentService;
