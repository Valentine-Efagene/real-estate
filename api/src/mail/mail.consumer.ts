import { OnQueueEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailService } from './mail.service';
import { SendMailDto, SendPasswordResetMailDto, SendTicketMailDto, SendVerificationMailDto } from './mail.dto';
import { MailQueueJobNames } from './mail.enums';
import { MailerService } from '@nestjs-modules/mailer';
import { ConstantHelper } from '../common/helpers/ConstantHelper';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueNames } from '../common/common.enum';
import { Property } from '../property/property.entity';

@Processor(QueueNames.EMAIL)
export class MailConsumer extends WorkerHost {
    constructor(
        private readonly mailService: MailService,
        private readonly mailerService: MailerService,
        @InjectRepository(Property)
        private readonly propertyRepository: Repository<Property>,
    ) {
        super()
    }

    async process(job: Job<any, any, string>, token?: string): Promise<any> {
        switch (job.name) {
            case MailQueueJobNames.SEND:
                await this.sendTestMail(job, token)
                break;

            case MailQueueJobNames.SEND_VERIFICATION_MESSAGE:
                await this.sendVerificationMail(job, token)
                break;

            case MailQueueJobNames.SEND_PASSWORD_RESET_MESSAGE:
                await this.sendPasswordResetMail(job, token)
                break;

            default:
                break;
        }
    }

    async sendTestMail(job: Job<SendMailDto, void, string>, token?: string): Promise<any> {
        await this.mailService.send(job.data)
    }

    async sendVerificationMail(job: Job<SendVerificationMailDto, void, string>, token?: string): Promise<any> {
        const dto: SendVerificationMailDto = job.data

        try {
            const response = await this.mailerService.sendMail({
                to: dto.receiverEmail,
                subject: 'Verification Email',
                template: './email-verification',
                context: {
                    name: dto.name,
                    link: dto.link,
                    ...ConstantHelper.mailConstants,
                    socialLinks: ConstantHelper.socialLinks,
                }
            })

            console.log('SMTP Response:', response)
        } catch (error) {
            console.log(error)
            throw error
        }
    }

    async sendPasswordResetMail(job: Job<SendPasswordResetMailDto, void, string>, token?: string): Promise<any> {
        const dto: SendPasswordResetMailDto = job.data

        try {
            const response = await this.mailerService.sendMail({
                to: dto.receiverEmail,
                subject: 'Verification Email',
                template: './password-reset',
                context: {
                    resetUrl: dto.resetUrl,
                    name: dto.name,
                    ...ConstantHelper.mailConstants,
                    socialLinks: ConstantHelper.socialLinks,
                }
            })

            console.log('SMTP Response:', response)
        } catch (error) {
            console.log(error)
            throw error
        }
    }

    @OnQueueEvent('active')
    onActive(job: Job) {
        console.log(
            `Processing job ${job.id} of type ${job.name} with data ${job.data}...`,
        );
    }
}