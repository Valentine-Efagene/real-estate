import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MortgageDownpaymentPlan, DownpaymentPlanStatus } from './mortgage-downpayment.entity';
import { MortgageDownpaymentInstallment, InstallmentStatus } from './mortgage-downpayment-installment.entity';
import { MortgageDownpaymentPayment, DownpaymentPaymentStatus } from './mortgage-downpayment-payment.entity';
import { Mortgage } from '../mortgage/mortgage.entity';
import { Frequency } from 'src/common/common.type';

@Injectable()
export class MortgageDownpaymentService {
    constructor(
        @InjectRepository(MortgageDownpaymentPlan)
        private planRepo: Repository<MortgageDownpaymentPlan>,

        @InjectRepository(MortgageDownpaymentInstallment)
        private installmentRepo: Repository<MortgageDownpaymentInstallment>,

        @InjectRepository(MortgageDownpaymentPayment)
        private paymentRepo: Repository<MortgageDownpaymentPayment>,

        @InjectRepository(Mortgage)
        private mortgageRepo: Repository<Mortgage>,
    ) { }

    async createPlan(mortgageId: number, dto: { totalAmount: number; installmentCount?: number; frequency?: Frequency; startDate?: string }) {
        const mortgage = await this.mortgageRepo.findOneBy({ id: mortgageId });
        if (!mortgage) throw new NotFoundException('Mortgage not found');

        const installmentCount = dto.installmentCount ?? 1;
        const plan = this.planRepo.create({
            mortgageId,
            totalAmount: dto.totalAmount,
            installmentCount,
            frequency: dto.frequency,
            startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
            status: installmentCount > 1 ? DownpaymentPlanStatus.ACTIVE : DownpaymentPlanStatus.PENDING,
        });

        // compute installments evenly
        const base = Math.floor((dto.totalAmount / installmentCount) * 100) / 100;
        const remainder = Math.round((dto.totalAmount - base * installmentCount) * 100) / 100;

        const savedPlan = await this.planRepo.save(plan);

        const installments: MortgageDownpaymentInstallment[] = [];
        for (let i = 0; i < installmentCount; i++) {
            const amount = base + (i === 0 ? remainder : 0);
            const due = new Date(savedPlan.startDate || new Date());
            // naive schedule: monthly increments
            due.setMonth(due.getMonth() + i);

            const inst = this.installmentRepo.create({
                planId: savedPlan.id,
                sequence: i + 1,
                dueDate: due,
                amountDue: amount,
                amountPaid: 0,
                status: InstallmentStatus.PENDING,
            });
            installments.push(inst);
        }

        await this.installmentRepo.save(installments);
        return this.getPlan(savedPlan.id);
    }

    async getPlan(planId: number) {
        return this.planRepo.findOne({ where: { id: planId }, relations: ['installments'] });
    }

    async getPlanByMortgage(mortgageId: number) {
        return this.planRepo.findOne({ where: { mortgageId }, relations: ['installments'] });
    }

    async recordPayment(planId: number, payerId: number | null, amount: number, providerReference?: string) {
        const plan = await this.planRepo.findOne({ where: { id: planId }, relations: ['installments'] });
        if (!plan) throw new NotFoundException('Plan not found');

        // create payment record (completed for now)
        const payment = this.paymentRepo.create({ planId: plan.id, payerId: payerId ?? null, amount, providerReference, status: DownpaymentPaymentStatus.COMPLETED });
        await this.paymentRepo.save(payment);

        let remaining = amount;
        const installments = plan.installments.sort((a, b) => a.sequence - b.sequence);
        for (const inst of installments) {
            if (remaining <= 0) break;
            const toApply = Math.min(remaining, inst.amountDue - inst.amountPaid);
            if (toApply <= 0) continue;
            inst.amountPaid = Number((inst.amountPaid + toApply).toFixed(2));
            remaining = Number((remaining - toApply).toFixed(2));
            if (inst.amountPaid >= inst.amountDue) {
                inst.status = InstallmentStatus.PAID;
                inst.paidAt = new Date();
            } else {
                inst.status = InstallmentStatus.PARTIAL;
            }
            await this.installmentRepo.save(inst);
        }

        // update plan status
        const totalPaid = (await this.paymentRepo.createQueryBuilder('p').where('p.planId = :planId', { planId: plan.id }).select('SUM(p.amount)', 'sum').getRawOne()).sum || 0;
        if (Number(totalPaid) >= plan.totalAmount) {
            plan.status = DownpaymentPlanStatus.COMPLETED;
            await this.planRepo.save(plan);
            // update mortgage downPaymentPaid
            await this.mortgageRepo.update(plan.mortgageId, { downPaymentPaid: Number(totalPaid) });
        } else {
            await this.mortgageRepo.update(plan.mortgageId, { downPaymentPaid: Number(totalPaid) });
        }

        return { payment, plan: await this.getPlan(plan.id) };
    }
}

export default MortgageDownpaymentService;
