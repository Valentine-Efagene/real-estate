import * as dotenv from 'dotenv'

dotenv.config({ path: '.test.env' })

import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, HttpStatus } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { MailService } from '../src/mail/mail.service'
import { User } from '../src/user/user.entity'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RoleSeeder } from '../src/role/role.seeder'
import { PermissionSeeder } from '../src/permission/permission.seeder'
import { SignInDto } from '../src/auth/auth.dto'
import { CreateUserDto } from '../src/user/user.dto'
import { UserService } from '../src/user/user.service'
import { mockMailService } from './__mocks__/mail.service.mock'
import { Property } from '../src/property/property.entity'
import { CreatePropertyControllerDto, SetDisplayImageDto } from '../src/property/property.dto'
import { faker } from '@faker-js/faker';
import { Currency, ResponseMessage } from '../src/common/common.enum'
import { S3UploaderService } from '../src/s3-uploader/s3-uploader.service'
import { mockS3UploaderService } from './__mocks__/s3-uploader.service.mock'
import * as path from 'path'
import { existsSync } from 'fs'
import { PropertyMedia } from 'src/property-media/property-media.entity'
import { StandardApiResponse } from 'src/common/common.dto'
import { Paginated } from 'nestjs-paginate'
import { PropertyType } from '../src/property/property.enums'

