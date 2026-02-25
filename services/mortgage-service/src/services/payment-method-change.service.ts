import { PrismaClient, Prisma, PaymentMethodChangeRequestModel, ApplicationPhaseModel } from '@valentine-efagene/qshelter-common';
import { AppError } from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { applicationPhaseService } from './application-phase.service';

// Extended types for methods that return data with relations
type PaymentMethodChangeRequestWithRelations = PaymentMethodChangeRequestModel & {
    application?: unknown;
    fromPaymentMethod?: unknown;
    toPaymentMethod?: unknown;
    requestor?: unknown;
    reviewer?: unknown;
};

type ExecuteResult = {
    request: PaymentMethodChangeRequestModel;
    newPhases: ApplicationPhaseModel[];
};

/**
 * Service for managing payment method change requests.
 * 
 * Handles the workflow when a customer wants to switch payment methods mid-application:
 * 1. Create request with financial impact preview
 * 2. Review and approve/reject
 * 3. Execute the change (supersede old phase, create new phase)
 */
export class PaymentMethodChangeService {
    constructor(private readonly db: PrismaClient) { }

    /**
     * Create a new payment method change request.
     * Calculates the financial impact preview for the requested change.
     */
    async createRequest(data: {
        applicationId: string;
        toPaymentMethodId: string;
        reason?: string;
        requestorId: string;
        tenantId: string;
    }): Promise<PaymentMethodChangeRequestWithRelations> {
        // Get the application with current payment method
        const application = await this.db.application.findUnique({
            where: { id: data.applicationId },
            include: {
                paymentMethod: true,
                phases: {
                    where: {
                        phaseCategory: 'PAYMENT',
                        status: { in: ['PENDING', 'IN_PROGRESS', 'ACTIVE'] },
                    },
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!application) {
            throw new AppError(404, 'application not found');
        }

        if (application.tenantId !== data.tenantId) {
            throw new AppError(403, 'application belongs to a different tenant');
        }

        if (!application.paymentMethodId) {
            throw new AppError(400, 'application does not have a payment method');
        }

        // Check if application is in a valid state for changes
        if (!['ACTIVE', 'PENDING_ACTIVATION'].includes(application.status)) {
            throw new AppError(400, `Cannot change payment method for application in ${application.status} status`);
        }

        // Check for existing pending requests
        const existingRequest = await this.db.paymentMethodChangeRequest.findFirst({
            where: {
                applicationId: data.applicationId,
                status: { in: ['PENDING_DOCUMENTS', 'DOCUMENTS_SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] },
            },
        });

        if (existingRequest) {
            throw new AppError(400, 'A payment method change request is already in progress');
        }

        // Get the new payment method with phases
        const newPaymentMethod = await this.db.propertyPaymentMethod.findUnique({
            where: { id: data.toPaymentMethodId },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                    include: {
                        paymentPlan: true,
                    },
                },
            },
        });

        if (!newPaymentMethod) {
            throw new AppError(404, 'New payment method not found');
        }

        // Calculate total paid to date from PaymentPhases
        // Need to fetch PaymentPhase data for the application's payment phases
        const paymentPhasesData = await this.db.paymentPhase.findMany({
            where: {
                phase: {
                    applicationId: data.applicationId,
                    phaseCategory: 'PAYMENT',
                },
            },
        });
        const totalPaidToDate = paymentPhasesData.reduce((sum, pp) => sum + pp.paidAmount, 0);

        // Calculate financial impact
        const currentOutstanding = application.totalAmount - totalPaidToDate;

        // Get payment plan from the new method's payment phases
        // Prefer MORTGAGE phase for term calculation, as it's the main installment payment
        const mortgagePhase = newPaymentMethod.phases.find(
            p => p.phaseCategory === 'PAYMENT' && p.phaseType === 'MORTGAGE'
        );
        const paymentPhase = mortgagePhase || newPaymentMethod.phases.find(p => p.phaseCategory === 'PAYMENT');

        // Calculate new terms based on new payment method
        let newTermMonths: number | null = null;
        let newInterestRate: number | null = null;
        let newMonthlyPayment: number | null = null;

        if (paymentPhase) {
            // Interest rate is on the phase template, term is from plan's numberOfInstallments
            newInterestRate = paymentPhase.interestRate ?? null;

            if (paymentPhase.paymentPlan) {
                const plan = paymentPhase.paymentPlan;
                // numberOfInstallments is effectively the term in months for monthly payments
                newTermMonths = plan.numberOfInstallments ?? null;

                // Calculate new monthly payment if it's a mortgage/installment plan
                if (plan.numberOfInstallments && paymentPhase.interestRate) {
                    const monthlyRate = paymentPhase.interestRate / 100 / 12;
                    const numPayments = plan.numberOfInstallments;

                    // PMT formula for amortization
                    if (monthlyRate > 0) {
                        newMonthlyPayment = currentOutstanding *
                            (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
                            (Math.pow(1 + monthlyRate, numPayments) - 1);
                    } else {
                        newMonthlyPayment = currentOutstanding / numPayments;
                    }
                }
            }
        }

        // Create the request
        const request = await this.db.paymentMethodChangeRequest.create({
            data: {
                tenantId: data.tenantId,
                applicationId: data.applicationId,
                fromPaymentMethodId: application.paymentMethodId,
                toPaymentMethodId: data.toPaymentMethodId,
                requestorId: data.requestorId,
                reason: data.reason,
                currentOutstanding,
                newTermMonths,
                newInterestRate,
                newMonthlyPayment,
                status: 'PENDING_DOCUMENTS', // May need documents depending on config
            },
            include: {
                application: true,
                fromPaymentMethod: true,
                toPaymentMethod: true,
                requestor: {
                    select: { id: true, email: true, firstName: true, lastName: true },
                },
            },
        });

        // Write domain event
        await this.db.domainEvent.create({
            data: {
                id: uuidv4(),
                tenantId: data.tenantId,
                eventType: 'PAYMENT_METHOD_CHANGE.REQUESTED',
                aggregateType: 'PaymentMethodChangeRequest',
                aggregateId: request.id,
                queueName: 'notifications',
                payload: JSON.stringify({
                    requestId: request.id,
                    applicationId: data.applicationId,
                    fromMethodId: application.paymentMethodId,
                    toMethodId: data.toPaymentMethodId,
                    requestorId: data.requestorId,
                    reason: data.reason,
                }),
            },
        });

        return request;
    }

    /**
     * Get a payment method change request by ID.
     */
    async findById(requestId: string, tenantId: string): Promise<PaymentMethodChangeRequestWithRelations> {
        const request = await this.db.paymentMethodChangeRequest.findUnique({
            where: { id: requestId },
            include: {
                application: true,
                fromPaymentMethod: {
                    include: {
                        phases: { include: { paymentPlan: true } },
                    },
                },
                toPaymentMethod: {
                    include: {
                        phases: { include: { paymentPlan: true } },
                    },
                },
                requestor: {
                    select: { id: true, email: true, firstName: true, lastName: true },
                },
                reviewer: {
                    select: { id: true, email: true, firstName: true, lastName: true },
                },
            },
        });

        if (!request) {
            throw new AppError(404, 'Payment method change request not found');
        }

        if (request.tenantId !== tenantId) {
            throw new AppError(403, 'Request belongs to a different tenant');
        }

        return request;
    }

    /**
     * List payment method change requests for a application.
     */
    async listByapplication(applicationId: string, tenantId: string): Promise<PaymentMethodChangeRequestWithRelations[]> {
        return this.db.paymentMethodChangeRequest.findMany({
            where: { applicationId, tenantId },
            include: {
                fromPaymentMethod: true,
                toPaymentMethod: true,
                requestor: {
                    select: { id: true, email: true, firstName: true, lastName: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * List all pending requests for admin review.
     */
    async listPendingForReview(tenantId: string): Promise<PaymentMethodChangeRequestWithRelations[]> {
        return this.db.paymentMethodChangeRequest.findMany({
            where: {
                tenantId,
                status: { in: ['DOCUMENTS_SUBMITTED', 'UNDER_REVIEW'] },
            },
            include: {
                application: {
                    include: { buyer: { select: { id: true, email: true, firstName: true, lastName: true } } },
                },
                fromPaymentMethod: {
                    include: { phases: { include: { paymentPlan: true } } },
                },
                toPaymentMethod: {
                    include: { phases: { include: { paymentPlan: true } } },
                },
                requestor: {
                    select: { id: true, email: true, firstName: true, lastName: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    /**
     * Submit documents for a pending request.
     */
    async submitDocuments(requestId: string, tenantId: string): Promise<PaymentMethodChangeRequestModel> {
        const request = await this.findById(requestId, tenantId);

        if (request.status !== 'PENDING_DOCUMENTS') {
            throw new AppError(400, `Cannot submit documents for request in ${request.status} status`);
        }

        return this.db.paymentMethodChangeRequest.update({
            where: { id: requestId },
            data: { status: 'DOCUMENTS_SUBMITTED' },
        });
    }

    /**
     * Start review of a request (admin action).
     */
    async startReview(requestId: string, reviewerId: string, tenantId: string): Promise<PaymentMethodChangeRequestModel> {
        const request = await this.findById(requestId, tenantId);

        if (!['PENDING_DOCUMENTS', 'DOCUMENTS_SUBMITTED'].includes(request.status)) {
            throw new AppError(400, `Cannot start review for request in ${request.status} status`);
        }

        return this.db.paymentMethodChangeRequest.update({
            where: { id: requestId },
            data: {
                status: 'UNDER_REVIEW',
                reviewerId,
            },
        });
    }

    /**
     * Approve a payment method change request.
     * This validates the request and marks it as approved. Execution is separate.
     */
    async approve(requestId: string, reviewerId: string, reviewNotes: string | undefined, tenantId: string): Promise<PaymentMethodChangeRequestModel> {
        const request = await this.findById(requestId, tenantId);

        if (!['DOCUMENTS_SUBMITTED', 'UNDER_REVIEW'].includes(request.status)) {
            throw new AppError(400, `Cannot approve request in ${request.status} status`);
        }

        // Validate application is still in valid state
        const application = await this.db.application.findUnique({
            where: { id: request.applicationId },
        });

        if (!application || !['ACTIVE', 'PENDING_ACTIVATION'].includes(application.status)) {
            throw new AppError(400, 'application is no longer in a valid state for payment method change');
        }

        // Check for pending payments
        const pendingPayments = await this.db.applicationPayment.findFirst({
            where: {
                applicationId: request.applicationId,
                status: { in: ['INITIATED', 'PENDING'] },
            },
        });

        if (pendingPayments) {
            throw new AppError(400, 'Cannot approve change while payments are pending. Wait for payments to complete.');
        }

        const updated = await this.db.paymentMethodChangeRequest.update({
            where: { id: requestId },
            data: {
                status: 'APPROVED',
                reviewerId,
                reviewNotes,
                reviewedAt: new Date(),
            },
        });

        // Write domain event
        await this.db.domainEvent.create({
            data: {
                id: uuidv4(),
                tenantId,
                eventType: 'PAYMENT_METHOD_CHANGE.APPROVED',
                aggregateType: 'PaymentMethodChangeRequest',
                aggregateId: requestId,
                queueName: 'notifications',
                payload: JSON.stringify({
                    requestId,
                    applicationId: request.applicationId,
                    reviewerId,
                    reviewNotes,
                }),
            },
        });

        return updated;
    }

    /**
     * Reject a payment method change request.
     */
    async reject(
        requestId: string,
        reviewerId: string,
        rejectionReason: string,
        tenantId: string
    ): Promise<PaymentMethodChangeRequestModel> {
        const request = await this.findById(requestId, tenantId);

        if (!['PENDING_DOCUMENTS', 'DOCUMENTS_SUBMITTED', 'UNDER_REVIEW'].includes(request.status)) {
            throw new AppError(400, `Cannot reject request in ${request.status} status`);
        }

        const updated = await this.db.paymentMethodChangeRequest.update({
            where: { id: requestId },
            data: {
                status: 'REJECTED',
                reviewerId,
                reviewNotes: rejectionReason,
                reviewedAt: new Date(),
            },
        });

        // Write domain event
        await this.db.domainEvent.create({
            data: {
                id: uuidv4(),
                tenantId,
                eventType: 'PAYMENT_METHOD_CHANGE.REJECTED',
                aggregateType: 'PaymentMethodChangeRequest',
                aggregateId: requestId,
                queueName: 'notifications',
                payload: JSON.stringify({
                    requestId,
                    applicationId: request.applicationId,
                    reviewerId,
                    rejectionReason,
                }),
            },
        });

        return updated;
    }

    /**
     * Cancel a pending request (requestor action).
     */
    async cancel(requestId: string, requestorId: string, tenantId: string): Promise<PaymentMethodChangeRequestModel> {
        const request = await this.findById(requestId, tenantId);

        if (!['PENDING_DOCUMENTS', 'DOCUMENTS_SUBMITTED', 'UNDER_REVIEW'].includes(request.status)) {
            throw new AppError(400, `Cannot cancel request in ${request.status} status`);
        }

        if (request.requestorId !== requestorId) {
            throw new AppError(403, 'Only the requestor can cancel the request');
        }

        const updated = await this.db.paymentMethodChangeRequest.update({
            where: { id: requestId },
            data: { status: 'CANCELLED' },
        });

        // Write domain event
        await this.db.domainEvent.create({
            data: {
                id: uuidv4(),
                tenantId,
                eventType: 'PAYMENT_METHOD_CHANGE.CANCELLED',
                aggregateType: 'PaymentMethodChangeRequest',
                aggregateId: requestId,
                queueName: 'application-events',
                payload: JSON.stringify({
                    requestId,
                    applicationId: request.applicationId,
                    requestorId,
                }),
            },
        });

        return updated;
    }

    /**
     * Execute an approved payment method change.
     * This performs the actual application modification:
     * 1. Supersedes the current in-progress payment phase
     * 2. Creates new payment phase(s) based on new payment method
     * 3. Updates application's payment method reference
     */
    async execute(requestId: string, executorId: string, tenantId: string): Promise<ExecuteResult> {
        const request = await this.findById(requestId, tenantId);

        if (request.status !== 'APPROVED') {
            throw new AppError(400, `Cannot execute request in ${request.status} status. Must be APPROVED first.`);
        }

        // Get full application with phases and payment data
        const application = await this.db.application.findUnique({
            where: { id: request.applicationId },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                    include: {
                        paymentPhase: {
                            include: { installments: true },
                        },
                    },
                },
            },
        });

        if (!application) {
            throw new AppError(404, 'application not found');
        }

        // Get the new payment method with phase templates
        const newPaymentMethod = await this.db.propertyPaymentMethod.findUnique({
            where: { id: request.toPaymentMethodId },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                    include: {
                        paymentPlan: true,
                    },
                },
            },
        });

        if (!newPaymentMethod) {
            throw new AppError(404, 'New payment method not found');
        }

        // Find current in-progress/pending payment phases to supersede
        const currentPaymentPhases = application.phases.filter(
            (p: { phaseCategory: string; status: string }) =>
                p.phaseCategory === 'PAYMENT' && ['PENDING', 'IN_PROGRESS', 'ACTIVE'].includes(p.status)
        );

        // Snapshot current state for audit
        const previousPhaseData = currentPaymentPhases.map((p: {
            id: string;
            name: string;
            status: string;
            paymentPhase?: { totalAmount: number; paidAmount: number } | null;
        }) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            totalAmount: p.paymentPhase?.totalAmount ?? 0,
            paidAmount: p.paymentPhase?.paidAmount ?? 0,
            remainingAmount: (p.paymentPhase?.totalAmount ?? 0) - (p.paymentPhase?.paidAmount ?? 0),
        }));

        // Calculate total paid to date from payment phases
        const totalPaidToDate = application.phases
            .filter((p: { phaseCategory: string }) => p.phaseCategory === 'PAYMENT')
            .reduce((sum: number, p: { paymentPhase?: { paidAmount: number } | null }) =>
                sum + (p.paymentPhase?.paidAmount ?? 0), 0);

        // Calculate remaining balance
        const remainingBalance = request.currentOutstanding ?? (application.totalAmount - totalPaidToDate);

        // Find max order from existing phases
        const maxOrder = Math.max(...application.phases.map((p: { order: number }) => p.order));

        // Execute in transaction
        const result = await this.db.$transaction(async (tx) => {
            // 1. Supersede current payment phases
            for (const phase of currentPaymentPhases) {
                await tx.applicationPhase.update({
                    where: { id: phase.id },
                    data: {
                        status: 'SUPERSEDED',
                        completedAt: new Date(),
                    },
                });
            }

            // 2. Create new payment phase(s) from new payment method
            // Find payment phase template(s) from new method
            const paymentTemplates = newPaymentMethod.phases.filter(
                (t: { phaseCategory: string }) => t.phaseCategory === 'PAYMENT'
            );

            const newPhases: any[] = [];
            let currentOrder = maxOrder + 1;

            for (const template of paymentTemplates) {
                // Calculate phase amount based on template percentage or use remaining balance
                let phaseAmount = remainingBalance;
                if (template.percentOfPrice) {
                    // For change requests, we apply percentage to remaining, not original total
                    phaseAmount = remainingBalance * (template.percentOfPrice / 100);
                }

                // Create the base ApplicationPhase
                const newPhase = await tx.applicationPhase.create({
                    data: {
                        tenantId: application.tenantId,
                        applicationId: application.id,
                        name: `${template.name} (Changed)`,
                        description: template.description,
                        phaseCategory: template.phaseCategory,
                        phaseType: template.phaseType,
                        order: currentOrder++,
                        status: 'PENDING',
                    },
                });

                // Create PaymentPhase extension for PAYMENT phases
                if (template.phaseCategory === 'PAYMENT') {
                    await tx.paymentPhase.create({
                        data: {
                            tenantId: application.tenantId,
                            phaseId: newPhase.id,
                            paymentPlanId: template.paymentPlanId,
                            totalAmount: phaseAmount,
                            paidAmount: 0,
                            interestRate: template.interestRate ?? undefined,
                            collectFunds: template.collectFunds ?? true,
                            paymentPlanSnapshot: template.paymentPlan
                                ? (JSON.stringify(template.paymentPlan) as unknown as Prisma.InputJsonValue)
                                : Prisma.DbNull,
                        },
                    });
                }

                newPhases.push(newPhase);
            }

            // 3. Update application's payment method reference
            await tx.application.update({
                where: { id: application.id },
                data: {
                    paymentMethodId: request.toPaymentMethodId,
                },
            });

            // 4. Update the change request as executed
            const updatedRequest = await tx.paymentMethodChangeRequest.update({
                where: { id: requestId },
                data: {
                    status: 'EXECUTED',
                    executedAt: new Date(),
                    previousPhaseData: JSON.stringify(previousPhaseData),
                    newPhaseData: JSON.stringify(newPhases.map(p => ({
                        id: p.id,
                        name: p.name,
                        totalAmount: p.totalAmount,
                    }))),
                },
            });

            // 5. Write domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId,
                    eventType: 'PAYMENT_METHOD_CHANGE.EXECUTED',
                    aggregateType: 'PaymentMethodChangeRequest',
                    aggregateId: requestId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        requestId,
                        applicationId: application.id,
                        executorId,
                        supersededPhases: previousPhaseData.map(p => p.id),
                        newPhases: newPhases.map(p => p.id),
                    }),
                },
            });

            // 6. Write application amended event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId,
                    eventType: 'application.AMENDED',
                    aggregateType: 'application',
                    aggregateId: application.id,
                    queueName: 'application-events',
                    payload: JSON.stringify({
                        applicationId: application.id,
                        amendmentType: 'PAYMENT_METHOD_CHANGE',
                        changeRequestId: requestId,
                        previousPaymentMethodId: request.fromPaymentMethodId,
                        newPaymentMethodId: request.toPaymentMethodId,
                    }),
                },
            });

            return { request: updatedRequest, newPhases };
        });

        // Activate the first new phase if there are no other active phases
        if (result.newPhases.length > 0) {
            const currentPhaseIds = currentPaymentPhases.map((p: { id: string }) => p.id);
            const hasActivePhase = application.phases.some(
                (p: { id: string; status: string }) =>
                    !currentPhaseIds.includes(p.id) && (p.status === 'IN_PROGRESS' || p.status === 'ACTIVE')
            );

            if (!hasActivePhase) {
                // Activate the first new phase
                await applicationPhaseService.activate(
                    result.newPhases[0].id,
                    {},
                    executorId
                );
            }
        }

        return result;
    }
}

// Singleton instance
export const paymentMethodChangeService = new PaymentMethodChangeService(prisma);
