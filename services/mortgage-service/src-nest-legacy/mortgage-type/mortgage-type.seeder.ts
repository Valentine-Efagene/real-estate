import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MortgageType } from '@valentine-efagene/qshelter-common';

@Injectable()
export class MortgageTypeSeeder {
    private readonly logger = new Logger(MortgageTypeSeeder.name);

    constructor(
        @InjectRepository(MortgageType)
        private readonly repo: Repository<MortgageType>,
    ) { }

    async seed() {
        const types = [
            {
                name: 'Standard Fixed',
                slug: 'standard-fixed',
                description: 'Typical fixed-rate mortgage',
                defaultSteps: [
                    { title: 'Application', sequence: 1 },
                    { title: 'Document Collection', sequence: 2 },
                    { title: 'Underwriting', sequence: 3 },
                    { title: 'Valuation', sequence: 4 },
                    { title: 'Approval', sequence: 5 },
                    { title: 'Disbursement', sequence: 6 }
                ],
                requiredDocuments: [
                    { name: 'Government ID', required: true },
                    { name: 'Proof of Income', required: true },
                    { name: 'Property Title', required: false }
                ]
            },
            {
                name: 'Interest Only',
                slug: 'interest-only',
                description: 'Interest-only repayment period mortgage',
                defaultSteps: [
                    { title: 'Application', sequence: 1 },
                    { title: 'Document Collection', sequence: 2 },
                    { title: 'Underwriting', sequence: 3 },
                    { title: 'Approval', sequence: 4 },
                    { title: 'Disbursement', sequence: 5 }
                ],
                requiredDocuments: [
                    { name: 'Government ID', required: true },
                    { name: 'Proof of Income', required: true }
                ]
            }
        ];

        for (const t of types) {
            const exists = await this.repo.findOne({ where: { slug: t.slug } });
            if (!exists) {
                const created = this.repo.create(t as any);
                await this.repo.save(created);
                this.logger.log(`Seeded mortgage type: ${t.slug}`);
            }
        }
    }
}

export default MortgageTypeSeeder;
