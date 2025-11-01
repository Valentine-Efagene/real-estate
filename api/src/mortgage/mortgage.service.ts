import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mortgage } from './mortgage.entity';
import { MortgageDocument } from './mortgage-document.entity';
import { MortgageStep } from './mortgage-step.entity';
import { CreateMortgageDto, CreateMortgageDocumentDto, CreateMortgageStepDto } from './mortgage.dto';

@Injectable()
export class MortgageService {
    constructor(
        @InjectRepository(Mortgage)
        private readonly mortgageRepo: Repository<Mortgage>,
        @InjectRepository(MortgageDocument)
        private readonly documentRepo: Repository<MortgageDocument>,
        @InjectRepository(MortgageStep)
        private readonly stepRepo: Repository<MortgageStep>,
    ) { }

    async create(dto: CreateMortgageDto): Promise<Mortgage> {
        const m = this.mortgageRepo.create({
            propertyId: dto.propertyId,
            borrowerId: dto.borrowerId,
            principal: dto.principal,
            downPayment: dto.downPayment,
            termMonths: dto.termMonths,
            interestRate: dto.interestRate,
        });
        // Basic monthly payment calc when possible (simple interest approximation)
        if (m.principal && m.termMonths && m.interestRate) {
            const monthlyRate = (m.interestRate / 100) / 12;
            const n = m.termMonths;
            if (monthlyRate > 0) {
                m.monthlyPayment = (m.principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
            }
        }
        return this.mortgageRepo.save(m);
    }

    async get(id: number) {
        const m = await this.mortgageRepo.findOne({ where: { id }, relations: ['documents', 'steps', 'property'] });
        if (!m) throw new NotFoundException('Mortgage not found');
        return m;
    }

    async addDocument(mortgageId: number, dto: CreateMortgageDocumentDto): Promise<MortgageDocument> {
        const doc = this.documentRepo.create({ mortgageId, fileName: dto.fileName, url: dto.url, mimeType: dto.mimeType });
        return this.documentRepo.save(doc);
    }

    async addStep(mortgageId: number, dto: CreateMortgageStepDto): Promise<MortgageStep> {
        const step = this.stepRepo.create({ mortgageId, title: dto.title, description: dto.description, sequence: dto.sequence || 0, isOptional: dto.isOptional || false });
        return this.stepRepo.save(step);
    }

    // Retrieve steps in sequence order; if linked-list pointers exist, they can be traversed separately
    async getSteps(mortgageId: number): Promise<MortgageStep[]> {
        return this.stepRepo.find({ where: { mortgageId }, order: { sequence: 'ASC' } });
    }

    // Mark a step as completed and optionally link to next step
    async completeStep(stepId: number, nextStepId?: number) {
        const step = await this.stepRepo.findOneBy({ id: stepId });
        if (!step) throw new NotFoundException('Step not found');
        step.completedAt = new Date();
        if (nextStepId) {
            step.nextStepId = nextStepId;
        }
        return this.stepRepo.save(step);
    }
}

export default MortgageService;
