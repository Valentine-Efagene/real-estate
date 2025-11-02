import { OnQueueEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { PaymentReconciliationService } from './payment-reconciliation.service';

@Processor('transactions')
export class TransactionProcessor extends WorkerHost {
    constructor(
        private readonly reconciliationService: PaymentReconciliationService,
    ) {
        super();
    }

    async process(job: Job<{ transactionId: number }, any, string>): Promise<any> {
        const { transactionId } = job.data;
        return this.reconciliationService.reconcileTransactionById(transactionId);
    }

    @OnQueueEvent('failed')
    handleFailed({ jobId, failedReason }: { jobId: string; failedReason: string }) {
        console.error(`Transaction job ${jobId} failed: ${failedReason}`);
    }

    @OnQueueEvent('completed')
    handleCompleted({ jobId }: { jobId: string }) {
        console.log(`Transaction job ${jobId} completed`);
    }
}

export default TransactionProcessor;
