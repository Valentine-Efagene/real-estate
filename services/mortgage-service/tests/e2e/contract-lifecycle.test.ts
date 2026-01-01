import request from 'supertest';
import { app } from '../../src/app.js';
import { prisma, testData, cleanupTestData } from '../setup.js';
import { faker } from '@faker-js/faker';

/**
 * E2E Tests: Contract Lifecycle
 * 
 * User Stories:
 * 1. As an admin, I can create reusable payment plan templates
 * 2. As an admin, I can create payment methods with multiple phases
 * 3. As a buyer, I can create a contract from a payment method for a specific unit
 * 4. As a buyer, I can complete documentation steps in a documentation phase
 * 5. As a buyer, I can make payments against installments in a payment phase
 * 6. As a buyer, I can pay ahead to reduce future installments
 */
describe('Contract Lifecycle E2E', () => {
  let paymentPlanId: string;
  let paymentMethodId: string;
  let contractId: string;
  let documentationPhaseId: string;
  let downpaymentPhaseId: string;
  let mortgagePhaseId: string;

  // Test entities created in database
  let testUser: Awaited<ReturnType<typeof testData.createUser>>;
  let testProperty: Awaited<ReturnType<typeof testData.createPropertyWithUnits>>;
  let propertyUnitId: string;
  const totalPrice = 500000; // $500,000 property

  beforeAll(async () => {
    await cleanupTestData();

    // Create real test user
    testUser = await testData.createUser();

    // Create real property with variants and units
    testProperty = await testData.createPropertyWithUnits(testUser.id, {
      variantCount: 2,
      unitsPerVariant: 5,
      price: totalPrice,
    });

    // Get first available unit for testing
    const unit = await prisma.propertyUnit.findFirst({
      where: {
        variant: { propertyId: testProperty.property.id },
        status: 'AVAILABLE',
      },
    });
    propertyUnitId = unit!.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    // Clean up test user and property
    if (testProperty?.property?.id) {
      await prisma.propertyUnit.deleteMany({ where: { variant: { propertyId: testProperty.property.id } } });
      await prisma.propertyVariant.deleteMany({ where: { propertyId: testProperty.property.id } });
      await prisma.property.delete({ where: { id: testProperty.property.id } }).catch(() => { });
    }
    if (testUser?.id) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => { });
    }
  });

  // ============================================================================
  // Story 1: Admin creates payment plan templates
  // ============================================================================
  describe('Story 1: Payment Plan Templates', () => {
    it('should create a monthly payment plan for downpayment', async () => {
      const response = await request(app)
        .post('/payment-plans')
        .send({
          name: 'Monthly Downpayment Plan',
          description: 'Pay downpayment in 6 monthly installments',
          frequency: 'MONTHLY',
          numberOfInstallments: 6,
          interestRate: 0, // No interest on downpayment
          gracePeriodDays: 7,
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.frequency).toBe('MONTHLY');

      // Store for use in payment method
      paymentPlanId = response.body.id;
    });

    it('should create a 30-year mortgage payment plan', async () => {
      const response = await request(app)
        .post('/payment-plans')
        .send({
          name: 'Standard 30-Year Mortgage',
          description: 'Monthly payments over 30 years',
          frequency: 'MONTHLY',
          numberOfInstallments: 360,
          interestRate: 6.5,
          gracePeriodDays: 15,
        });

      expect(response.status).toBe(201);
      expect(response.body.numberOfInstallments).toBe(360);
    });

    it('should list all payment plans', async () => {
      const response = await request(app)
        .get('/payment-plans');

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // Story 2: Admin creates payment methods with phases
  // ============================================================================
  describe('Story 2: Payment Methods with Phases', () => {
    it('should create a payment method with 3 phases', async () => {
      const response = await request(app)
        .post('/payment-methods')
        .send({
          name: 'Standard Mortgage Package',
          description: 'Documentation + 20% Downpayment + 80% Mortgage',
          phases: [
            {
              name: 'KYC Documentation',
              phaseCategory: 'DOCUMENTATION',
              phaseType: 'KYC',
              order: 1,
              percentageOfTotal: 0,
              stepDefinitions: [
                { name: 'Upload ID', stepType: 'UPLOAD', order: 1 },
                { name: 'Verify Income', stepType: 'VERIFICATION', order: 2 },
                { name: 'Credit Check', stepType: 'VERIFICATION', order: 3 },
                { name: 'Sign Agreement', stepType: 'SIGNATURE', order: 4 },
              ],
            },
            {
              name: '20% Downpayment',
              phaseCategory: 'PAYMENT',
              phaseType: 'DOWNPAYMENT',
              order: 2,
              percentageOfTotal: 20,
              paymentPlanId,
            },
            {
              name: '80% Mortgage',
              phaseCategory: 'PAYMENT',
              phaseType: 'MORTGAGE',
              order: 3,
              percentageOfTotal: 80,
              paymentPlanId,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.phases.length).toBe(3);

      paymentMethodId = response.body.id;
    });

    it('should link payment method to a property', async () => {
      const response = await request(app)
        .post(`/payment-methods/${paymentMethodId}/properties`)
        .send({
          propertyId: testProperty.property.id,
          isDefault: true,
        });

      expect(response.status).toBe(201);
    });

    it('should get payment methods for property', async () => {
      const response = await request(app)
        .get(`/payment-methods/property/${testProperty.property.id}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].paymentMethod.id).toBe(paymentMethodId);
    });
  });

  // ============================================================================
  // Story 3: Buyer creates contract from payment method
  // ============================================================================
  describe('Story 3: Contract Creation', () => {
    it('should create a contract from payment method for a specific unit', async () => {
      const response = await request(app)
        .post('/contracts')
        .set('x-user-id', testUser.id)
        .send({
          propertyUnitId,
          buyerId: testUser.id,
          paymentMethodId,
          title: 'Purchase Agreement - Unit A1',
          contractType: 'MORTGAGE',
          totalAmount: totalPrice,
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.contractNumber).toBeDefined();
      expect(response.body.status).toBe('DRAFT');
      expect(response.body.totalAmount).toBe(totalPrice);
      expect(response.body.phases.length).toBe(3);

      contractId = response.body.id;

      // Extract phase IDs
      const phases = response.body.phases;
      documentationPhaseId = phases.find((p: any) => p.phaseType === 'KYC').id;
      downpaymentPhaseId = phases.find((p: any) => p.phaseType === 'DOWNPAYMENT').id;
      mortgagePhaseId = phases.find((p: any) => p.phaseType === 'MORTGAGE').id;
    });

    it('should reserve the unit after contract creation', async () => {
      const unit = await prisma.propertyUnit.findUnique({
        where: { id: propertyUnitId },
      });

      expect(unit?.status).toBe('RESERVED');
      expect(unit?.reservedById).toBe(testUser.id);
    });

    it('should update variant inventory counters', async () => {
      const variant = await prisma.propertyVariant.findFirst({
        where: {
          units: { some: { id: propertyUnitId } },
        },
      });

      expect(variant?.reservedUnits).toBe(1);
      expect(variant?.availableUnits).toBe(4); // Started with 5, 1 reserved
    });

    it('should have correct phase amounts', async () => {
      const response = await request(app)
        .get(`/contracts/${contractId}/phases`);

      expect(response.status).toBe(200);

      const phases = response.body;
      const docPhase = phases.find((p: any) => p.phaseType === 'KYC');
      const downPayPhase = phases.find((p: any) => p.phaseType === 'DOWNPAYMENT');
      const mortPhase = phases.find((p: any) => p.phaseType === 'MORTGAGE');

      expect(docPhase.targetAmount).toBe(0);
      expect(downPayPhase.targetAmount).toBe(100000); // 20% of 500k
      expect(mortPhase.targetAmount).toBe(400000); // 80% of 500k
    });

    it('should have documentation steps for KYC phase', async () => {
      const response = await request(app)
        .get(`/contracts/${contractId}/phases/${documentationPhaseId}`);

      expect(response.status).toBe(200);
      expect(response.body.steps.length).toBe(4);
      expect(response.body.steps.map((s: any) => s.name)).toEqual([
        'UPLOAD_ID',
        'VERIFY_INCOME',
        'CREDIT_CHECK',
        'SIGN_AGREEMENT',
      ]);
    });
  });

  // ============================================================================
  // Story 4: Buyer completes documentation workflow
  // ============================================================================
  describe('Story 4: Documentation Workflow', () => {
    it('should transition contract from DRAFT to PENDING', async () => {
      const response = await request(app)
        .post(`/contracts/${contractId}/transition`)
        .set('x-user-id', testUser.id)
        .send({
          action: 'SUBMIT',
          note: 'Submitting for review',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('PENDING');
    });

    it('should activate the documentation phase', async () => {
      const response = await request(app)
        .post(`/contracts/${contractId}/phases/${documentationPhaseId}/activate`)
        .set('x-user-id', testUser.id)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ACTIVE');
    });

    it('should complete documentation steps one by one', async () => {
      const steps = ['UPLOAD_ID', 'VERIFY_INCOME', 'CREDIT_CHECK', 'SIGN_AGREEMENT'];

      for (const stepName of steps) {
        const response = await request(app)
          .post(`/contracts/${contractId}/phases/${documentationPhaseId}/steps/complete`)
          .set('x-user-id', testUser.id)
          .send({
            stepName,
            note: `Completed ${stepName}`,
          });

        expect(response.status).toBe(200);
      }
    });

    it('should auto-complete documentation phase after all steps', async () => {
      const response = await request(app)
        .get(`/contracts/${contractId}/phases/${documentationPhaseId}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('COMPLETED');
    });
  });

  // ============================================================================
  // Story 5: Buyer makes payments on downpayment phase
  // ============================================================================
  describe('Story 5: Payment Processing', () => {
    it('should activate downpayment phase after documentation completes', async () => {
      const response = await request(app)
        .post(`/contracts/${contractId}/phases/${downpaymentPhaseId}/activate`)
        .set('x-user-id', testUser.id)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ACTIVE');
    });

    it('should generate installments for downpayment phase', async () => {
      const response = await request(app)
        .post(`/contracts/${contractId}/phases/${downpaymentPhaseId}/installments`)
        .set('x-user-id', testUser.id)
        .send({
          startDate: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.installments.length).toBe(6); // 6 monthly installments

      // Each installment should be ~$16,666.67 (100k / 6)
      const firstInstallment = response.body.installments[0];
      expect(firstInstallment.amountDue).toBeCloseTo(16666.67, 0);
    });

    it('should create a payment for first installment', async () => {
      // Get installments first
      const phaseResponse = await request(app)
        .get(`/contracts/${contractId}/phases/${downpaymentPhaseId}`);

      const firstInstallment = phaseResponse.body.installments[0];

      const response = await request(app)
        .post(`/contracts/${contractId}/payments`)
        .set('x-user-id', testUser.id)
        .send({
          phaseId: downpaymentPhaseId,
          installmentId: firstInstallment.id,
          amount: firstInstallment.amountDue,
          paymentMethod: 'BANK_TRANSFER',
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.status).toBe('PENDING');
    });

    it('should process payment callback and complete payment', async () => {
      // Get the pending payment
      const paymentsResponse = await request(app)
        .get(`/contracts/${contractId}/payments`);

      const pendingPayment = paymentsResponse.body.find((p: any) => p.status === 'PENDING');

      // Simulate payment gateway callback
      const response = await request(app)
        .post('/contracts/payments/process')
        .send({
          reference: pendingPayment.reference,
          status: 'COMPLETED',
          gatewayTransactionId: faker.string.uuid(),
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('COMPLETED');
    });

    it('should update phase and contract totals after payment', async () => {
      const phaseResponse = await request(app)
        .get(`/contracts/${contractId}/phases/${downpaymentPhaseId}`);

      expect(phaseResponse.body.paidAmount).toBeCloseTo(16666.67, 0);

      const contractResponse = await request(app)
        .get(`/contracts/${contractId}`);

      expect(contractResponse.body.paidAmount).toBeCloseTo(16666.67, 0);
    });
  });

  // ============================================================================
  // Story 6: Buyer pays ahead
  // ============================================================================
  describe('Story 6: Pay Ahead Feature', () => {
    it('should allow buyer to pay remaining downpayment at once', async () => {
      // Calculate remaining amount (~$83,333.33)
      const phaseResponse = await request(app)
        .get(`/contracts/${contractId}/phases/${downpaymentPhaseId}`);

      const remainingAmount = phaseResponse.body.targetAmount - phaseResponse.body.paidAmount;

      const response = await request(app)
        .post(`/contracts/${contractId}/pay-ahead`)
        .set('x-user-id', testUser.id)
        .send({
          amount: remainingAmount,
        });

      expect(response.status).toBe(200);
      expect(response.body.appliedAmount).toBeCloseTo(remainingAmount, 0);
    });

    it('should auto-complete downpayment phase when fully paid', async () => {
      const response = await request(app)
        .get(`/contracts/${contractId}/phases/${downpaymentPhaseId}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.paidAmount).toBe(100000);
    });

    it('should allow activating mortgage phase after downpayment completes', async () => {
      const response = await request(app)
        .post(`/contracts/${contractId}/phases/${mortgagePhaseId}/activate`)
        .set('x-user-id', testUser.id)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ACTIVE');
    });

    it('should generate mortgage installments with amortization', async () => {
      const response = await request(app)
        .post(`/contracts/${contractId}/phases/${mortgagePhaseId}/installments`)
        .set('x-user-id', testUser.id)
        .send({
          startDate: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.installments.length).toBe(6); // Using same 6-month plan for simplicity

      // With 6.5% annual interest on $400k over 6 months, payments should be higher
      const firstInstallment = response.body.installments[0];
      expect(firstInstallment.amountDue).toBeGreaterThan(66666.67); // Principal + interest
    });
  });

  // ============================================================================
  // Contract Completion
  // ============================================================================
  describe('Contract Completion', () => {
    it('should transition contract to ACTIVE after signing', async () => {
      const response = await request(app)
        .post(`/contracts/${contractId}/sign`)
        .set('x-user-id', testUser.id);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.signedAt).toBeDefined();
    });

    it('should have correct audit trail', async () => {
      const response = await request(app)
        .get(`/contracts/${contractId}`);

      expect(response.status).toBe(200);
      expect(response.body.transitions.length).toBeGreaterThan(0);
    });
  });
});
