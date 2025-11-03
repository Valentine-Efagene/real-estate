import * as dotenv from 'dotenv'
dotenv.config({ path: '.test.env' })

import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, HttpStatus, Logger } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { MailService } from '../src/mail/mail.service'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../src/user/user.entity'
import { mockMailService } from './__mocks__/mail.service.mock'
import { mockS3UploaderService } from './__mocks__/s3-uploader.service.mock'
import { Property } from '../src/property/property.entity'
import { Mortgage } from '../src/mortgage/mortgage.entity'
import { MortgageDownpaymentPlan } from '../src/mortgage-downpayment/mortgage-downpayment.entity'
import { MortgageDownpaymentInstallment } from '../src/mortgage-downpayment/mortgage-downpayment-installment.entity'
import { MortgageDownpaymentPayment } from '../src/mortgage-downpayment/mortgage-downpayment-payment.entity'
import TransactionEntity from '../src/payments/transaction.entity'
import { PaymentReconciliationService } from '../src/payments/payment-reconciliation.service'
import { CreateMortgageDto } from '../src/mortgage/mortgage.dto'

describe('Downpayment reconciliation (e2e)', () => {
    const logger = new Logger('Downpayment E2E')
    let app: INestApplication
    let userRepo: Repository<User>
    let propertyRepo: Repository<Property>
    let mortgageRepo: Repository<Mortgage>
    let planRepo: Repository<MortgageDownpaymentPlan>
    let installmentRepo: Repository<MortgageDownpaymentInstallment>
    let paymentRepo: Repository<MortgageDownpaymentPayment>
    let transactionRepo: Repository<TransactionEntity>
    let reconciliationService: PaymentReconciliationService

    const staffDto = {
        email: 'dp-staff@example.com',
        password: 'Test@123',
        country: 'Nigeria',
        firstName: 'DP',
        lastName: 'Staff',
        roles: ['admin'],
    }

    const borrowerDto = {
        email: 'dp-borrower@example.com',
        password: 'Test@123',
        country: 'Nigeria',
        firstName: 'DP',
        lastName: 'Borrower',
    }

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(MailService)
            .useValue(mockMailService)
            .overrideProvider('S3UploaderService')
            .useValue(mockS3UploaderService)
            .compile()

        app = moduleFixture.createNestApplication()
        await app.init()

        userRepo = moduleFixture.get<Repository<User>>(getRepositoryToken(User))
        propertyRepo = moduleFixture.get<Repository<Property>>(getRepositoryToken(Property))
        mortgageRepo = moduleFixture.get<Repository<Mortgage>>(getRepositoryToken(Mortgage))
        planRepo = moduleFixture.get<Repository<MortgageDownpaymentPlan>>(getRepositoryToken(MortgageDownpaymentPlan))
        installmentRepo = moduleFixture.get<Repository<MortgageDownpaymentInstallment>>(getRepositoryToken(MortgageDownpaymentInstallment))
        paymentRepo = moduleFixture.get<Repository<MortgageDownpaymentPayment>>(getRepositoryToken(MortgageDownpaymentPayment))
        transactionRepo = moduleFixture.get<Repository<TransactionEntity>>(getRepositoryToken(TransactionEntity as any))
        reconciliationService = moduleFixture.get<PaymentReconciliationService>(PaymentReconciliationService)

        // create users
        const staff = await request(app.getHttpServer())
            .post('/auth/sign-up')
            .send(staffDto)

        const borrower = await request(app.getHttpServer())
            .post('/auth/sign-up')
            .send(borrowerDto)

        // mark verified directly
        const staffRow = await userRepo.findOneBy({ email: staffDto.email })
        await userRepo.update(staffRow.id, { isEmailVerified: true, emailVerificationToken: null })
        const borrowerRow = await userRepo.findOneBy({ email: borrowerDto.email })
        await userRepo.update(borrowerRow.id, { isEmailVerified: true, emailVerificationToken: null })
    })

    afterAll(async () => {
        await app.close()
    })

    it('creates a 4-installment downpayment plan and reconciles 4 payments via transactions', async () => {
        // sign in as staff
        const signInRes = await request(app.getHttpServer())
            .post('/auth/sign-in')
            .send({ identifier: staffDto.email, password: staffDto.password })
        expect(signInRes.status).toBe(HttpStatus.OK)
        const token = signInRes.body.payload.accessToken

        // create a mortgage type
        const mtRes = await request(app.getHttpServer())
            .post('/mortgage-types')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'DP Type' })
            .expect(HttpStatus.CREATED)
        const mortgageTypeId = mtRes.body.id || mtRes.body.payload?.id || mtRes.body?.id

        // create property
        const poster = await userRepo.findOneBy({ email: staffDto.email })
        const property = await propertyRepo.save({
            userId: poster.id,
            title: 'DP Property',
            streetAddress: '123 DP St',
            city: 'Lagos',
            state: 'Lagos',
            zipCode: '100001',
            district: 'Ikeja',
            country: 'Nigeria',
            nBedrooms: '3',
            nBathrooms: '2',
            nParkingSpots: '1',
            currency: 'NGN',
            category: 'SALE',
            propertyType: 'HOUSE'
        } as any)

        // create mortgage for borrower
        const borrowerRow = await userRepo.findOneBy({ email: borrowerDto.email })
        const createMortgageDto: CreateMortgageDto = {
            propertyId: property.id,
            borrowerId: borrowerRow.id,
            principal: 100000,
            termMonths: 360,
            interestRate: 4.5,
            mortgageTypeId,
            downPayment: 20000
        }
        const createMortgageRes = await request(app.getHttpServer())
            .post('/mortgages')
            .set('Authorization', `Bearer ${token}`)
            .send(createMortgageDto)
            .expect(HttpStatus.CREATED)

        const mortgage = createMortgageRes.body.payload || createMortgageRes.body
        expect(mortgage).toBeDefined()
        const mortgageId = mortgage.id

        // create downpayment plan with 4 installments (equity paid in 4 installments)
        const total = mortgage.downPayment
        const createPlanRes = await request(app.getHttpServer())
            .post(`/mortgages/${mortgageId}/downpayment-plans`)
            .set('Authorization', `Bearer ${token}`)
            .send({ totalAmount: total, installmentCount: 4 })
            .expect(HttpStatus.CREATED)

        const plan = createPlanRes.body || createPlanRes.body.payload || createPlanRes.body
        // fetch plan via repo to get installments
        const savedPlan = await planRepo.findOne({ where: { id: plan.id }, relations: ['installments', 'mortgage'] })
        expect(savedPlan).toBeDefined()
        expect(savedPlan.installments.length).toBe(4)

        // calculate expected installment amounts
        const amounts = savedPlan.installments.map(i => Number(i.amountDue))
        const sum = amounts.reduce((s, v) => s + v, 0)
        expect(Math.round(sum)).toBe(total)

        // simulate 4 transactions coming from provider for borrowerRow
        for (let i = 0; i < 4; i++) {
            const amt = amounts[i]
            const tx = transactionRepo.create({ provider: 'TEST', providerReference: `tx-${Date.now()}-${i}`, userId: borrowerRow.id, amount: amt, currency: 'NGN', rawPayload: '{}' })
            const savedTx = await transactionRepo.save(tx)

            // call reconciliation directly (in production you'd enqueue a job)
            const res = await reconciliationService.reconcileTransactionById(savedTx.id)
            expect(res.status === 'processed' || res.status === 'already_processed').toBeTruthy()
        }

        // reload installments and plan
        const finalPlan = await planRepo.findOne({ where: { id: savedPlan.id }, relations: ['installments'] })
        expect(finalPlan.status).toBeDefined()
        // all installments should be fully paid (allow status to be PARTIAL/PAID depending on rounding)
        expect(finalPlan.installments.every(i => Number(i.amountPaid) >= Number(i.amountDue))).toBeTruthy()

        // mortgage downPaymentPaid should equal total
        const refreshedMortgage = await mortgageRepo.findOneBy({ id: mortgageId })
        expect(Number(refreshedMortgage.downPaymentPaid)).toBeGreaterThanOrEqual(total)

        // payments should exist
        const payments = await paymentRepo.find({ where: { planId: finalPlan.id } })
        expect(payments.length).toBeGreaterThanOrEqual(4)
    }, 20000)
})
