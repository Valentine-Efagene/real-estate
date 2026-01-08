import { prisma } from '../lib/prisma';
import {
    AppError,
    Prisma,
    ApprovalRequestType,
    ApprovalRequestPriority,
    RefundStatus,
} from '@valentine-efagene/qshelter-common';
import { approvalRequestService } from './approval-request.service';

// =============================================================================
// Property Transfer Service
// =============================================================================
// Handles transferring a contract to a different property while preserving
// payments, completed workflow steps, and progress.
// =============================================================================

export interface CreateTransferRequestInput {
    sourceContractId: string;
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
        const { sourceContractId, targetPropertyUnitId, reason, requestedById, tenantId } = input;

        // Validate source contract exists and is active
        const sourceContract = await prisma.contract.findFirst({
            where: { id: sourceContractId, tenantId },
            include: {
                propertyUnit: {
                    include: {
                        variant: true,
                    },
                },
                phases: {
                    include: {
                        steps: true,
                    },
                },
                payments: true,
            },
        });

        if (!sourceContract) {
            throw new AppError(404, 'Source contract not found');
        }

        if (sourceContract.status !== 'ACTIVE' && sourceContract.status !== 'PENDING') {
            throw new AppError(400, `Cannot transfer contract with status ${sourceContract.status}`);
        }

        // Validate buyer is the requestor
        if (sourceContract.buyerId !== requestedById) {
            throw new AppError(403, 'Only the contract buyer can request a transfer');
        }

        // Check no pending transfer request exists
        const existingRequest = await prisma.propertyTransferRequest.findFirst({
            where: {
                sourceContractId,
                status: { in: ['PENDING', 'APPROVED', 'IN_PROGRESS'] },
            },
        });

