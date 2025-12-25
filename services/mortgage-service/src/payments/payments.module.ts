import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Transaction } from '@valentine-efagene/qshelter-common';
import { Wallet } from '@valentine-efagene/qshelter-common';
import { MortgageDownpaymentPlan, MortgageDownpaymentInstallment, MortgageDownpaymentPayment } from '@valentine-efagene/qshelter-common';
import { Mortgage } from '@valentine-efagene/qshelter-common';
import { User } from '@valentine-efagene/qshelter-common';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import TransactionProcessor from './transaction.processor';

@Module({
    imports: [
        TypeOrmModule.forFeature([Transaction, Wallet, MortgageDownpaymentPlan, MortgageDownpaymentInstallment, MortgageDownpaymentPayment, Mortgage, User]),
        BullModule.registerQueue({ name: 'transactions' }),
    ],
    providers: [PaymentReconciliationService, TransactionProcessor],
    exports: [PaymentReconciliationService],
})
export class PaymentsModule { }

export default PaymentsModule;
