import { OnQueueEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailService } from './mail.service';
import { SendMailDto, SendPasswordResetMailDto, SendTicketMailDto, SendVerificationMailDto } from './mail.dto';
import { MailQueueJobNames } from './mail.enums';
import { MailerService } from '@nestjs-modules/mailer';
import { ConstantHelper } from '../common/helpers/ConstantHelper';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket } from '../ticket/ticket.entity';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import EmailHelper from '../common/helpers/EmailHelper';
import { QueueNames } from '../common/common.enum';

@Processor(QueueNames.EMAIL)
export class MailConsumer extends WorkerHost {
    constructor(
        private readonly mailService: MailService,
        private readonly mailerService: MailerService,
        @InjectRepository(Ticket)
        private readonly ticketRepository: Repository<Ticket>,
    ) {
        super()
    }

    async process(job: Job<any, any, string>, token?: string): Promise<any> {
        switch (job.name) {
            case MailQueueJobNames.SEND:
                await this.sendTestMail(job, token)
                break;

            case MailQueueJobNames.SEND_TICKET:
                await this.sendTicketMail(job, token)
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

    async sendTicketMail(job: Job<SendTicketMailDto, void, string>, token?: string): Promise<any> {
        const dto: SendTicketMailDto = job.data
        const ticket = await this.ticketRepository.findOne({
            where: {
                id: dto.ticketId,
            },
            relations: {
                user: true,
                eventTicketType: true
            }
        })

        if (!ticket) {
            throw new BadRequestException(`Ticket with ID ${dto.ticketId} not found.`)
        }

        const ticketTemplate = await EmailHelper.compileStringTemplate(ticket.eventTicketType.template, {
            name: `${ticket.guestFirstName ?? ''} ${ticket.guestLastName ?? ''}`,
            qrCodeUrl: ticket.qrCodeImage,
        })

        try {
            const response = await this.mailerService.sendMail({
                to: ticket.guestEmail,
                subject: 'Event Invitation',
                template: './invitation',
                context: {
                    name: ticket.guestFirstName,
                    ticketTemplate,
                    senderName: ticket.user.firstName,
                    ...ConstantHelper.mailConstants,
                    socialLinks: ConstantHelper.socialLinks,
                    message: '',
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