        if (existingRequest) {
            throw new AppError(400, 'A transfer request is already pending for this contract');
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
        if (targetPropertyUnitId === sourceContract.propertyUnitId) {
            throw new AppError(400, 'Cannot transfer to the same property unit');
        }

        // Calculate price adjustment
        const sourcePrice = sourceContract.totalAmount;
        const targetPrice = targetUnit.priceOverride ?? targetUnit.variant.price;
        const priceAdjustment = targetPrice - sourcePrice;

        // Create the transfer request
        const request = await prisma.propertyTransferRequest.create({
            data: {
                tenantId,
                sourceContractId,
                targetPropertyUnitId,
                requestedById,
                reason,
                status: 'PENDING',
                sourceTotalAmount: sourcePrice,
                targetTotalAmount: targetPrice,
                priceAdjustment,
            },
            include: {
                sourceContract: {
                    select: {
                        id: true,
                        contractNumber: true,
                        title: true,
                        totalPaidToDate: true,
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
            title: `Property Transfer: ${request.sourceContract.contractNumber} → Unit ${targetUnit.variant?.property.title}`,
            description: reason || `Transfer request for contract ${request.sourceContract.contractNumber} from unit ${sourceContract.propertyUnit.unitNumber} to unit ${targetUnit.unitNumber}`,
            priority: priceAdjustment > 0 ? ApprovalRequestPriority.HIGH : ApprovalRequestPriority.NORMAL,
            requestedById,
            payload: {
                sourceContractId,
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
                sourceContract: {
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
                                steps: true,
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
                targetContract: {
                    select: { id: true, contractNumber: true, status: true },
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
     * List transfer requests for a contract
     */
    async listByContract(contractId: string, tenantId: string) {
        return prisma.propertyTransferRequest.findMany({
            where: { sourceContractId: contractId, tenantId },
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
                sourceContract: {
                    select: {
                        id: true,
                        contractNumber: true,
                        title: true,
                        totalAmount: true,
                        totalPaidToDate: true,
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
     */
    async approve(input: ApproveTransferInput): Promise<any> {
        const { requestId, reviewerId, reviewNotes, priceAdjustmentHandling, tenantId } = input;

        // Get the request with all needed relations
        const request = await prisma.propertyTransferRequest.findFirst({
            where: { id: requestId, tenantId },
            include: {
                sourceContract: {
                    include: {
                        propertyUnit: true,
                        phases: {
                            include: {
                                steps: {
                                    include: {
                                        requiredDocuments: true,
                                        approvals: true,
                                    },
                                },
                                installments: true,
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

        const sourceContract = request.sourceContract;

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

            // IMPORTANT: We recalculate EVERYTHING fresh as if it's a new contract
            // Then figure out how many installments the paid amount covers

            // 3. Create new contract for target property
            const newContractNumber = `${sourceContract.contractNumber}-T`;

            const newContract = await tx.contract.create({
                data: {
                    tenantId,
                    propertyUnitId: request.targetPropertyUnitId,
                    buyerId: sourceContract.buyerId,
                    sellerId: sourceContract.sellerId,
                    paymentMethodId: sourceContract.paymentMethodId,
                    contractNumber: newContractNumber,
                    title: `${sourceContract.title} (Transferred)`,
                    description: sourceContract.description,
                    contractType: sourceContract.contractType,
                    totalAmount: targetPrice,
                    // Recalculate downpayment and principal based on NEW price
                    downPayment: sourceContract.downPayment
                        ? (targetPrice * (sourceContract.downPayment / sourceContract.totalAmount))
                        : undefined,
                    downPaymentPaid: sourceContract.downPaymentPaid, // Preserve actual paid amount
                    principal: sourceContract.principal
                        ? (targetPrice * (sourceContract.principal / sourceContract.totalAmount))
                        : null,
                    interestRate: sourceContract.interestRate,
                    termMonths: sourceContract.termMonths,
                    periodicPayment: sourceContract.periodicPayment
                        ? (targetPrice / sourceContract.totalAmount) * sourceContract.periodicPayment
                        : null,
                    totalPaidToDate: sourceContract.totalPaidToDate, // Preserve actual paid amount
                    totalInterestPaid: sourceContract.totalInterestPaid,
                    monthlyIncome: sourceContract.monthlyIncome,
                    monthlyExpenses: sourceContract.monthlyExpenses,
                    preApprovalAnswers: sourceContract.preApprovalAnswers as Prisma.InputJsonValue | undefined,
                    underwritingScore: sourceContract.underwritingScore,
                    debtToIncomeRatio: sourceContract.debtToIncomeRatio,
                    status: 'ACTIVE',
                    state: 'ACTIVE',
                    transferredFromId: sourceContract.id,
                    startDate: sourceContract.startDate,
                },
            });

            // 4. Copy phases and recalculate amounts fresh (track old-to-new phase ID mapping)
            const phaseIdMap = new Map<string, string>();

            for (const phase of sourceContract.phases) {
                // Calculate NEW phase amount based on target price (fresh calculation)
                // Calculate the percentage this phase represents of the old total
                const phasePercentage = phase.totalAmount
                    ? (phase.totalAmount / sourceContract.totalAmount) * 100
                    : 0;
                const newPhaseAmount = phase.totalAmount
                    ? (targetPrice * phasePercentage) / 100
                    : null;

                const newPhase = await tx.contractPhase.create({
                    data: {
                        contractId: newContract.id,
                        paymentPlanId: phase.paymentPlanId,
                        name: phase.name,
                        description: phase.description,
                        phaseCategory: phase.phaseCategory,
                        phaseType: phase.phaseType,
                        order: phase.order,
                        status: phase.status, // Preserve completion status
                        totalAmount: newPhaseAmount,
                        paidAmount: 0, // Will recalculate below based on installment coverage
                        remainingAmount: newPhaseAmount,
                        interestRate: phase.interestRate,
                        collectFunds: phase.collectFunds,
                        approvedDocumentsCount: phase.approvedDocumentsCount,
                        requiredDocumentsCount: phase.requiredDocumentsCount,
                        completedStepsCount: phase.completedStepsCount,
                        totalStepsCount: phase.totalStepsCount,
                        dueDate: phase.dueDate,
                        startDate: phase.startDate,
                        endDate: phase.endDate,
                        activatedAt: phase.activatedAt,
                        completedAt: phase.completedAt,
                        requiresPreviousPhaseCompletion: phase.requiresPreviousPhaseCompletion,
                        minimumCompletionPercentage: phase.minimumCompletionPercentage,
                        completionCriterion: phase.completionCriterion,
                        paymentPlanSnapshot: phase.paymentPlanSnapshot as Prisma.InputJsonValue | undefined,
                        stepDefinitionsSnapshot: phase.stepDefinitionsSnapshot as Prisma.InputJsonValue | undefined,
                        requiredDocumentSnapshot: phase.requiredDocumentSnapshot as Prisma.InputJsonValue | undefined,
                    },
                });

                phaseIdMap.set(phase.id, newPhase.id);

                // Copy documentation steps with their status (track old-to-new step ID mapping)
                const stepIdMap = new Map<string, string>();

                for (const step of phase.steps) {
                    const newStep = await tx.documentationStep.create({
                        data: {
                            phaseId: newPhase.id,
                            name: step.name,
                            description: step.description,
                            stepType: step.stepType,
                            order: step.order,
                            status: step.status, // Preserve completion status
                            actionReason: step.actionReason,
                            submissionCount: step.submissionCount,
                            lastSubmittedAt: step.lastSubmittedAt,
                            metadata: step.metadata as Prisma.InputJsonValue | undefined,
                            preApprovalAnswers: step.preApprovalAnswers as Prisma.InputJsonValue | undefined,
                            underwritingScore: step.underwritingScore ?? undefined,
                            debtToIncomeRatio: step.debtToIncomeRatio ?? undefined,
                            underwritingDecision: step.underwritingDecision,
                            underwritingNotes: step.underwritingNotes,
                            assigneeId: step.assigneeId,
                            dueDate: step.dueDate,
                            completedAt: step.completedAt,
                        },
                    });

                    stepIdMap.set(step.id, newStep.id);

                    // Copy required documents config
                    for (const reqDoc of step.requiredDocuments) {
                        await tx.documentationStepDocument.create({
                            data: {
                                stepId: newStep.id,
                                documentType: reqDoc.documentType,
                                isRequired: reqDoc.isRequired,
                            },
                        });
                    }
                }

                // Copy installments with FRESH recalculation
                const installmentIdMap = new Map<string, string>();
                const oldInstallments = phase.installments.sort((a, b) =>
                    (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0)
                );

                if (oldInstallments.length > 0 && newPhaseAmount && newPhaseAmount > 0) {
                    // Calculate NEW installment amount based on NEW phase amount
                    const totalInstallmentCount = oldInstallments.length;
                    const newInstallmentAmount = newPhaseAmount / totalInstallmentCount;

                    // Figure out how many installments the paid amount covers
                    // Calculate from installments rather than trusting phase.paidAmount
                    const totalPaidForPhase = oldInstallments.reduce((sum, inst) => sum + inst.paidAmount, 0);
                    const completeInstallmentsPaid = Math.floor(totalPaidForPhase / newInstallmentAmount);
                    const partialPaymentCredit = totalPaidForPhase - (completeInstallmentsPaid * newInstallmentAmount);

                    let accumulatedPaidAmount = 0;

                    for (let i = 0; i < totalInstallmentCount; i++) {
                        const oldInstallment = oldInstallments[i];
                        const isFullyPaid = i < completeInstallmentsPaid;
                        const isPartiallyPaid = i === completeInstallmentsPaid && partialPaymentCredit > 0;

                        let installmentStatus: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' = 'PENDING';
                        let installmentPaidAmount = 0;
                        let installmentPaidDate: Date | null = null;

                        if (isFullyPaid) {
                            installmentStatus = 'PAID';
                            installmentPaidAmount = newInstallmentAmount;
                            installmentPaidDate = oldInstallment.paidDate || new Date();
                            accumulatedPaidAmount += newInstallmentAmount;
                        } else if (isPartiallyPaid) {
                            installmentStatus = 'PENDING';
                            installmentPaidAmount = partialPaymentCredit;
                            accumulatedPaidAmount += partialPaymentCredit;
                        }

                        const newInstallment = await tx.contractInstallment.create({
                            data: {
                                phaseId: newPhase.id,
                                installmentNumber: oldInstallment.installmentNumber,
                                amount: newInstallmentAmount, // NEW recalculated amount
                                principalAmount: newInstallmentAmount, // Simplified - adjust if needed
                                interestAmount: 0,
                                dueDate: oldInstallment.dueDate,
                                status: installmentStatus,
                                paidAmount: installmentPaidAmount,
                                paidDate: installmentPaidDate,
                                lateFee: 0,
                                lateFeeWaived: false,
                                gracePeriodDays: oldInstallment.gracePeriodDays,
                                gracePeriodEndDate: oldInstallment.gracePeriodEndDate,
                            },
                        });

                        installmentIdMap.set(oldInstallment.id, newInstallment.id);
                    }

                    // Update phase with recalculated paid amount
                    await tx.contractPhase.update({
                        where: { id: newPhase.id },
                        data: {
                            paidAmount: accumulatedPaidAmount,
                            remainingAmount: newPhaseAmount - accumulatedPaidAmount,
                        },
                    });
                }

                // If no installments were processed but source phase has paidAmount, preserve it
                if (oldInstallments.length === 0 && phase.paidAmount > 0) {
                    const effectiveNewPhaseAmount = newPhaseAmount ?? (
                        phase.phaseType === 'DOWNPAYMENT' ? (newContract.downPayment ?? 0) :
                            phase.phaseType === 'MORTGAGE' ? (newContract.principal ?? 0) :
                                0
                    );

                    await tx.contractPhase.update({
                        where: { id: newPhase.id },
                        data: {
                            paidAmount: phase.paidAmount,
                            remainingAmount: Math.max(0, effectiveNewPhaseAmount - phase.paidAmount),
                        },
                    });
                }

                // Update step ID maps for current phase
                for (const [oldStepId, newStepId] of stepIdMap) {
                    // Also update phase.currentStepId if it matches
                    if (phase.currentStepId === oldStepId) {
                        await tx.contractPhase.update({
                            where: { id: newPhase.id },
                            data: { currentStepId: newStepId },
                        });
                    }
                }
            }

            // 4.5. Check for overpayment and create refund request if necessary
            // Calculate total new downpayment required
            const newDownpaymentRequired = newContract.downPayment || 0;
            const totalPaidAmount = sourceContract.downPaymentPaid || 0;

            if (totalPaidAmount > newDownpaymentRequired) {
                const overpaymentAmount = totalPaidAmount - newDownpaymentRequired;

                // Create refund request for overpayment
                await tx.contractRefund.create({
                    data: {
                        tenantId,
                        contractId: newContract.id,
                        amount: overpaymentAmount,
                        reason: `Overpayment from property transfer: ₦${totalPaidAmount.toLocaleString()} paid on old property, ₦${newDownpaymentRequired.toLocaleString()} required on new property`,
                        status: 'PENDING',
                        requestedById: reviewerId,
                        requestedAt: new Date(),
                    },
                });
            }

            // 5. Migrate payments (create copies with references to new phase/installment IDs)
            const migratedPayments = [];
            for (const payment of sourceContract.payments) {
                const newPhaseId = payment.phaseId ? phaseIdMap.get(payment.phaseId) : null;

                const migratedPayment = await tx.contractPayment.create({
                    data: {
                        contractId: newContract.id,
                        phaseId: newPhaseId,
                        installmentId: null, // Would need proper mapping from installment ID map
                        payerId: payment.payerId,
                        amount: payment.amount,
                        principalAmount: payment.principalAmount,
                        interestAmount: payment.interestAmount,
                        lateFeeAmount: payment.lateFeeAmount,
                        paymentMethod: payment.paymentMethod,
                        status: payment.status,
                        reference: `${payment.reference}-MIGRATED`,
                        gatewayResponse: payment.gatewayResponse,
                        processedAt: payment.processedAt,
                    },
                });
                migratedPayments.push(migratedPayment);
            }

            // 6. Reference documents (don't duplicate files, create new records pointing to same URLs)
            for (const doc of sourceContract.documents) {
                const newPhaseId = doc.phaseId ? phaseIdMap.get(doc.phaseId) : null;

                await tx.contractDocument.create({
                    data: {
                        contractId: newContract.id,
                        phaseId: newPhaseId,
                        stepId: null, // Would need proper mapping
                        uploadedById: doc.uploadedById,
                        name: doc.name,
                        url: doc.url,
                        type: doc.type,
                        status: doc.status,
                    },
                });
            }

            // 7. Mark source contract as TRANSFERRED
            await tx.contract.update({
                where: { id: sourceContract.id },
                data: {
                    status: 'TRANSFERRED',
                    state: 'TERMINATED',
                },
            });

            // 8. Reserve target unit
            await tx.propertyUnit.update({
                where: { id: request.targetPropertyUnitId },
                data: {
                    status: 'RESERVED',
                    reservedAt: new Date(),
                    reservedById: sourceContract.buyerId,
                },
            });

            // 9. Update transfer request to COMPLETED
            const completedRequest = await tx.propertyTransferRequest.update({
                where: { id: requestId },
                data: {
                    status: 'COMPLETED',
                    targetContractId: newContract.id,
                    paymentsMigrated: migratedPayments.length,
                    completedAt: new Date(),
                },
            });

            return { request: completedRequest, newContract, paymentsMigrated: migratedPayments.length };
        });

        return {
            message: 'Transfer approved successfully',
            request: result.request,
            newContract: result.newContract,
            paymentsMigrated: result.paymentsMigrated,
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
