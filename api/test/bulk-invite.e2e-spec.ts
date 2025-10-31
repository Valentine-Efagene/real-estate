import * as dotenv from 'dotenv'

dotenv.config({ path: '.test.env' })

import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, HttpStatus, Logger } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { MailService } from '../src/mail/mail.service'
import { User } from '../src/user/user.entity'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RoleSeeder } from '../src/role/role.seeder'
import { QueueNames, ResponseMessage } from '../src/common/common.enum'
import { PermissionSeeder } from '../src/permission/permission.seeder'
import { SignInDto } from '../src/auth/auth.dto'
import { CreateUserDto } from '../src/user/user.dto'
import { UserService } from '../src/user/user.service'
import { mockMailService } from './__mocks__/mail.service.mock'
import * as path from 'path'
import { existsSync } from 'fs'
import { BulkInviteConsumer } from '../src/bulk-invite/bulk-invite.consumer'
import { Queue } from 'bullmq'
import { getQueueToken } from '@nestjs/bullmq'
import { S3UploaderService } from '../src/s3-uploader/s3-uploader.service'
import { mockS3UploaderService } from './__mocks__/s3-uploader.service.mock'

describe('BulkInviteController (e2e)', () => {
  const logger = new Logger('Bulk-Invte E2E Tests')
  let app: INestApplication
  let userRepo: Repository<User>
  let admin: User
  let userService: UserService
  let sendEmailVerificationTokenSpy: jest.SpyInstance
  let mailService: MailService
  let bulkInviteQueue: Queue
  let bulkInviteConsumer: BulkInviteConsumer
  let bulkInviteSpy
  let bulkInviteTestSpy

  const testAdminDto: CreateUserDto = {
    email: 'teststaff@example.com',
    password: 'Test@123',
    country: 'Nigeria',
    firstName: 'Test',
    lastName: 'Staff',
    roles: ['admin'],
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mockMailService)
      .overrideProvider(S3UploaderService)
      .useValue(mockS3UploaderService)
      .compile()

    app = moduleFixture.createNestApplication()

    const roleSeeder = app.get(RoleSeeder)
    await roleSeeder.seed()

    const permissionSeeder = app.get(PermissionSeeder)
    await permissionSeeder.seed()

    await app.init()

    userService = moduleFixture.get<UserService>(UserService)
    userRepo = moduleFixture.get<Repository<User>>(getRepositoryToken(User))
    mailService = moduleFixture.get<MailService>(MailService)
    bulkInviteQueue = app.get<Queue>(getQueueToken(QueueNames.BULK_INVITE));
    bulkInviteConsumer = app.get(BulkInviteConsumer);
    bulkInviteSpy = jest.spyOn(bulkInviteConsumer, 'bulkInvite');

    sendEmailVerificationTokenSpy = jest.spyOn(mailService, 'sendEmailVerification')

    admin = await userService.create(testAdminDto)

    await userRepo.update(admin.id, {
      isEmailVerified: true,
      emailVerificationToken: null,
    })
  })

  afterAll(async () => {
    await app.close()
  })

  it('can read sample.csv', () => {
    const filePath = path.resolve(__dirname, '__fixtures__/sample.csv');
    const exists = existsSync(filePath);
    expect(exists).toBe(true);
  });

  it('should send bulk invites', async () => {
    /**
     * Please make sure to shut down any other instance (dev server), 
     * since that will also be watching the queue, and grabbing messages
     */
    const dto: SignInDto = {
      identifier: admin.email,
      password: testAdminDto.password,
    }

    const authRes = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send(dto)

    const token = authRes.body.payload.accessToken
    const filePath = path.resolve(__dirname, '__fixtures__/sample.csv')

    const res = await request(app.getHttpServer())
      .post(`/bulk-invite`)
      .attach('file', filePath)
      .set('Authorization', `Bearer ${token}`)
      .expect(HttpStatus.OK)
    expect(res.body.message).toBe(ResponseMessage.INITIATED)
    // expect(bulkInviteSpy).toHaveBeenCalled()
  })
})
