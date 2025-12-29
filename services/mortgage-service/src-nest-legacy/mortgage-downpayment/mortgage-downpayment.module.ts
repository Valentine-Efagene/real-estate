import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MortgageDownpaymentService } from './mortgage-downpayment.service';
import { MortgageDownpaymentPlan, MortgageDownpaymentInstallment, MortgageDownpaymentPayment, Mortgage } from '@valentine-efagene/qshelter-common';
import { MortgageDownpaymentController } from './mortgage-downpayment.controller';

@Module({
    imports: [TypeOrmModule.forFeature([MortgageDownpaymentPlan, MortgageDownpaymentInstallment, MortgageDownpaymentPayment, Mortgage])],
    providers: [MortgageDownpaymentService],
    controllers: [MortgageDownpaymentController],
    exports: [MortgageDownpaymentService],
})
export class MortgageDownpaymentModule { }

export default MortgageDownpaymentModule;
