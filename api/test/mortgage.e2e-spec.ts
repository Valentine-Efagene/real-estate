import * as dotenv from 'dotenv'
dotenv.config({ path: '.test.env' })

import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, HttpStatus, Logger } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { MailService } from '../src/mail/mail.service'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RoleSeeder } from '../src/role/role.seeder'
import { PermissionSeeder } from '../src/permission/permission.seeder'
import { User } from '../src/user/user.entity'
import { UserService } from '../src/user/user.service'
import { mockMailService } from './__mocks__/mail.service.mock'
import { Property } from '../src/property/property.entity'
import { Mortgage } from '../src/mortgage/mortgage.entity'
import { MortgageDocument } from '../src/mortgage/mortgage-document.entity'
import { MortgageStep } from '../src/mortgage/mortgage-step.entity'

describe('Mortgage flow (e2e)', () => {
    const logger = new Logger('Mortgage E2E')
    let app: INestApplication
    let userService: UserService
    let userRepo: Repository<User>
    let propertyRepo: Repository<Property>
    let mortgageRepo: Repository<Mortgage>
    let documentRepo: Repository<MortgageDocument>
    let stepRepo: Repository<MortgageStep>

    const staffDto = {
        email: 'mortgage-staff@example.com',
        password: 'Test@123',
        country: 'Nigeria',
        firstName: 'Mortgage',
        lastName: 'Staff',
        roles: ['admin'],
    }

    const borrowerDto = {
        email: 'borrower@example.com',
        password: 'Test@123',
        country: 'Nigeria',
        firstName: 'Borrower',
        lastName: 'User',
    }

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
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
        propertyRepo = moduleFixture.get<Repository<Property>>(getRepositoryToken(Property))
        mortgageRepo = moduleFixture.get<Repository<Mortgage>>(getRepositoryToken(Mortgage))
        documentRepo = moduleFixture.get<Repository<MortgageDocument>>(getRepositoryToken(MortgageDocument))
        stepRepo = moduleFixture.get<Repository<MortgageStep>>(getRepositoryToken(MortgageStep))

        // create staff and borrower
        const staff = await userService.create(staffDto as any)
        await userRepo.update(staff.id, { isEmailVerified: true, emailVerificationToken: null })

        const borrower = await userService.create(borrowerDto as any)
        await userRepo.update(borrower.id, { isEmailVerified: true, emailVerificationToken: null })
    })

    afterAll(async () => {
        await app.close()
    })

    it('runs a full mortgage flow', async () => {
        // sign in as staff
        const signInRes = await request(app.getHttpServer())
            .post('/auth/sign-in')
            .send({ identifier: staffDto.email, password: staffDto.password })

        expect(signInRes.status).toBe(HttpStatus.OK)
        const token = signInRes.body.payload.accessToken
        expect(token).toBeDefined()

        // create a mortgage type with default steps
        const mtRes = await request(app.getHttpServer())
            .post('/mortgage-types')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Standard Fixed',
                defaultSteps: [
                    { title: 'Application', sequence: 1 },
                    { title: 'Document Collection', sequence: 2 },
                    { title: 'Underwriting', sequence: 3 }
                ],
                requiredDocuments: [{ name: 'ID', required: true }, { name: 'Payslip', required: true }]
            })
            .expect(HttpStatus.CREATED)

        const mortgageTypeId = mtRes.body.id || mtRes.body.payload?.id || mtRes.body?.id
        expect(mortgageTypeId).toBeDefined()

        // create a property directly
        const poster = await userRepo.findOneBy({ email: staffDto.email })
        const property = await propertyRepo.save({
            userId: poster.id,
            title: 'Test Mortgage Property',
            streetAddress: '123 Test St',
            city: 'Lagos',
            state: 'Lagos',
            zipCode: '100001',
            district: 'Ikeja',
            country: 'Nigeria',
            category: 'SALE',
            propertyType: 'HOUSE'
        } as any)

        // create mortgage
        const borrower = await userRepo.findOneBy({ email: borrowerDto.email })
        const createMortgageRes = await request(app.getHttpServer())
            .post('/mortgages')
            .set('Authorization', `Bearer ${token}`)
            .send({ propertyId: property.id, borrowerId: borrower.id, principal: 100000, termMonths: 360, interestRate: 4.5, mortgageTypeId })
            .expect(HttpStatus.OK)

        const mortgage = createMortgageRes.body.payload || createMortgageRes.body
        expect(mortgage).toBeDefined()
        expect(mortgage.id).toBeDefined()
        const mortgageId = mortgage.id

        // placeholder documents should have been created from mortgage type
        expect(Array.isArray(mortgage.documents)).toBe(true)
        expect(mortgage.documents.length).toBeGreaterThanOrEqual(2)
        expect(mortgage.documents.some((d: any) => d.isTemplate)).toBe(true)

        // steps should have been seeded
        const stepsRes = await request(app.getHttpServer())
            .get(`/mortgage-steps?mortgageId=${mortgageId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(HttpStatus.OK)

        const steps = stepsRes.body.payload || stepsRes.body
        expect(Array.isArray(steps)).toBe(true)
        expect(steps.length).toBeGreaterThanOrEqual(3)

        // add a mortgage document
        const docRes = await request(app.getHttpServer())
            .post('/mortgage-documents')
            .set('Authorization', `Bearer ${token}`)
            .send({ mortgageId, fileName: 'contract.pdf', url: 'https://example.com/contract.pdf' })
            .expect(HttpStatus.CREATED)

        const doc = docRes.body.payload || docRes.body
        expect(doc).toBeDefined()

        // complete first step
        const firstStep = steps[0]
        await request(app.getHttpServer())
            .post(`/mortgages/steps/${firstStep.id}/complete`)
            .set('Authorization', `Bearer ${token}`)
            .send({})
            .expect(HttpStatus.OK)

        // fetch mortgage and assert step completed
        const finalRes = await request(app.getHttpServer())
            .get(`/mortgages/${mortgageId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(HttpStatus.OK)

        const fetched = finalRes.body.payload || finalRes.body
        expect(fetched).toBeDefined()
        const fetchedSteps = fetched.steps || (await stepRepo.find({ where: { mortgageId }, order: { sequence: 'ASC' } }))
        expect(fetchedSteps[0].completedAt).toBeDefined()
    }, 20000)
})
