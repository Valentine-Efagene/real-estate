import { prisma } from '../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Installment Generation Service
// =============================================================================
// Handles automatic generation of installments when a payment phase is activated.
// Triggered by PAYMENT_PHASE_ACTIVATED events from mortgage-service.
// =============================================================================

export interface GenerateInstallmentsInput {
    phaseId: string;
    applicationId: string;
    tenantId: string;
    paymentPhaseId: string;
    totalAmount: number;
    interestRate: number;
    numberOfInstallments: number | null;
    paymentPlanId: string;
    startDate: string;
    userId: string;
}

interface CalculatedInstallment {
    installmentNumber: number;
    amount: number;
    principalAmount: number;
    interestAmount: number;
    dueDate: Date;
}

/**
 * Calculate the interval in days between installments based on frequency
 */
function getIntervalDays(plan: { paymentFrequency: string; frequencyMultiplier?: number | null; customFrequencyDays: number | null }): number {
    const multiplier = plan.frequencyMultiplier ?? 1;
    switch (plan.paymentFrequency) {
        case 'MONTHLY':
            return 30 * multiplier;
        case 'BIWEEKLY':
            return 14 * multiplier;
        case 'WEEKLY':
            return 7 * multiplier;
        case 'ONE_TIME':
            return 0;
        case 'MINUTE':
            // For testing: returns fractional days (1 minute ≈ 0.000694 days)
            return (1 / 1440) * multiplier;
        case 'CUSTOM':
            return (plan.customFrequencyDays ?? 30) * multiplier;
        default:
            return 30 * multiplier;
    }
}

/**
 * Calculate installments using standard amortization formula
 */
function calculateInstallments(
    principal: number,
    annualRate: number,
    count: number,
    startDate: Date,
    intervalDays: number,
    gracePeriodDays: number
): CalculatedInstallment[] {
    const installments: CalculatedInstallment[] = [];

    if (count === 1) {
        // One-time payment
        installments.push({
            installmentNumber: 1,
            amount: principal,
            principalAmount: principal,
            interestAmount: 0,
            dueDate: startDate,
        });
        return installments;
    }

    // Calculate periodic rate based on interval
    let periodsPerYear: number;
    if (intervalDays === 30) {
        periodsPerYear = 12; // Standard monthly
    } else if (intervalDays === 14) {
        periodsPerYear = 26; // Biweekly
    } else if (intervalDays === 7) {
        periodsPerYear = 52; // Weekly
    } else {
        periodsPerYear = intervalDays > 0 ? 365 / intervalDays : 12;
    }
    const periodicRate = annualRate / 100 / periodsPerYear;

    // Calculate periodic payment using amortization formula
    let periodicPayment: number;
    if (periodicRate === 0) {
        periodicPayment = principal / count;
    } else {
        periodicPayment =
            (principal * periodicRate * Math.pow(1 + periodicRate, count)) /
            (Math.pow(1 + periodicRate, count) - 1);
    }

    let remainingPrincipal = principal;

    for (let i = 1; i <= count; i++) {
        const interestAmount = remainingPrincipal * periodicRate;
        const principalAmount = periodicPayment - interestAmount;
        remainingPrincipal -= principalAmount;

        // Calculate due date
        const dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() + intervalDays * i);

        installments.push({
            installmentNumber: i,
            amount: Math.round(periodicPayment * 100) / 100,
            principalAmount: Math.round(principalAmount * 100) / 100,
            interestAmount: Math.round(interestAmount * 100) / 100,
            dueDate,
        });
    }

    return installments;
}

