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
import { ResponseMessage } from '../src/common/common.enum'
import { PermissionSeeder } from '../src/permission/permission.seeder'
import { SignInDto } from '../src/auth/auth.dto'
import { CreateUserDto } from '../src/user/user.dto'
import { UserService } from '../src/user/user.service'
import { getEmailVerificationToken, mockMailService } from './__mocks__/mail.service.mock'

describe('AuthController (e2e)', () => {
  const logger = new Logger('Authentication E2E Tests')
  let app: INestApplication
  let userRepo: Repository<User>
  let staff: User
  let userService: UserService
  let sendEmailVerificationTokenSpy: jest.SpyInstance
  let mailService: MailService

  const testUserDto = {
    email: 'testuser@example.com',
    password: 'Test@123',
    country: 'Nigeria',
    firstName: 'Test',
    lastName: 'User',
    gender: 'male'
  }

  const testStaffDto: CreateUserDto = {
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

    sendEmailVerificationTokenSpy = jest.spyOn(mailService, 'sendEmailVerification')

    staff = await userService.create(testStaffDto)

    await userRepo.update(staff.id, {
      isEmailVerified: true,
      emailVerificationToken: null,
    })
  })

  afterAll(async () => {
    await app.close()
  })

  it('should sign up a user and send verification email', async () => {
    sendEmailVerificationTokenSpy.mockClear()
    const res = await request(app.getHttpServer())
      .post('/auth/sign-up')
      .send(testUserDto)
      .expect(res => {
        if (res.status !== HttpStatus.OK) {
          logger.error(res.body, 'Sign Up Error')
        }
      })
      .expect(HttpStatus.OK)
    expect(res.body.message).toBe(ResponseMessage.USER_SIGNUP_SUCCESSFUL)
    expect(mailService.sendEmailVerification).toHaveBeenCalled()
    expect(getEmailVerificationToken()).toBeDefined()

    const userInDb = await userRepo.findOneOrFail({ where: { email: testUserDto.email } })
    expect(userInDb.isEmailVerified).toBe(false)
    expect(userInDb.emailVerificationToken).toBe(getEmailVerificationToken())
  })

  it('should verify email using token', async () => {
    const res = await request(app.getHttpServer())
      .get(`/auth/verify-email?token=${getEmailVerificationToken()}`)
      .expect(res => {
        if (res.status !== HttpStatus.OK) {
          logger.error(res.body, 'Email Verification Error')
        }
      })
      .expect(HttpStatus.OK)

    expect(res.body.payload.email).toBe(testUserDto.email)

    const verifiedUser = await userRepo.findOneOrFail({ where: { email: testUserDto.email } })
    expect(verifiedUser.isEmailVerified).toBe(true)
  })

  it('should fetch users by a staff', async () => {
    const dto: SignInDto = {
      identifier: staff.email,
      password: testStaffDto.password,
    }

    const authRes = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send(dto)

    const token = authRes.body.payload.accessToken

    const res = await request(app.getHttpServer())
      .get(`/users/paginate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(res => {
        logger.log(res.body, 'Response Body')

        if (res.status !== HttpStatus.OK) {
          logger.error(res.body, 'Feching Users Error')
        }
      })
      .expect(HttpStatus.OK)
    expect(res.body.message).toBe(ResponseMessage.FETCHED)
    expect(res.body.payload.data.length).toBeGreaterThan(0)
  })

  it('fetching users by a user should fail', async () => {
    const dto: SignInDto = {
      identifier: testUserDto.email,
      password: testUserDto.password,
    }

    const authRes = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send(dto)

    const token = authRes.body.payload.accessToken

    const res = await request(app.getHttpServer())
      .get(`/users/paginate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(HttpStatus.FORBIDDEN)
  })

  it('fetch profile', async () => {
    const dto: SignInDto = {
      identifier: testUserDto.email,
      password: testUserDto.password,
    }

    const authRes = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send(dto)

    const token = authRes.body.payload.accessToken

    const res = await request(app.getHttpServer())
      .get(`/users/profile`)
      .set('Authorization', `Bearer ${token}`)
      .expect(HttpStatus.OK)
      .expect(res => {
        expect(res.body.payload.email).toBe(testUserDto.email)
      })
  })
})
