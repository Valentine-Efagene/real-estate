import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Transaction } from '../transaction/transaction.entity';
import { Wallet } from '../wallet/wallet.entity';
import { MortgageDownpaymentPlan } from '../mortgage-downpayment/mortgage-downpayment.entity';
import { MortgageDownpaymentInstallment } from '../mortgage-downpayment/mortgage-downpayment-installment.entity';
import { MortgageDownpaymentPayment } from '../mortgage-downpayment/mortgage-downpayment-payment.entity';
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
