import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MortgageDownpaymentService } from './mortgage-downpayment.service';
import { MortgageDownpaymentPlan } from './mortgage-downpayment.entity';
import { MortgageDownpaymentInstallment } from './mortgage-downpayment-installment.entity';
import { MortgageDownpaymentPayment } from './mortgage-downpayment-payment.entity';
import { MortgageDownpaymentController } from './mortgage-downpayment.controller';
import { Mortgage } from '../mortgage/mortgage.entity';

@Module({
    imports: [TypeOrmModule.forFeature([MortgageDownpaymentPlan, MortgageDownpaymentInstallment, MortgageDownpaymentPayment, Mortgage])],
    providers: [MortgageDownpaymentService],
    controllers: [MortgageDownpaymentController],
    exports: [MortgageDownpaymentService],
})
export class MortgageDownpaymentModule { }

export default MortgageDownpaymentModule;