describe('AuthController (e2e)', () => {
  let app: INestApplication
  let userRepo: Repository<User>
  let staff: User
  let testUser: User
  let testUser2: User
  let property: Property
  let userService: UserService
  let staffToken: string
  let userToken: string
  let user2Token: string
  let propertyRepository: Repository<Property>
  let propertyMedia: PropertyMedia[]
  let friend = {
    guestEmail: 'susannefriend@testmail.com',
    guestFirstName: 'Susanne',
    guestLastName: 'Friend'
  }

  const testUserDto = {
    email: 'testuser@example.com',
    password: 'Test@123',
    country: 'Nigeria',
    firstName: 'Test',
    lastName: 'User',
    gender: 'male'
  }

  const testUser2Dto = {
    email: 'testuser2@example.com',
    password: 'Test@123',
    country: 'Nigeria',
    firstName: 'Test',
    lastName: 'User2',
    gender: 'female'
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
      .overrideProvider(S3UploaderService)
      .useValue(mockS3UploaderService)
      .compile()

    app = moduleFixture.createNestApplication()

    const roleSeeder = app.get(RoleSeeder)
    await roleSeeder.seed()

    const permissionSeeder = app.get(PermissionSeeder)
    await permissionSeeder.seed()

    // const ticketCategorySeeder = app.get(TicketCategorySeeder)
    // await ticketCategorySeeder.seed()

    await app.init()

    userService = moduleFixture.get<UserService>(UserService)
    userRepo = moduleFixture.get<Repository<User>>(getRepositoryToken(User))
    propertyRepository = moduleFixture.get<Repository<Property>>(getRepositoryToken(Property))

    // Authorization test is already handled in the app.e2e-spec.ts
    // so we can skip the seeding of test user here
    testUser = await userService.create(testUserDto)

    userRepo.update(testUser.id, {
      isEmailVerified: true,
      emailVerificationToken: null,
    })

    testUser2 = await userService.create(testUser2Dto)

    userRepo.update(testUser2.id, {
      isEmailVerified: true,
      emailVerificationToken: null,
    })

    staff = await userService.create(testStaffDto)

    userRepo.update(staff.id, {
      isEmailVerified: true,
      emailVerificationToken: null,
    })
  })

  afterAll(async () => {
    await app.close()
  })

  it('Staff creates property', async () => {
    const dto: SignInDto = {
      identifier: staff.email,
      password: testStaffDto.password,
    }

    const authRes = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send(dto)

    staffToken = authRes.body.payload.accessToken

    const createEventDto: CreatePropertyControllerDto = {
      gallery: [],
      title: 'Test Event',
      streetAddress: faker.location.streetAddress(),
      city: faker.location.city(),
      zipCode: faker.location.zipCode(),
      state: faker.location.state(),
      country: faker.location.country(),
      description: faker.definitions.commerce.product_description[0],
      userId: 0,
      district: '',
      category: '',
      propertyType: PropertyType.APARTMENT
    }

    const res = await request(app.getHttpServer())
      .post(`/properties`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(createEventDto)
      .expect(HttpStatus.CREATED)

    property = res.body.payload
  })

  it('can read sample.jpg', () => {
    const filePath = path.resolve(__dirname, '__fixtures__/sample.jpg');
    const exists = existsSync(filePath);
    expect(exists).toBe(true);
  });

  it('Staff uploads media to property', async () => {
    const filePath = path.resolve(__dirname, '__fixtures__/sample.jpg')

    const res = await request(app.getHttpServer())
      .post(`/properties/${property.id}/media`)
      .set('Authorization', `Bearer ${staffToken}`)
      // .field('someExtraField', 'value')
      .attach('media', filePath)
      .attach('media', filePath)
      .expect(HttpStatus.CREATED);

    const media = res.body.payload;
    propertyMedia = media
    expect(Array.isArray(media)).toBe(true);
    expect(media.length).toBe(2)
    expect(media[0]).toHaveProperty('url');
    expect(media[0]).toHaveProperty('mimeType');
    expect(media[0]).toHaveProperty('size');
  });

  it('Anyone can fetch paginated property media', async () => {
    const res = await request(app.getHttpServer())
      .get(`/properties/${property.id}/media?page=1&limit=10`)
      .expect(HttpStatus.OK);

    expect(res.body.message).toBe(ResponseMessage.FETCHED);
    const data = res.body.payload;
    expect(data).toHaveProperty('data');
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBe(2)
    if (data.data.length) {
      expect(data.data[0]).toHaveProperty('url');
      expect(data.data[0]).toHaveProperty('mimeType');
      expect(data.data[0]).toHaveProperty('size');
    }
  });

  it('can fetch one property media', async () => {
    const res = await request(app.getHttpServer())
      .get(`/property-media/1`)
      .expect(HttpStatus.OK)
  })

  it('can delete property media', async () => {
    const targetMedia = PropertyMedia[1]
    const response = await request(app.getHttpServer())
      .delete(`/property-media/${targetMedia.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(HttpStatus.OK)

    expect(response.body.message).toBe(ResponseMessage.DELETED)

    await request(app.getHttpServer())
      .get(`/property-media/${targetMedia.id}`)
      .expect(HttpStatus.NOT_FOUND)
  })

  it('set property display image', async () => {
    const targetMedia = PropertyMedia[0]
    const dto: SetDisplayImageDto = {
      propertyMediaId: targetMedia.id
    }
    const response = await request(app.getHttpServer())
      .post(`/properties/${property.id}/set-display-image`)
      .send(dto)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(HttpStatus.OK)

    expect(response.body.message).toBe(ResponseMessage.UPDATED)

    const updatedProperty = await propertyRepository.findOne({
      where: {
        id: property.id
      },
      relations: ['displayImage']
    })

    expect(updatedProperty.displayImage.id).toBe(targetMedia.id)
  })

  it('Anybody lists properties', async () => {
    const response = await request(app.getHttpServer())
      .get(`/properties/paginate`)
      .expect(HttpStatus.OK)

    const properties: Event[] = response.body.payload.data
    expect(response.body.message).toBe(ResponseMessage.FETCHED)
    expect(properties.length).toBe(1)
  })

  it('User signs in', async () => {
    const userSignInRes = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({
        identifier: testUser.email,
        password: testUserDto.password,
      })

    userToken = userSignInRes.body.payload.accessToken

    const user2SignInRes = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({
        identifier: testUser2.email,
        password: testUser2Dto.password,
      })

    user2Token = user2SignInRes.body.payload.accessToken
  })
})
