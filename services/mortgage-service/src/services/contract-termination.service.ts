import { prisma as defaultPrisma } from '../lib/prisma';
import { AppError, PrismaClient } from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import {
    sendContractTerminationRequestedNotification,
    sendContractTerminationApprovedNotification,
    sendContractTerminatedNotification,
    formatCurrency,
} from '../lib/notifications';
import type {
    RequestTerminationInput,
    AdminTerminationInput,
    ReviewTerminationInput,
    ProcessRefundInput,
    CompleteRefundInput,
    CancelTerminationInput,
} from '../validators/contract-termination.validator';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://dashboard.qshelter.com';

// Use string literal types instead of importing enums (they'll come from Prisma)
type TerminationType =
    | 'BUYER_WITHDRAWAL'
    | 'SELLER_WITHDRAWAL'
    | 'MUTUAL_AGREEMENT'
    | 'PAYMENT_DEFAULT'
    | 'DOCUMENT_FAILURE'
    | 'FRAUD'
    | 'FORCE_MAJEURE'
    | 'PROPERTY_UNAVAILABLE'
    | 'REGULATORY'
    | 'OTHER';

type TerminationStatus =
    | 'REQUESTED'
    | 'PENDING_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'PENDING_REFUND'
    | 'REFUND_IN_PROGRESS'
    | 'REFUND_COMPLETED'
    | 'COMPLETED'
    | 'CANCELLED';

type RefundStatus =
    | 'NOT_APPLICABLE'
    | 'PENDING'
    | 'INITIATED'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED'
    | 'PARTIAL';

type TerminationInitiator = 'BUYER' | 'SELLER' | 'ADMIN' | 'SYSTEM';

type AnyPrismaClient = PrismaClient;

/** Service interface to avoid non-portable inferred types */
export interface ContractTerminationService {
    requestTermination(
        contractId: string,
        userId: string,
        data: RequestTerminationInput,
        opts?: { idempotencyKey?: string }
    ): Promise<any>;
    adminTerminate(
        contractId: string,
        adminId: string,
        data: AdminTerminationInput,
        opts?: { idempotencyKey?: string }
    ): Promise<any>;
    reviewTermination(
        terminationId: string,
        reviewerId: string,
        data: ReviewTerminationInput
    ): Promise<any>;
    processRefund(
        terminationId: string,
        adminId: string,
        data: ProcessRefundInput
    ): Promise<any>;
    completeRefund(
        terminationId: string,
        adminId: string,
        data: CompleteRefundInput
    ): Promise<any>;
    executeTermination(
        terminationId: string,
        actorId: string,
        txOrPrisma?: any
    ): Promise<any>;
    cancelTermination(
        terminationId: string,
        userId: string,
        data?: CancelTerminationInput
    ): Promise<any>;
    findById(terminationId: string): Promise<any>;
    findByContract(contractId: string): Promise<any[]>;
    findPendingReview(tenantId: string): Promise<any[]>;
}

/**
 * Generate a unique termination request number
 */
function generateRequestNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TRM-${timestamp}-${random}`;
}

/**
 * Calculate settlement amounts based on contract state and termination type
 * Industry standard considerations:
 * - Non-refundable deposits (typically 1-5% of contract value)
 * - Admin/processing fees
 * - Penalties for buyer-initiated withdrawal after signing
 * - Full refund for seller/property issues
 * - Pro-rated refunds based on completion percentage
 */
function calculateSettlement(
    contract: any,
    terminationType: TerminationType,
    tenantPolicies?: any
): {
    refundableAmount: number;
    penaltyAmount: number;
    forfeitedAmount: number;
    adminFeeAmount: number;
    netRefundAmount: number;
} {
    const totalPaid = contract.totalPaidToDate || 0;

    // Default policies (can be overridden by tenant config)
    const policies = tenantPolicies || {
        nonRefundableDepositPercent: 2,        // 2% non-refundable
        buyerWithdrawalPenaltyPercent: 5,      // 5% penalty for buyer withdrawal after signing
        adminFeeFlat: 500,                      // Flat admin fee
        adminFeePercent: 0.5,                   // 0.5% processing fee
        gracePeriodDays: 14,                    // Full refund within 14 days of signing
    };

    let refundableAmount = totalPaid;
    let penaltyAmount = 0;
    let forfeitedAmount = 0;
    let adminFeeAmount = 0;

    // Calculate based on termination type
    switch (terminationType) {
        case 'BUYER_WITHDRAWAL':
            // Check if within grace period (full refund)
            if (contract.signedAt) {
                const daysSinceSigning = Math.floor(
                    (Date.now() - new Date(contract.signedAt).getTime()) / (1000 * 60 * 60 * 24)
                );
                if (daysSinceSigning <= policies.gracePeriodDays) {
                    // Within grace period - full refund minus admin fee
                    adminFeeAmount = Math.min(policies.adminFeeFlat, totalPaid * 0.1);
                } else {
                    // After grace period - apply penalties
                    penaltyAmount = (contract.totalAmount * policies.buyerWithdrawalPenaltyPercent) / 100;
                    adminFeeAmount = Math.max(
                        policies.adminFeeFlat,
                        (totalPaid * policies.adminFeePercent) / 100
                    );
                }
            } else {
                // Not yet signed - minimal admin fee only
                adminFeeAmount = Math.min(policies.adminFeeFlat * 0.5, totalPaid * 0.05);
            }
            break;

        case 'SELLER_WITHDRAWAL':
        case 'PROPERTY_UNAVAILABLE':
        case 'FORCE_MAJEURE':
            // Full refund - seller/external issue
            adminFeeAmount = 0;
            break;

        case 'MUTUAL_AGREEMENT':
            // Negotiated - typically small admin fee
            adminFeeAmount = policies.adminFeeFlat;
            break;

        case 'PAYMENT_DEFAULT':
            // Buyer defaulted - forfeit non-refundable deposit + penalties
            forfeitedAmount = (contract.totalAmount * policies.nonRefundableDepositPercent) / 100;
            penaltyAmount = (contract.totalAmount * policies.buyerWithdrawalPenaltyPercent) / 100;
            adminFeeAmount = policies.adminFeeFlat;
            break;

        case 'DOCUMENT_FAILURE':
            // Buyer failed to provide docs - partial forfeit
            forfeitedAmount = (contract.totalAmount * policies.nonRefundableDepositPercent) / 100;
            adminFeeAmount = policies.adminFeeFlat;
            break;

        case 'FRAUD':
            // Fraud - forfeit all payments
            forfeitedAmount = totalPaid;
            refundableAmount = 0;
            break;

        case 'REGULATORY':
            // Regulatory issue - full refund
            adminFeeAmount = 0;
            break;

        default:
            adminFeeAmount = policies.adminFeeFlat;
    }

    // Calculate net refund
    const netRefundAmount = Math.max(
        0,
        refundableAmount - penaltyAmount - forfeitedAmount - adminFeeAmount
    );

    return {
        refundableAmount,
        penaltyAmount,
        forfeitedAmount,
        adminFeeAmount,
        netRefundAmount,
    };
}

/**
 * Create a contract termination service
 */
export function createContractTerminationService(prisma: AnyPrismaClient = defaultPrisma): ContractTerminationService {

    /**
     * Request termination (buyer/seller initiated)
     */
    async function requestTermination(
        contractId: string,
        userId: string,
        data: RequestTerminationInput,
        opts?: { idempotencyKey?: string }
    ) {
        return prisma.$transaction(async (tx: any) => {
            // Check idempotency
            if (opts?.idempotencyKey) {
                const existing = await tx.contractTermination.findUnique({
                    where: { idempotencyKey: opts.idempotencyKey },
                });
                if (existing) {
                    return existing;
                }
            }

            // Get contract with full details
            const contract = await tx.contract.findUnique({
                where: { id: contractId },
                include: {
                    phases: true,
                    payments: true,
                    propertyUnit: true,
                    buyer: true,
                    seller: true,
                },
            });

            if (!contract) {
                throw new AppError(404, 'Contract not found');
            }

            // Check if already terminated or has pending termination
            if (contract.status === 'CANCELLED' || contract.status === 'TERMINATED') {
                throw new AppError(400, `Contract is already ${contract.status.toLowerCase()}`);
            }

            const existingTermination = await tx.contractTermination.findFirst({
                where: {
                    contractId,
                    status: { in: ['REQUESTED', 'PENDING_REVIEW', 'PENDING_REFUND', 'REFUND_IN_PROGRESS'] },
                },
            });

            if (existingTermination) {
                throw new AppError(400, 'A termination request is already in progress for this contract');
            }

            // Determine initiator type
            let initiatedBy: TerminationInitiator = 'BUYER';
            if (contract.sellerId === userId) {
                initiatedBy = 'SELLER';
            }

            // Check if auto-approve eligible (pre-signature, no payments)
            const hasPayments = (contract.payments || []).some(
                (p: any) => p.status === 'COMPLETED' || p.status === 'PAID'
            );
            const isSigned = !!contract.signedAt;
            const autoApproveEligible = !isSigned && !hasPayments;

            // Calculate settlement
            const settlement = calculateSettlement(contract, data.type as TerminationType);

            // Determine refund status
            let refundStatus: RefundStatus = 'NOT_APPLICABLE';
            if (contract.totalPaidToDate > 0 && settlement.netRefundAmount > 0) {
                refundStatus = 'PENDING';
            }

            // Create termination request
            const termination = await tx.contractTermination.create({
                data: {
                    contractId,
                    tenantId: contract.tenantId,
                    requestNumber: generateRequestNumber(),
                    initiatedBy,
                    initiatorId: userId,
                    type: data.type,
                    reason: data.reason,
                    supportingDocs: data.supportingDocs,
                    status: autoApproveEligible ? 'PENDING_REFUND' : 'REQUESTED',
                    requiresApproval: !autoApproveEligible,
                    autoApproveEligible,
                    // Snapshot
                    contractSnapshot: {
                        id: contract.id,
                        contractNumber: contract.contractNumber,
                        status: contract.status,
                        totalAmount: contract.totalAmount,
                        totalPaidToDate: contract.totalPaidToDate,
                        signedAt: contract.signedAt,
                        phases: contract.phases.map((p: any) => ({
                            id: p.id,
                            name: p.name,
                            status: p.status,
                            paidAmount: p.paidAmount,
                        })),
                    },
                    totalContractAmount: contract.totalAmount,
                    totalPaidToDate: contract.totalPaidToDate,
                    outstandingBalance: contract.totalAmount - contract.totalPaidToDate,
                    // Settlement
                    ...settlement,
                    refundStatus,
                    idempotencyKey: opts?.idempotencyKey,
                },
            });

            // If auto-approve eligible and no refund needed, execute immediately
            if (autoApproveEligible && refundStatus === 'NOT_APPLICABLE') {
                return executeTermination(termination.id, userId, tx);
            }

            // Emit domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'CONTRACT.TERMINATION_REQUESTED',
                    aggregateType: 'Contract',
                    aggregateId: contractId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        contractId,
                        terminationId: termination.id,
                        requestNumber: termination.requestNumber,
                        initiatedBy,
                        type: data.type,
                        requiresApproval: termination.requiresApproval,
                    }),
                    actorId: userId,
                },
            });

            // Send termination requested notification
            try {
                if (contract.buyer?.email) {
                    await sendContractTerminationRequestedNotification({
                        email: contract.buyer.email,
                        userName: `${contract.buyer.firstName} ${contract.buyer.lastName}`,
                        contractId: contract.id,
                        contractNumber: contract.contractNumber,
                        requestNumber: termination.requestNumber,
                        terminationType: data.type,
                        reason: data.reason || 'Not specified',
                        requestDate: new Date(),
                        statusUrl: `${DASHBOARD_URL}/mortgages/${contract.id}/termination/${termination.id}`,
                    });
                }
            } catch (error) {
                console.error('Failed to send termination requested notification:', error);
            }

            return termination;
        });
    }

    /**
     * Admin-initiated termination (e.g., payment default, fraud)
     */
    async function adminTerminate(
        contractId: string,
        adminId: string,
        data: AdminTerminationInput,
        opts?: { idempotencyKey?: string }
    ) {
        return prisma.$transaction(async (tx: any) => {
            // Check idempotency
            if (opts?.idempotencyKey) {
                const existing = await tx.contractTermination.findUnique({
                    where: { idempotencyKey: opts.idempotencyKey },
                });
                if (existing) {
                    return existing;
                }
            }

            const contract = await tx.contract.findUnique({
                where: { id: contractId },
                include: {
                    phases: true,
                    payments: true,
                    propertyUnit: true,
                },
            });

            if (!contract) {
                throw new AppError(404, 'Contract not found');
            }

            if (contract.status === 'CANCELLED' || contract.status === 'TERMINATED') {
                throw new AppError(400, `Contract is already ${contract.status.toLowerCase()}`);
            }

            const settlement = calculateSettlement(contract, data.type as TerminationType);

            let refundStatus: RefundStatus = 'NOT_APPLICABLE';
            if (contract.totalPaidToDate > 0 && settlement.netRefundAmount > 0) {
                refundStatus = 'PENDING';
            }

            const termination = await tx.contractTermination.create({
                data: {
                    contractId,
                    tenantId: contract.tenantId,
                    requestNumber: generateRequestNumber(),
                    initiatedBy: 'ADMIN',
                    initiatorId: adminId,
                    type: data.type,
                    reason: data.reason,
                    supportingDocs: data.supportingDocs,
                    status: data.bypassApproval ? 'PENDING_REFUND' : 'PENDING_REVIEW',
                    requiresApproval: !data.bypassApproval,
                    autoApproveEligible: false,
                    contractSnapshot: {
                        id: contract.id,
                        contractNumber: contract.contractNumber,
                        status: contract.status,
                        totalAmount: contract.totalAmount,
                        totalPaidToDate: contract.totalPaidToDate,
                        signedAt: contract.signedAt,
                    },
                    totalContractAmount: contract.totalAmount,
                    totalPaidToDate: contract.totalPaidToDate,
                    outstandingBalance: contract.totalAmount - contract.totalPaidToDate,
                    ...settlement,
                    refundStatus,
                    approvedAt: data.bypassApproval ? new Date() : null,
                    reviewedBy: data.bypassApproval ? adminId : null,
                    reviewedAt: data.bypassApproval ? new Date() : null,
                    idempotencyKey: opts?.idempotencyKey,
                },
            });

            // If bypassing approval and no refund, execute immediately
            if (data.bypassApproval && refundStatus === 'NOT_APPLICABLE') {
                return executeTermination(termination.id, adminId, tx);
            }

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'CONTRACT.TERMINATION_INITIATED',
                    aggregateType: 'Contract',
                    aggregateId: contractId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        contractId,
                        terminationId: termination.id,
                        type: data.type,
                        initiatedBy: 'ADMIN',
                        adminId,
                    }),
                    actorId: adminId,
                },
            });

            return termination;
        });
    }

    /**
     * Review termination request (approve/reject)
     */
    async function reviewTermination(
        terminationId: string,
        reviewerId: string,
        data: ReviewTerminationInput
    ) {
        return prisma.$transaction(async (tx: any) => {
            const termination = await tx.contractTermination.findUnique({
                where: { id: terminationId },
                include: { contract: true },
            });

            if (!termination) {
                throw new AppError(404, 'Termination request not found');
            }

            if (termination.status !== 'REQUESTED' && termination.status !== 'PENDING_REVIEW') {
                throw new AppError(400, `Cannot review termination in ${termination.status} status`);
            }

            if (data.decision === 'REJECT') {
                // Reject the request
                const updated = await tx.contractTermination.update({
                    where: { id: terminationId },
                    data: {
                        status: 'REJECTED',
                        reviewedBy: reviewerId,
                        reviewedAt: new Date(),
                        reviewNotes: data.notes,
                        rejectionReason: data.rejectionReason,
                    },
                });

                await tx.domainEvent.create({
                    data: {
                        id: uuidv4(),
                        eventType: 'CONTRACT.TERMINATION_REJECTED',
                        aggregateType: 'Contract',
                        aggregateId: termination.contractId,
                        queueName: 'notifications',
                        payload: JSON.stringify({
                            contractId: termination.contractId,
                            terminationId,
                            rejectionReason: data.rejectionReason,
                        }),
                        actorId: reviewerId,
                    },
                });

                // Note: Rejection notification not implemented as there's no template for it
                // In the future, we could add a sendContractTerminationRejectedNotification

                return updated;
            }

            // Approve the request
            const settlementUpdate = data.settlementOverride || {};
            const netRefundAmount =
                (settlementUpdate.refundableAmount ?? termination.refundableAmount) -
                (settlementUpdate.penaltyAmount ?? termination.penaltyAmount) -
                (settlementUpdate.forfeitedAmount ?? termination.forfeitedAmount) -
                (settlementUpdate.adminFeeAmount ?? termination.adminFeeAmount);

            const updated = await tx.contractTermination.update({
                where: { id: terminationId },
                data: {
                    status: termination.refundStatus !== 'NOT_APPLICABLE' ? 'PENDING_REFUND' : 'COMPLETED',
                    reviewedBy: reviewerId,
                    reviewedAt: new Date(),
                    reviewNotes: data.notes,
                    approvedAt: new Date(),
                    ...(data.settlementOverride && {
                        refundableAmount: settlementUpdate.refundableAmount ?? termination.refundableAmount,
                        penaltyAmount: settlementUpdate.penaltyAmount ?? termination.penaltyAmount,
                        forfeitedAmount: settlementUpdate.forfeitedAmount ?? termination.forfeitedAmount,
                        adminFeeAmount: settlementUpdate.adminFeeAmount ?? termination.adminFeeAmount,
                        netRefundAmount: Math.max(0, netRefundAmount),
                        settlementNotes: settlementUpdate.notes,
                    }),
                },
            });

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'CONTRACT.TERMINATION_APPROVED',
                    aggregateType: 'Contract',
                    aggregateId: termination.contractId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        contractId: termination.contractId,
                        terminationId,
                        netRefundAmount: updated.netRefundAmount,
                    }),
                    actorId: reviewerId,
                },
            });

            // Send termination approved notification
            try {
                const contract = await tx.contract.findUnique({
                    where: { id: termination.contractId },
                    include: { buyer: true },
                });

                if (contract?.buyer?.email) {
                    await sendContractTerminationApprovedNotification({
                        email: contract.buyer.email,
                        userName: `${contract.buyer.firstName} ${contract.buyer.lastName}`,
                        contractId: contract.id,
                        contractNumber: contract.contractNumber,
                        refundAmount: updated.netRefundAmount || 0,
                        processingTime: '5-7 business days',
                        statusUrl: `${DASHBOARD_URL}/mortgages/${contract.id}/termination/${terminationId}`,
                    });
                }
            } catch (error) {
                console.error('Failed to send termination approved notification:', error);
            }

            // If no refund needed, execute immediately
            if (updated.refundStatus === 'NOT_APPLICABLE' || updated.netRefundAmount <= 0) {
                return executeTermination(terminationId, reviewerId, tx);
            }

            return updated;
        });
    }

    /**
     * Initiate refund processing
     */
    async function processRefund(
        terminationId: string,
        adminId: string,
        data: ProcessRefundInput
    ) {
        return prisma.$transaction(async (tx: any) => {
            const termination = await tx.contractTermination.findUnique({
                where: { id: terminationId },
            });

            if (!termination) {
                throw new AppError(404, 'Termination request not found');
            }

            if (termination.status !== 'PENDING_REFUND') {
                throw new AppError(400, `Cannot process refund in ${termination.status} status`);
            }

            if (termination.netRefundAmount <= 0) {
                throw new AppError(400, 'No refund amount to process');
            }

            // TODO: Integrate with payment gateway to initiate refund
            // For now, we mark as INITIATED and expect webhook/manual completion

            const updated = await tx.contractTermination.update({
                where: { id: terminationId },
                data: {
                    status: 'REFUND_IN_PROGRESS',
                    refundStatus: 'INITIATED',
                    refundMethod: data.refundMethod,
                    refundAccountDetails: data.refundAccountDetails,
                    refundInitiatedAt: new Date(),
                },
            });

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'CONTRACT.REFUND_INITIATED',
                    aggregateType: 'Contract',
                    aggregateId: termination.contractId,
                    queueName: 'payments',
                    payload: JSON.stringify({
                        contractId: termination.contractId,
                        terminationId,
                        refundAmount: termination.netRefundAmount,
                        refundMethod: data.refundMethod,
                    }),
                    actorId: adminId,
                },
            });

            return updated;
        });
    }

    /**
     * Complete refund (after gateway confirmation)
     */
    async function completeRefund(
        terminationId: string,
        adminId: string,
        data: CompleteRefundInput
    ) {
        return prisma.$transaction(async (tx: any) => {
            const termination = await tx.contractTermination.findUnique({
                where: { id: terminationId },
            });

            if (!termination) {
                throw new AppError(404, 'Termination request not found');
            }

            if (termination.status !== 'REFUND_IN_PROGRESS') {
                throw new AppError(400, `Cannot complete refund in ${termination.status} status`);
            }

            const updated = await tx.contractTermination.update({
                where: { id: terminationId },
                data: {
                    status: 'REFUND_COMPLETED',
                    refundStatus: 'COMPLETED',
                    refundReference: data.refundReference,
                    refundCompletedAt: new Date(),
                    ...(data.actualRefundAmount !== undefined && {
                        netRefundAmount: data.actualRefundAmount,
                    }),
                },
            });

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'CONTRACT.REFUND_COMPLETED',
                    aggregateType: 'Contract',
                    aggregateId: termination.contractId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        contractId: termination.contractId,
                        terminationId,
                        refundReference: data.refundReference,
                        refundAmount: updated.netRefundAmount,
                    }),
                    actorId: adminId,
                },
            });

            // Now execute the termination
            return executeTermination(terminationId, adminId, tx);
        });
    }

    /**
     * Execute termination (final step - update contract, release unit)
     */
    async function executeTermination(
        terminationId: string,
        actorId: string,
        txOrPrisma: any = prisma
    ) {
        const execute = async (tx: any) => {
            const termination = await tx.contractTermination.findUnique({
                where: { id: terminationId },
                include: {
                    contract: {
                        include: { propertyUnit: true },
                    },
                },
            });

            if (!termination) {
                throw new AppError(404, 'Termination request not found');
            }

            // Only execute if in correct state
            const validStatuses = ['PENDING_REFUND', 'REFUND_COMPLETED', 'COMPLETED'];
            if (!validStatuses.includes(termination.status) && termination.refundStatus !== 'NOT_APPLICABLE') {
                throw new AppError(400, `Cannot execute termination in ${termination.status} status`);
            }

            // Update contract status
            await tx.contract.update({
                where: { id: termination.contractId },
                data: {
                    status: 'TERMINATED',
                    state: 'TERMINATED',
                    terminatedAt: new Date(),
                },
            });

            // Release property unit
            if (termination.contract.propertyUnitId) {
                await tx.propertyUnit.update({
                    where: { id: termination.contract.propertyUnitId },
                    data: {
                        status: 'AVAILABLE',
                        reservedById: null,
                        reservedAt: null,
                    },
                });

                // Update variant counters
                if (termination.contract.propertyUnit?.variantId) {
                    await tx.propertyVariant.update({
                        where: { id: termination.contract.propertyUnit.variantId },
                        data: {
                            availableUnits: { increment: 1 },
                            reservedUnits: { decrement: 1 },
                        },
                    });
                }
            }

            // Record transition
            await tx.contractEvent.create({
                data: {
                    contractId: termination.contractId,
                    eventType: 'STATE.TRANSITION',
                    eventGroup: 'STATE_CHANGE',
                    fromState: termination.contract.status,
                    toState: 'TERMINATED',
                    trigger: 'TERMINATE',
                    data: {
                        terminationId,
                        type: termination.type,
                        reason: termination.reason,
                        netRefundAmount: termination.netRefundAmount,
                    },
                    actorId: actorId,
                    actorType: 'USER',
                },
            });

            // Update termination record
            const updated = await tx.contractTermination.update({
                where: { id: terminationId },
                data: {
                    status: 'COMPLETED',
                    executedAt: new Date(),
                    completedAt: new Date(),
                    unitReleasedAt: new Date(),
                },
            });

            // Emit domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'CONTRACT.TERMINATED',
                    aggregateType: 'Contract',
                    aggregateId: termination.contractId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        contractId: termination.contractId,
                        terminationId,
                        type: termination.type,
                        reason: termination.reason,
                        netRefundAmount: termination.netRefundAmount,
                    }),
                    actorId,
                },
            });

            // Send contract terminated notification
            try {
                const buyer = await tx.user.findUnique({
                    where: { id: termination.contract.buyerId },
                });

                if (buyer?.email) {
                    await sendContractTerminatedNotification({
                        email: buyer.email,
                        userName: `${buyer.firstName} ${buyer.lastName}`,
                        contractId: termination.contractId,
                        contractNumber: termination.contract.contractNumber,
                        terminationDate: new Date(),
                        refundAmount: termination.netRefundAmount || 0,
                        refundStatus: termination.netRefundAmount > 0 ? 'Refund will be processed within 5-7 business days' : 'No refund applicable',
                        supportUrl: `${DASHBOARD_URL}/support`,
                    });
                }
            } catch (error) {
                console.error('Failed to send contract terminated notification:', error);
            }

            return updated;
        };

        // Check if we're already in a transaction
        if (txOrPrisma.$transaction) {
            return prisma.$transaction(execute);
        }
        return execute(txOrPrisma);
    }

    /**
     * Cancel termination request (before approval)
     */
    async function cancelTermination(
        terminationId: string,
        userId: string,
        data?: CancelTerminationInput
    ) {
        return prisma.$transaction(async (tx: any) => {
            const termination = await tx.contractTermination.findUnique({
                where: { id: terminationId },
            });

            if (!termination) {
                throw new AppError(404, 'Termination request not found');
            }

            if (!['REQUESTED', 'PENDING_REVIEW'].includes(termination.status)) {
                throw new AppError(400, `Cannot cancel termination in ${termination.status} status`);
            }

            // Only initiator or admin can cancel
            if (termination.initiatorId !== userId) {
                // TODO: Check if user is admin
                throw new AppError(403, 'Only the initiator can cancel this request');
            }

            const updated = await tx.contractTermination.update({
                where: { id: terminationId },
                data: {
                    status: 'CANCELLED',
                    cancelledAt: new Date(),
                    metadata: {
                        ...(termination.metadata || {}),
                        cancellationReason: data?.reason,
                        cancelledBy: userId,
                    },
                },
            });

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'CONTRACT.TERMINATION_CANCELLED',
                    aggregateType: 'Contract',
                    aggregateId: termination.contractId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        contractId: termination.contractId,
                        terminationId,
                        reason: data?.reason,
                    }),
                    actorId: userId,
                },
            });

            return updated;
        });
    }

    /**
     * Get termination by ID
     */
    async function findById(terminationId: string) {
        const termination = await prisma.contractTermination.findUnique({
            where: { id: terminationId },
            include: {
                contract: {
                    select: {
                        id: true,
                        contractNumber: true,
                        title: true,
                        status: true,
                        buyerId: true,
                        sellerId: true,
                    },
                },
                initiator: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                reviewer: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!termination) {
            throw new AppError(404, 'Termination request not found');
        }

        return termination;
    }

    /**
     * Get all terminations for a contract
     */
    async function findByContract(contractId: string) {
        return prisma.contractTermination.findMany({
            where: { contractId },
            orderBy: { requestedAt: 'desc' },
            include: {
                initiator: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });
    }

    /**
     * Get pending terminations for review (admin)
     */
    async function findPendingReview(tenantId: string) {
        return prisma.contractTermination.findMany({
            where: {
                tenantId,
                status: { in: ['REQUESTED', 'PENDING_REVIEW'] },
            },
            orderBy: { requestedAt: 'asc' },
            include: {
                contract: {
                    select: {
                        id: true,
                        contractNumber: true,
                        title: true,
                        totalAmount: true,
                        buyer: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
                initiator: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });
    }

    return {
        requestTermination,
        adminTerminate,
        reviewTermination,
        processRefund,
        completeRefund,
        executeTermination,
        cancelTermination,
        findById,
        findByContract,
        findPendingReview,
    };
}

// Default instance
export const contractTerminationService: ContractTerminationService = createContractTerminationService();
