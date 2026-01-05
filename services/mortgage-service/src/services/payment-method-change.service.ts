import { PrismaClient, Prisma } from '@valentine-efagene/qshelter-common';
import { AppError } from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { contractPhaseService } from './contract-phase.service';

/**
 * Service for managing payment method change requests.
 * 
 * Handles the workflow when a customer wants to switch payment methods mid-contract:
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
        contractId: string;
        toPaymentMethodId: string;
        reason?: string;
        requestorId: string;
        tenantId: string;
    }) {
        // Get the contract with current payment method
        const contract = await this.db.contract.findUnique({
            where: { id: data.contractId },
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

        if (!contract) {
            throw new AppError(404, 'Contract not found');
        }

        if (contract.tenantId !== data.tenantId) {
            throw new AppError(403, 'Contract belongs to a different tenant');
        }

        if (!contract.paymentMethodId) {
            throw new AppError(400, 'Contract does not have a payment method');
        }

        // Check if contract is in a valid state for changes
        if (!['ACTIVE', 'PENDING_ACTIVATION'].includes(contract.status)) {
            throw new AppError(400, `Cannot change payment method for contract in ${contract.status} status`);
        }

        // Check for existing pending requests
        const existingRequest = await this.db.paymentMethodChangeRequest.findFirst({
            where: {
                contractId: data.contractId,
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
                        steps: { orderBy: { order: 'asc' } },
                    },
                },
            },
        });

        if (!newPaymentMethod) {
            throw new AppError(404, 'New payment method not found');
        }

        // Calculate financial impact
        const currentOutstanding = contract.totalAmount - contract.totalPaidToDate;

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
                contractId: data.contractId,
                fromPaymentMethodId: contract.paymentMethodId,
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
                contract: true,
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
                eventType: 'PAYMENT_METHOD_CHANGE.REQUESTED',
                aggregateType: 'PaymentMethodChangeRequest',
                aggregateId: request.id,
                queueName: 'notifications',
                payload: JSON.stringify({
                    requestId: request.id,
                    contractId: data.contractId,
                    fromMethodId: contract.paymentMethodId,
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
    async findById(requestId: string, tenantId: string) {
        const request = await this.db.paymentMethodChangeRequest.findUnique({
            where: { id: requestId },
            include: {
                contract: true,
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
     * List payment method change requests for a contract.
     */
    async listByContract(contractId: string, tenantId: string) {
        return this.db.paymentMethodChangeRequest.findMany({
            where: { contractId, tenantId },
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
    async listPendingForReview(tenantId: string) {
        return this.db.paymentMethodChangeRequest.findMany({
            where: {
                tenantId,
                status: { in: ['DOCUMENTS_SUBMITTED', 'UNDER_REVIEW'] },
            },
            include: {
                contract: {
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
    async submitDocuments(requestId: string, tenantId: string) {
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
    async startReview(requestId: string, reviewerId: string, tenantId: string) {
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
    async approve(requestId: string, reviewerId: string, reviewNotes: string | undefined, tenantId: string) {
        const request = await this.findById(requestId, tenantId);

        if (!['DOCUMENTS_SUBMITTED', 'UNDER_REVIEW'].includes(request.status)) {
            throw new AppError(400, `Cannot approve request in ${request.status} status`);
        }

        // Validate contract is still in valid state
        const contract = await this.db.contract.findUnique({
            where: { id: request.contractId },
        });

        if (!contract || !['ACTIVE', 'PENDING_ACTIVATION'].includes(contract.status)) {
            throw new AppError(400, 'Contract is no longer in a valid state for payment method change');
        }

        // Check for pending payments
        const pendingPayments = await this.db.contractPayment.findFirst({
            where: {
                contractId: request.contractId,
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
                eventType: 'PAYMENT_METHOD_CHANGE.APPROVED',
                aggregateType: 'PaymentMethodChangeRequest',
                aggregateId: requestId,
                queueName: 'notifications',
                payload: JSON.stringify({
                    requestId,
                    contractId: request.contractId,
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
    ) {
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
                eventType: 'PAYMENT_METHOD_CHANGE.REJECTED',
                aggregateType: 'PaymentMethodChangeRequest',
                aggregateId: requestId,
                queueName: 'notifications',
                payload: JSON.stringify({
                    requestId,
                    contractId: request.contractId,
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
    async cancel(requestId: string, requestorId: string, tenantId: string) {
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
                eventType: 'PAYMENT_METHOD_CHANGE.CANCELLED',
                aggregateType: 'PaymentMethodChangeRequest',
                aggregateId: requestId,
                queueName: 'contract-events',
                payload: JSON.stringify({
                    requestId,
                    contractId: request.contractId,
                    requestorId,
                }),
            },
        });

        return updated;
    }

    /**
     * Execute an approved payment method change.
     * This performs the actual contract modification:
     * 1. Supersedes the current in-progress payment phase
     * 2. Creates new payment phase(s) based on new payment method
     * 3. Updates contract's payment method reference
     */
    async execute(requestId: string, executorId: string, tenantId: string) {
        const request = await this.findById(requestId, tenantId);

        if (request.status !== 'APPROVED') {
            throw new AppError(400, `Cannot execute request in ${request.status} status. Must be APPROVED first.`);
        }

        // Get full contract with phases
        const contract = await this.db.contract.findUnique({
            where: { id: request.contractId },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                    include: { installments: true },
                },
            },
        });

        if (!contract) {
            throw new AppError(404, 'Contract not found');
        }

        // Get the new payment method with phase templates
        const newPaymentMethod = await this.db.propertyPaymentMethod.findUnique({
            where: { id: request.toPaymentMethodId },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                    include: {
                        paymentPlan: true,
                        steps: { orderBy: { order: 'asc' } },
                    },
                },
            },
        });

        if (!newPaymentMethod) {
            throw new AppError(404, 'New payment method not found');
        }

        // Find current in-progress/pending payment phases to supersede
        const currentPaymentPhases = contract.phases.filter(
            p => p.phaseCategory === 'PAYMENT' && ['PENDING', 'IN_PROGRESS', 'ACTIVE'].includes(p.status)
        );

        // Snapshot current state for audit
        const previousPhaseData = currentPaymentPhases.map(p => ({
            id: p.id,
            name: p.name,
            status: p.status,
            totalAmount: p.totalAmount,
            paidAmount: p.paidAmount,
            remainingAmount: p.remainingAmount,
        }));

        // Calculate remaining balance
        const remainingBalance = request.currentOutstanding ?? (contract.totalAmount - contract.totalPaidToDate);

        // Find max order from existing phases
        const maxOrder = Math.max(...contract.phases.map(p => p.order));

        // Execute in transaction
        const result = await this.db.$transaction(async (tx) => {
            // 1. Supersede current payment phases
            for (const phase of currentPaymentPhases) {
                await tx.contractPhase.update({
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

                const newPhase = await tx.contractPhase.create({
                    data: {
                        contractId: contract.id,
                        paymentPlanId: template.paymentPlanId,
                        name: `${template.name} (Changed)`,
                        description: template.description,
                        phaseCategory: template.phaseCategory,
                        phaseType: template.phaseType,
                        order: currentOrder++,
                        status: 'PENDING',
                        totalAmount: phaseAmount,
                        remainingAmount: phaseAmount,
                        interestRate: template.interestRate,
                        collectFunds: template.collectFunds ?? true,
                        paymentPlanSnapshot: template.paymentPlan
                            ? (JSON.stringify(template.paymentPlan) as unknown as Prisma.InputJsonValue)
                            : Prisma.DbNull,
                    },
                });

                newPhases.push(newPhase);
            }

            // 3. Update contract's payment method reference
            await tx.contract.update({
                where: { id: contract.id },
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
                    eventType: 'PAYMENT_METHOD_CHANGE.EXECUTED',
                    aggregateType: 'PaymentMethodChangeRequest',
                    aggregateId: requestId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        requestId,
                        contractId: contract.id,
                        executorId,
                        supersededPhases: previousPhaseData.map(p => p.id),
                        newPhases: newPhases.map(p => p.id),
                    }),
                },
            });

            // 6. Write contract amended event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'CONTRACT.AMENDED',
                    aggregateType: 'Contract',
                    aggregateId: contract.id,
                    queueName: 'contract-events',
                    payload: JSON.stringify({
                        contractId: contract.id,
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
            const hasActivePhase = contract.phases.some(
                p => !currentPaymentPhases.includes(p) && (p.status === 'IN_PROGRESS' || p.status === 'ACTIVE')
            );

            if (!hasActivePhase) {
                // Activate the first new phase
                await contractPhaseService.activate(
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
