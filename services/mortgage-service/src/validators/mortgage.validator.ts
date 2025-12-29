import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Mortgage schemas - aligned with Prisma schema
export const createMortgageSchema = z
  .object({
    propertyId: z.string().openapi({ example: 'prop_123' }),
    borrowerId: z.string().openapi({ example: 'user_456' }),
    principal: z.number().positive().openapi({ example: 200000 }),
    downPayment: z.number().nonnegative().openapi({ example: 50000 }),
    interestRate: z.number().positive().openapi({ example: 3.5 }),
    termMonths: z.number().int().positive().openapi({ example: 360 }),
    monthlyPayment: z.number().positive().openapi({ example: 898.09 }),
    mortgageTypeId: z.string().optional().openapi({ example: 'type_789' }),
  })
  .openapi('CreateMortgageRequest');

export const updateMortgageSchema = createMortgageSchema.partial().openapi('UpdateMortgageRequest');

export const mortgageResponseSchema = z
  .object({
    id: z.string().openapi({ example: 'mtg_123' }),
    propertyId: z.string(),
    userId: z.string(),
    loanAmount: z.number(),
    interestRate: z.number(),
    termMonths: z.number(),
    mortgageTypeId: z.string(),
    downPaymentAmount: z.number(),
    status: z.string().openapi({ example: 'PENDING' }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('Mortgage');

// Mortgage Type schemas
export const createMortgageTypeSchema = z
  .object({
    name: z.string().min(1).openapi({ example: 'Fixed 30-Year' }),
    description: z.string().optional().openapi({ example: 'Traditional 30-year fixed-rate mortgage' }),
    minInterestRate: z.number().positive().openapi({ example: 2.5 }),
    maxInterestRate: z.number().positive().openapi({ example: 5.0 }),
  })
  .openapi('CreateMortgageTypeRequest');

// Payment schemas - aligned with Payment model
export const createPaymentSchema = z
  .object({
    planId: z.string().openapi({ example: 'plan_123' }),
    amount: z.number().positive().openapi({ example: 1200.50 }),
    principalAmount: z.number().nonnegative().default(0).openapi({ example: 1000 }),
    interestAmount: z.number().nonnegative().default(0).openapi({ example: 200 }),
    lateFeeAmount: z.number().nonnegative().default(0).openapi({ example: 0 }),
    paymentMethod: z.string().openapi({ example: 'BANK_TRANSFER' }),
    payerId: z.string().optional().openapi({ example: 'user_123' }),
    scheduleId: z.string().optional().openapi({ example: 'sched_456' }),
    installmentId: z.string().optional().openapi({ example: 'inst_789' }),
  })
  .openapi('CreatePaymentRequest');

export const paymentResponseSchema = z
  .object({
    id: z.string().openapi({ example: 'pay_123' }),
    mortgageId: z.string(),
    amount: z.number(),
    paymentDate: z.string().datetime(),
    paymentMethod: z.string(),
    status: z.string().openapi({ example: 'COMPLETED' }),
    createdAt: z.string().datetime(),
  })
  .openapi('Payment');

// Downpayment schemas - aligned with MortgageDownpaymentPayment model
export const createDownpaymentSchema = z
  .object({
    planId: z.string().openapi({ example: 'plan_123' }),
    amount: z.number().positive().openapi({ example: 50000 }),
    paymentMethod: z.string().openapi({ example: 'BANK_TRANSFER' }),
    reference: z.string().optional().openapi({ example: 'REF123456' }),
    status: z.string().optional().default('PENDING').openapi({ example: 'PENDING' }),
  })
  .openapi('CreateDownpaymentRequest');

export type CreateMortgageInput = z.infer<typeof createMortgageSchema>;
export type UpdateMortgageInput = z.infer<typeof updateMortgageSchema>;
export type MortgageResponse = z.infer<typeof mortgageResponseSchema>;
export type CreateMortgageTypeInput = z.infer<typeof createMortgageTypeSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentResponse = z.infer<typeof paymentResponseSchema>;
export type CreateDownpaymentInput = z.infer<typeof createDownpaymentSchema>;
