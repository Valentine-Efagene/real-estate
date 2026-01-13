import { prisma } from '../lib/prisma';
import {
    AppError,
    Prisma,
    ApprovalRequestType,
    ApprovalRequestPriority,
    PhaseCategory,
} from '@valentine-efagene/qshelter-common';
import { approvalRequestService } from './approval-request.service';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Property Transfer Service
// =============================================================================
// Handles transferring a application to a different property.
// BUSINESS RULE: All payments are refunded to the buyer's wallet.
// The new application starts fresh with zero payments.
// The buyer can optionally apply wallet balance as equity on the new application.
// =============================================================================

export interface CreateTransferRequestInput {
    sourceApplicationId: string;
    targetPropertyUnitId: string;
    reason?: string;
    requestedById: string;
    tenantId: string;
}

export interface ApproveTransferInput {
    requestId: string;
    reviewerId: string;
    reviewNotes?: string;
    priceAdjustmentHandling?: 'ADD_TO_MORTGAGE' | 'REQUIRE_PAYMENT' | 'CREDIT_BUYER';
    tenantId: string;
}

export interface RejectTransferInput {
    requestId: string;
    reviewerId: string;
    reason: string;
    tenantId: string;
}

class PropertyTransferService {
    /**
     * Create a new property transfer request
     */
    async createRequest(input: CreateTransferRequestInput) {
        const { sourceApplicationId, targetPropertyUnitId, reason, requestedById, tenantId } = input;

        // Validate source application exists and is active
        const sourceApplication = await prisma.application.findFirst({
            where: { id: sourceApplicationId, tenantId },
            include: {
                propertyUnit: {
                    include: {
                        variant: true,
                    },
                },
                phases: {
                    include: {
                        questionnairePhase: {
                            include: { fields: true },
                        },
                        documentationPhase: {
                            include: {
                                steps: {
                                    include: {
                                        requiredDocuments: true,
                                    },
                                },
                            },
                        },
                        paymentPhase: {
                            include: {
                                installments: true,
                                paymentPlan: true,
                            },
                        },
                    },
                },
                payments: true,
            },
        });

        if (!sourceApplication) {
            throw new AppError(404, 'Source application not found');
        }

        if (sourceApplication.status !== 'ACTIVE' && sourceApplication.status !== 'PENDING') {
            throw new AppError(400, `Cannot transfer application with status ${sourceApplication.status}`);
        }

        // Validate buyer is the requestor
        if (sourceApplication.buyerId !== requestedById) {
            throw new AppError(403, 'Only the application buyer can request a transfer');
        }

        // Check no pending transfer request exists
        const existingRequest = await prisma.propertyTransferRequest.findFirst({
            where: {
                sourceApplicationId,
                status: { in: ['PENDING', 'APPROVED', 'IN_PROGRESS'] },
            },
        });

        if (existingRequest) {
            throw new AppError(400, 'A transfer request is already pending for this application');
        }

        // Validate target property unit exists and is available
        const targetUnit = await prisma.propertyUnit.findUnique({
            where: { id: targetPropertyUnitId },
            include: {
                variant: {
                    include: {
                        property: true,
                    },
                },
            },
        });

        if (!targetUnit) {
            throw new AppError(404, 'Target property unit not found');
        }

        if (targetUnit.status !== 'AVAILABLE') {
            throw new AppError(400, `Target unit is not available (status: ${targetUnit.status})`);
        }

        // Cannot transfer to the same unit
        if (targetPropertyUnitId === sourceApplication.propertyUnitId) {
            throw new AppError(400, 'Cannot transfer to the same property unit');
        }

        // Calculate price adjustment
        const sourcePrice = sourceApplication.totalAmount;
        const targetPrice = targetUnit.priceOverride ?? targetUnit.variant.price;
        const priceAdjustment = targetPrice - sourcePrice;

        // Create the transfer request
        const request = await prisma.propertyTransferRequest.create({
            data: {
                tenantId,
                sourceApplicationId,
                targetPropertyUnitId,
                requestedById,
                reason,
                status: 'PENDING',
                sourceTotalAmount: sourcePrice,
                targetTotalAmount: targetPrice,
                priceAdjustment,
            },
            include: {
                sourceApplication: {
                    select: {
                        id: true,
                        applicationNumber: true,
                        title: true,
                        totalAmount: true,
                    },
                },
                targetPropertyUnit: {
                    include: {
                        variant: {
                            include: {
                                property: {
                                    select: { id: true, title: true },
                                },
                            },
                        },
                    },
                },
                requestedBy: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });

        // Create a unified ApprovalRequest for admin dashboard
        const approvalRequest = await approvalRequestService.create(tenantId, {
            type: ApprovalRequestType.PROPERTY_TRANSFER,
            entityType: 'PropertyTransferRequest',
            entityId: request.id,
            title: `Property Transfer: ${request.sourceApplication.applicationNumber} → Unit ${targetUnit.variant?.property.title}`,
            description: reason || `Transfer request for application ${request.sourceApplication.applicationNumber} from unit ${sourceApplication.propertyUnit.unitNumber} to unit ${targetUnit.unitNumber}`,
            priority: priceAdjustment > 0 ? ApprovalRequestPriority.HIGH : ApprovalRequestPriority.NORMAL,
            requestedById,
            payload: {
                sourceApplicationId,
                targetPropertyUnitId,
                priceAdjustment,
                sourceTotalAmount: sourcePrice,
                targetTotalAmount: targetPrice,
            } as Prisma.InputJsonValue,
        });

        return request;
    }

    /**
     * Get a transfer request by ID
     */
    async getById(requestId: string, tenantId: string): Promise<any> {
        const request = await prisma.propertyTransferRequest.findFirst({
            where: { id: requestId, tenantId },
            include: {
                sourceApplication: {
                    include: {
                        propertyUnit: {
                            include: {
                                variant: {
                                    include: {
                                        property: { select: { id: true, title: true } },
                                    },
                                },
                            },
                        },
                        phases: {
                            include: {
                                questionnairePhase: {
                                    include: { fields: true },
                                },
                                documentationPhase: {
                                    include: {
                                        steps: true,
                                    },
                                },
                                paymentPhase: {
                                    include: {
                                        installments: true,
                                    },
                                },
                            },
                            orderBy: { order: 'asc' },
                        },
                        payments: {
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                },
                targetPropertyUnit: {
                    include: {
                        variant: {
                            include: {
                                property: { select: { id: true, title: true } },
                            },
                        },
                    },
                },
                targetApplication: {
                    select: { id: true, applicationNumber: true, status: true },
                },
                requestedBy: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                reviewedBy: {
                    select: { id: true, firstName: true, lastName: true },
                },
            },
        });

        if (!request) {
            throw new AppError(404, 'Transfer request not found');
        }

        return request;
    }

    /**
     * List transfer requests for a application
     */
    async listByapplication(applicationId: string, tenantId: string) {
        return prisma.propertyTransferRequest.findMany({
            where: { sourceApplicationId: applicationId, tenantId },
            include: {
                targetPropertyUnit: {
                    include: {
                        variant: {
                            include: {
                                property: { select: { id: true, title: true } },
                            },
                        },
                    },
                },
                requestedBy: {
                    select: { id: true, firstName: true, lastName: true },
                },
                reviewedBy: {
                    select: { id: true, firstName: true, lastName: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * List all pending transfer requests (admin view)
     */
    async listPending(tenantId: string) {
        return prisma.propertyTransferRequest.findMany({
            where: { tenantId, status: 'PENDING' },
            include: {
                sourceApplication: {
                    select: {
                        id: true,
                        applicationNumber: true,
                        title: true,
                        totalAmount: true,
                    },
                },
                targetPropertyUnit: {
                    include: {
                        variant: {
                            include: {
                                property: { select: { id: true, title: true } },
                            },
                        },
                    },
                },
                requestedBy: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    /**
     * Approve a transfer request and execute the transfer
     * 
     * BUSINESS RULE: All payments on the source application are refunded to the buyer's wallet.
     * The new application starts fresh with zero payments. The buyer can later apply wallet 
     * balance as equity via a separate operation.
     */
    async approve(input: ApproveTransferInput): Promise<any> {
        const { requestId, reviewerId, reviewNotes, priceAdjustmentHandling, tenantId } = input;

        // Get the request with all needed relations (polymorphic includes)
        const request = await prisma.propertyTransferRequest.findFirst({
            where: { id: requestId, tenantId },
            include: {
                sourceApplication: {
                    include: {
                        buyer: {
                            select: { id: true, walletId: true },
                        },
                        propertyUnit: true,
                        paymentMethod: {
                            include: {
                                phases: {
                                    include: {
                                        steps: true,
                                        questionnaireFields: true,
                                    },
                                    orderBy: { order: 'asc' },
                                },
                            },
                        },
                        phases: {
                            include: {
                                questionnairePhase: {
                                    include: { fields: true },
                                },
                                documentationPhase: {
                                    include: {
                                        steps: {
                                            include: {
                                                requiredDocuments: true,
                                            },
                                        },
                                    },
                                },
                                paymentPhase: {
                                    include: {
                                        installments: true,
                                        paymentPlan: true,
                                    },
                                },
                            },
                            orderBy: { order: 'asc' },
                        },
                        payments: true,
                        documents: true,
                    },
                },
                targetPropertyUnit: {
                    include: {
                        variant: true,
                    },
                },
            },
        });

        if (!request) {
            throw new AppError(404, 'Transfer request not found');
        }

        if (request.status !== 'PENDING') {
            throw new AppError(400, `Cannot approve request with status ${request.status}`);
        }

        // Check target unit is still available
        if (request.targetPropertyUnit.status !== 'AVAILABLE') {
            throw new AppError(400, 'Target property unit is no longer available');
        }

        const sourceApplication = request.sourceApplication;
        const buyer = sourceApplication.buyer;

        // Calculate total paid amount across all payment phases
        let totalPaidAmount = 0;
        for (const phase of sourceApplication.phases) {
            if (phase.paymentPhase) {
                totalPaidAmount += phase.paymentPhase.paidAmount;
            }
        }

        // Execute transfer in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Update request status to IN_PROGRESS
            await tx.propertyTransferRequest.update({
                where: { id: requestId },
                data: {
                    status: 'IN_PROGRESS',
                    reviewedById: reviewerId,
                    reviewedAt: new Date(),
                    reviewNotes,
                    priceAdjustmentHandling,
                },
            });

            // 2. Calculate new amounts based on target property price
            const targetPrice = request.targetPropertyUnit.priceOverride ??
                request.targetPropertyUnit.variant.price;

            // 3. Create refund to buyer's wallet if they have paid anything
            let refundTransactionId: string | null = null;
            if (totalPaidAmount > 0 && buyer.walletId) {
                // Create a domain event to trigger wallet credit
                // (payment-service will process this)
                refundTransactionId = uuidv4();

                await tx.domainEvent.create({
                    data: {
                        id: uuidv4(),
                        tenantId: sourceApplication.tenantId,
                        eventType: 'TRANSFER.REFUND_REQUESTED',
                        aggregateType: 'PropertyTransferRequest',
                        aggregateId: requestId,
                        queueName: 'payments',
                        payload: JSON.stringify({
                            walletId: buyer.walletId,
                            amount: totalPaidAmount,
                            reference: `TRANSFER-REFUND-${requestId}`,
                            description: `Refund for property transfer from application ${sourceApplication.applicationNumber}`,
                            source: 'transfer_refund',
                            sourceApplicationId: sourceApplication.id,
                            targetPropertyUnitId: request.targetPropertyUnitId,
                            transactionId: refundTransactionId,
                        }),
                        actorId: reviewerId,
                    },
                });
            }

            // 4. Create fresh new application for target property
            const newApplicationNumber = `${sourceApplication.applicationNumber}-T`;

            const newApplication = await tx.application.create({
                data: {
                    tenantId,
                    propertyUnitId: request.targetPropertyUnitId,
                    buyerId: sourceApplication.buyerId,
                    sellerId: sourceApplication.sellerId,
                    paymentMethodId: sourceApplication.paymentMethodId,
                    applicationNumber: newApplicationNumber,
                    title: `${sourceApplication.title} (Transferred)`,
                    description: sourceApplication.description,
                    applicationType: sourceApplication.applicationType,
                    totalAmount: targetPrice,
                    status: 'ACTIVE',
                    transferredFromId: sourceApplication.id,
                    startDate: new Date(),
                },
            });

            // 5. Create fresh phases from payment method template
            const paymentMethodPhases = sourceApplication.paymentMethod?.phases || [];
            let currentPhaseId: string | null = null;

            for (const templatePhase of paymentMethodPhases) {
                // Create base ApplicationPhase
                const newPhase = await tx.applicationPhase.create({
                    data: {
                        tenantId,
                        applicationId: newApplication.id,
                        name: templatePhase.name,
                        description: templatePhase.description,
                        phaseCategory: templatePhase.phaseCategory,
                        phaseType: templatePhase.phaseType,
                        order: templatePhase.order,
                        status: 'PENDING',
                        requiresPreviousPhaseCompletion: templatePhase.requiresPreviousPhaseCompletion,
                    },
                });

                // Set first phase as current
                if (!currentPhaseId) {
                    currentPhaseId = newPhase.id;
                }

                // Create polymorphic extension based on category
                switch (templatePhase.phaseCategory) {
                    case PhaseCategory.QUESTIONNAIRE:
                        await tx.questionnairePhase.create({
                            data: {
                                tenantId,
                                phaseId: newPhase.id,
                                totalFieldsCount: templatePhase.questionnaireFields?.length || 0,
                                completedFieldsCount: 0,
                            },
                        });
                        break;

                    case PhaseCategory.DOCUMENTATION:
                        const docPhase = await tx.documentationPhase.create({
                            data: {
                                tenantId,
                                phaseId: newPhase.id,
                                totalStepsCount: templatePhase.steps?.length || 0,
                                completedStepsCount: 0,
                                requiredDocumentsCount: 0,
                                approvedDocumentsCount: 0,
                                minimumCompletionPercentage: templatePhase.minimumCompletionPercentage,
                                completionCriterion: templatePhase.completionCriterion,
                                stepDefinitionsSnapshot: templatePhase.stepDefinitionsSnapshot || undefined,
                            },
                        });

                        // Create documentation steps from template
                        for (const stepTemplate of templatePhase.steps || []) {
                            await tx.documentationStep.create({
                                data: {
                                    tenantId,
                                    documentationPhaseId: docPhase.id,
                                    name: stepTemplate.name,
                                    stepType: stepTemplate.stepType,
                                    order: stepTemplate.order,
                                    status: 'PENDING',
                                },
                            });
                        }
                        break;

                    case PhaseCategory.PAYMENT:
                        // Calculate phase amount based on template percentage
                        let phaseAmount = 0;
                        if (templatePhase.percentOfPrice) {
                            phaseAmount = targetPrice * (templatePhase.percentOfPrice / 100);
                        }

                        await tx.paymentPhase.create({
                            data: {
                                tenantId,
                                phaseId: newPhase.id,
                                paymentPlanId: templatePhase.paymentPlanId,
                                totalAmount: phaseAmount,
                                paidAmount: 0, // Fresh start - no payments carried over
                                interestRate: templatePhase.interestRate || 0,
                                collectFunds: templatePhase.collectFunds ?? true,
                                minimumCompletionPercentage: templatePhase.minimumCompletionPercentage,
                            },
                        });
                        break;
                }
            }

            // Update application with current phase
            if (currentPhaseId) {
                await tx.application.update({
                    where: { id: newApplication.id },
                    data: { currentPhaseId },
                });
            }

            // 6. Reference documents (don't duplicate files, create new records pointing to same URLs)
            for (const doc of sourceApplication.documents) {
                await tx.applicationDocument.create({
                    data: {
                        tenantId,
                        applicationId: newApplication.id,
                        phaseId: null, // Documents not linked to new phases
                        stepId: null,
                        uploadedById: doc.uploadedById,
                        name: doc.name,
                        url: doc.url,
                        type: doc.type,
                        status: doc.status,
                    },
                });
            }

            // 7. Mark source application as TRANSFERRED
            await tx.application.update({
                where: { id: sourceApplication.id },
                data: {
                    status: 'TRANSFERRED',
                },
            });

            // 8. Reserve target unit
            await tx.propertyUnit.update({
                where: { id: request.targetPropertyUnitId },
                data: {
                    status: 'RESERVED',
                    reservedAt: new Date(),
                    reservedById: sourceApplication.buyerId,
                },
            });

            // 9. Update transfer request to COMPLETED with refund tracking
            const completedRequest = await tx.propertyTransferRequest.update({
                where: { id: requestId },
                data: {
                    status: 'COMPLETED',
                    targetApplicationId: newApplication.id,
                    refundedAmount: totalPaidAmount > 0 ? totalPaidAmount : null,
                    refundTransactionId,
                    refundedAt: totalPaidAmount > 0 ? new Date() : null,
                    completedAt: new Date(),
                },
            });

            return { request: completedRequest, newApplication, refundedAmount: totalPaidAmount };
        });

        return {
            message: 'Transfer approved successfully',
            request: result.request,
            newApplication: result.newApplication,
            refundedAmount: result.refundedAmount,
        };
    }

    /**
     * Reject a transfer request
     */
    async reject(input: RejectTransferInput) {
        const { requestId, reviewerId, reason, tenantId } = input;

        const request = await prisma.propertyTransferRequest.findFirst({
            where: { id: requestId, tenantId },
        });

        if (!request) {
            throw new AppError(404, 'Transfer request not found');
        }

        if (request.status !== 'PENDING') {
            throw new AppError(400, `Cannot reject request with status ${request.status}`);
        }

        const updated = await prisma.propertyTransferRequest.update({
            where: { id: requestId },
            data: {
                status: 'REJECTED',
                reviewedById: reviewerId,
                reviewedAt: new Date(),
                reviewNotes: reason,
            },
        });

        return updated;
    }
}

export const propertyTransferService = new PropertyTransferService();