class InstallmentGenerationService {
    /**
     * Generate installments for a payment phase
     * Called when payment-service receives PAYMENT_PHASE_ACTIVATED event
     */
    async generateInstallments(input: GenerateInstallmentsInput): Promise<void> {
        const {
            phaseId,
            applicationId,
            tenantId,
            paymentPhaseId,
            totalAmount,
            interestRate,
            paymentPlanId,
            startDate: startDateStr,
            userId,
        } = input;

        console.log('[InstallmentGeneration] Generating installments', {
            phaseId,
            paymentPhaseId,
            totalAmount,
            interestRate,
        });

        // Check if installments already exist
        const existingInstallments = await prisma.paymentInstallment.findFirst({
            where: { paymentPhaseId },
        });

        if (existingInstallments) {
            console.log('[InstallmentGeneration] Installments already exist, skipping', {
                paymentPhaseId,
            });
            return;
        }

        // Fetch the payment plan to get frequency and other settings
        if (!paymentPlanId) {
            console.error('[InstallmentGeneration] No paymentPlanId provided', { phaseId });
            throw new AppError(400, 'Payment plan ID is required for installment generation');
        }

        const paymentPlan = await prisma.paymentPlan.findUnique({
            where: { id: paymentPlanId },
        });

        if (!paymentPlan) {
            console.error('[InstallmentGeneration] Payment plan not found', { paymentPlanId });
            throw new AppError(404, 'Payment plan not found');
        }

        // Get the payment phase to check numberOfInstallments
        const paymentPhase = await prisma.paymentPhase.findUnique({
            where: { id: paymentPhaseId },
        });

        if (!paymentPhase) {
            console.error('[InstallmentGeneration] Payment phase not found', { paymentPhaseId });
            throw new AppError(404, 'Payment phase not found');
        }

        const startDate = new Date(startDateStr);
        const intervalDays = getIntervalDays({
            paymentFrequency: paymentPlan.paymentFrequency,
            frequencyMultiplier: paymentPlan.frequencyMultiplier,
            customFrequencyDays: paymentPlan.customFrequencyDays,
        });

        // Determine number of installments
        let numberOfInstallments: number;
        if (paymentPlan.allowFlexibleTerm) {
            // For flexible-term plans, use the selected term from phase
            if (!paymentPhase.numberOfInstallments) {
                console.error('[InstallmentGeneration] Flexible term plan requires numberOfInstallments', {
                    paymentPhaseId,
                });
                throw new AppError(400, 'Flexible term plan requires selected term to be set on the phase');
            }
            numberOfInstallments = paymentPhase.numberOfInstallments;
        } else {
            // For fixed-term plans, use the plan's default
            if (!paymentPlan.numberOfInstallments) {
                console.error('[InstallmentGeneration] Payment plan has no numberOfInstallments', {
                    paymentPlanId,
                });
                throw new AppError(400, 'Payment plan must have numberOfInstallments configured');
            }
            numberOfInstallments = paymentPlan.numberOfInstallments;
        }

        // Calculate installments
        const installments = calculateInstallments(
            totalAmount,
            interestRate,
            numberOfInstallments,
            startDate,
            intervalDays,
            paymentPlan.gracePeriodDays
        );

        console.log('[InstallmentGeneration] Calculated installments', {
            count: installments.length,
            totalAmount,
            interestRate,
        });

        // Create installments in database
        await prisma.$transaction(async (tx) => {
            for (const installment of installments) {
                await tx.paymentInstallment.create({
                    data: {
                        tenantId,
                        paymentPhaseId,
                        installmentNumber: installment.installmentNumber,
                        amount: installment.amount,
                        principalAmount: installment.principalAmount,
                        interestAmount: installment.interestAmount,
                        dueDate: installment.dueDate,
                        status: 'PENDING',
                        gracePeriodDays: paymentPlan.gracePeriodDays,
                    },
                });
            }

            // Update application's next payment due date
            if (installments.length > 0) {
                await tx.application.update({
                    where: { id: applicationId },
                    data: { nextPaymentDueDate: installments[0].dueDate },
                });
            }

            // Write domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId,
                    eventType: 'INSTALLMENTS.GENERATED',
                    aggregateType: 'PaymentPhase',
                    aggregateId: paymentPhaseId,
                    queueName: 'payment-events',
                    payload: JSON.stringify({
                        phaseId,
                        applicationId,
                        paymentPhaseId,
                        installmentCount: installments.length,
                        totalAmount,
                    }),
                    actorId: userId,
                },
            });
        });

        console.log('[InstallmentGeneration] Installments created successfully', {
            paymentPhaseId,
            count: installments.length,
        });
    }
}

export const installmentGenerationService = new InstallmentGenerationService();
