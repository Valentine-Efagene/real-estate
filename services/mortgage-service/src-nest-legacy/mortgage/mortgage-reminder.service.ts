import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Not } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mortgage } from '@valentine-efagene/qshelter-common';
// TODO: Re-enable when MailService is available
// import { MailService } from '../mail/mail.service';

@Injectable()
export class MortgageReminderService {
    private readonly logger = new Logger(MortgageReminderService.name);

    constructor(
        @InjectRepository(Mortgage)
        private readonly mortgageRepo: Repository<Mortgage>,
        // TODO: Use event bus to send notifications instead of direct MailService dependency
        // private readonly mailService: MailService,
    ) { }

    // Run daily at 09:00
    @Cron('0 9 * * *')
    async handleCron() {
        this.logger.log('Running mortgage payment reminder job');

        const today = new Date();
        const mortgages = await this.mortgageRepo.find({ where: { monthlyPayment: Not(null) }, relations: ['borrower'] });

        for (const m of mortgages) {
            if (!m.borrower || !m.borrower.email) continue;

            // Determine billing day from createdAt if available, else skip
            if (!m.createdAt) continue;

            const billingDay = m.createdAt.getDate();

            // Compute next due date as next occurrence of billingDay
            let nextDue = new Date(today.getFullYear(), today.getMonth(), billingDay);
            if (nextDue < today) {
                nextDue = new Date(today.getFullYear(), today.getMonth() + 1, billingDay);
            }

            const diffMs = nextDue.getTime() - today.getTime();
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            // Send reminder if within 3 days and we haven't sent one today
            const shouldSend = diffDays <= 3 && (!m.lastReminderSentAt || new Date(m.lastReminderSentAt).toDateString() !== today.toDateString());

            if (shouldSend) {
                // TODO: Publish event to event bus instead of calling mail service directly
                this.logger.log(`Would send payment reminder for mortgage ${m.id} to ${m.borrower.email}`);
                // try {
                //     await this.mailService.sendPaymentReminder({
                //         name: `${m.borrower.firstName || ''} ${m.borrower.lastName || ''}`.trim(),
                //         receiverEmail: m.borrower.email,
                //         amount: m.monthlyPayment,
                //         dueDate: nextDue.toISOString(),
                //         mortgageId: m.id,
                //     } as any);

                //     m.lastReminderSentAt = new Date();
                //     await this.mortgageRepo.save(m);
                //     this.logger.log(`Sent payment reminder for mortgage ${m.id} to ${m.borrower.email}`);
                // } catch (err) {
                //     this.logger.error(`Failed to send reminder for mortgage ${m.id}: ${err}`);
                // }
            }
        }
    }
}

export default MortgageReminderService;
