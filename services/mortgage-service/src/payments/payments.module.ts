import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Transaction } from '../transaction/transaction.entity';
import { Wallet } from '../wallet/wallet.entity';
import { MortgageDownpaymentPlan, MortgageDownpaymentInstallment, MortgageDownpaymentPayment } from '@valentine-efagene/qshelter-common';
import { Mortgage } from '../mortgage/mortgage.entity';
import { User } from '../user/user.entity';
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
