import { OnQueueEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueJobNames } from './bulk-invite.type';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { S3UploaderService } from '../s3-uploader/s3-uploader.service';
import { User } from '../user/user.entity';
import { AuthService } from '../auth/auth.service';
import { BulkInviteDto } from './bulk-invite.dto';
import { QueueNames, S3Folder } from '../common/common.enum';
import { BulkInviteTask } from './bulk-invite-task.entity';
import { CsvService } from './csv.service';
import { Logger } from '@nestjs/common';

import { readFileSync } from 'fs';
import * as path from 'path'

@Processor(QueueNames.BULK_INVITE)
export class BulkInviteConsumer extends WorkerHost {
    private readonly logger = new Logger(BulkInviteConsumer.name);

    constructor(
        private readonly uploaderService: S3UploaderService,
        private readonly authService: AuthService,
        private readonly dataSource: DataSource,
        private readonly csvService: CsvService,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(BulkInviteTask)
        private readonly bulkInviteTaskRepository: Repository<BulkInviteTask>,
    ) {
        super()
    }

    async process(job: Job<any, any, string>, token?: string): Promise<any> {
        // console.log({ job })
        switch (job.name) {
            case QueueJobNames.BULK_STAFF_INVITE:
                await this.bulkInvite(job, token)
                break;

            case QueueJobNames.TEST:
                await this.test(job, token)
                break

            default:
                break;
        }
    }

    async test(job: Job<string, void, string>, token?: string): Promise<void> {
    }

    async bulkInvite(job: Job<BulkInviteDto, void, string>, token?: string): Promise<any> {
        const { file, userId } = job.data
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        let url: string = null
        const userCreationPromises = []

        try {
            url = await this.uploaderService.uploadFileToS3(file, S3Folder.BULK_INVITES)
            const _task = this.bulkInviteTaskRepository.create({
                url,
                userId,
            })

            const rows = await this.csvService.parseCsv<{ email: string; phone: string, firstName: string }>(file);

            rows.forEach(element => {
                const { email, phone, firstName } = element

                userCreationPromises.push(this.authService.inviteStaff({
                    email,
                    phone,
                    firstName,
                }, queryRunner))
            });

            await queryRunner.manager.save(_task);
            const staff = await Promise.all(userCreationPromises);
            await queryRunner.commitTransaction();
            return staff
        } catch (error) {
            console.error(error);
            await queryRunner.rollbackTransaction();
            await this.uploaderService.deleteFromS3(url);
            throw error;
        } finally {
            await queryRunner.release()
        }
    }

    @OnQueueEvent('active')
    onActive(job: Job) {
        console.log(
            `Processing job ${job.id} of type ${job.name} with data ${job.data}...`,
        );
    }

    @OnQueueEvent('failed')
    handleFailed({ jobId, failedReason }: { jobId: string; failedReason: string }) {
        console.error(`Job ${jobId} failed: ${failedReason}`);
    }

    @OnQueueEvent('completed')
    handleCompleted({ jobId }: { jobId: string }) {
        console.log(`Job ${jobId} completed`);
    }
}