import { prisma } from '../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import type {
    CreatePaymentInput,
    ProcessPaymentInput,
    RefundPaymentInput,
} from '../validators/contract-payment.validator';
import {
    sendPaymentReceivedNotification,
    sendPaymentFailedNotification,
    formatCurrency,
    formatDate,
} from '../lib/notifications';
import { contractPhaseService } from './contract-phase.service';

// Dashboard URL base
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://app.contribuild.com';

class ContractPaymentService {
    /**
     * Generate a unique payment reference
     */
    private generateReference(): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `PAY-${timestamp}-${random}`;
    }

    /**
     * Create a payment for a contract
     */
    async create(data: CreatePaymentInput, userId: string) {
        const contract = await prisma.contract.findUnique({
            where: { id: data.contractId },
            include: {
                phases: true,
            },
        });

        if (!contract) {
            throw new AppError(404, 'Contract not found');
        }

        // Validate phase if provided
        let phase = null;
        let paymentPhase = null;
        if (data.phaseId) {
            phase = await prisma.contractPhase.findUnique({
                where: { id: data.phaseId },
                include: {
                    paymentPhase: true,
                },
            });

            if (!phase || phase.contractId !== data.contractId) {
                throw new AppError(400, 'Invalid phase for this contract');
            }

            paymentPhase = phase.paymentPhase;

            // Check if this phase collects funds (only payment phases have collectFunds)
            // If collectFunds = false, we don't create payment records via this endpoint
            // (they would come from external bank webhooks / reconciliation)
            if (paymentPhase && paymentPhase.collectFunds === false) {
                throw new AppError(400, 'This phase does not collect funds directly. Payments are tracked via external bank reconciliation.');
            }
        }

        // Validate installment if provided
        let installment = null;
        if (data.installmentId) {
            installment = await prisma.contractInstallment.findUnique({
                where: { id: data.installmentId },
                include: {
                    paymentPhase: {
                        include: {
                            phase: true,
                        },
                    },
                },
            });

            if (!installment) {
                throw new AppError(404, 'Installment not found');
            }

            // Check if the installment's phase collects funds
            if (installment.paymentPhase && installment.paymentPhase.collectFunds === false) {
                throw new AppError(400, 'This phase does not collect funds directly. Payments are tracked via external bank reconciliation.');
            }

            // Auto-set phase from installment
            if (!data.phaseId && installment.paymentPhase?.phase) {
                data.phaseId = installment.paymentPhase.phase.id;
            }
        }

        const reference = data.reference ?? this.generateReference();

        const payment = await prisma.$transaction(async (tx) => {
            // Create payment record
            const created = await tx.contractPayment.create({
                data: {
                    contractId: data.contractId,
                    phaseId: data.phaseId,
                    installmentId: data.installmentId,
                    payerId: userId,
                    amount: data.amount,
                    paymentMethod: data.paymentMethod,
                    status: 'PENDING',
                    reference,
                },
            });

            // Write domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'PAYMENT.INITIATED',
                    aggregateType: 'ContractPayment',
                    aggregateId: created.id,
                    queueName: 'payments',
                    payload: JSON.stringify({
                        paymentId: created.id,
                        contractId: data.contractId,
                        phaseId: data.phaseId,
                        installmentId: data.installmentId,
                        amount: data.amount,
                        reference,
                    }),
                    actorId: userId,
                },
            });

            return created;
        });

        return payment;
    }

    async findById(id: string): Promise<any> {
        const payment = await prisma.contractPayment.findUnique({
            where: { id },
            include: {
                contract: true,
                phase: true,
                installment: true,
                payer: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!payment) {
            throw new AppError(404, 'Payment not found');
        }

        return payment;
    }

    async findByReference(reference: string): Promise<any> {
        const payment = await prisma.contractPayment.findUnique({
            where: { reference },
            include: {
                contract: true,
                phase: true,
                installment: true,
            },
        });

        if (!payment) {
            throw new AppError(404, 'Payment not found');
        }

        return payment;
    }

    async findByContract(contractId: string): Promise<any[]> {
        const payments = await prisma.contractPayment.findMany({
            where: { contractId },
            orderBy: { createdAt: 'desc' },
            include: {
                phase: true,
                installment: true,
            },
        });
        return payments;
    }

    async findByPhase(phaseId: string) {
        const payments = await prisma.contractPayment.findMany({
            where: { phaseId },
            orderBy: { createdAt: 'desc' },
            include: {
                installment: true,
            },
        });
        return payments;
    }

    /**
     * Process a payment (typically called from webhook/callback)
     */
    async process(data: ProcessPaymentInput): Promise<any> {
        const payment = await this.findByReference(data.reference);

        if (payment.status === 'COMPLETED') {
            // Idempotent - already processed
            return payment;
        }

        if (payment.status !== 'INITIATED' && payment.status !== 'PENDING') {
            throw new AppError(400, `Cannot process payment in ${payment.status} status`);
        }

        if (data.status === 'COMPLETED') {
            return this.completePayment(payment.id, data.gatewayResponse);
        } else {
            return this.failPayment(payment.id, data.gatewayResponse);
        }
    }

    /**
     * Complete a payment and update related records
     */
    private async completePayment(paymentId: string, gatewayResponse?: Record<string, any>) {
        const payment = await this.findById(paymentId);

        const { updated, activatedNextPhaseId } = await prisma.$transaction(async (tx) => {
            let activatedNextPhaseId: string | null = null;

            // Update payment status
            const result = await tx.contractPayment.update({
                where: { id: paymentId },
                data: {
                    status: 'COMPLETED',
                    processedAt: new Date(),
                    gatewayResponse: gatewayResponse ? JSON.stringify(gatewayResponse) : null,
                },
            });

            // Update installment if linked
            if (payment.installmentId) {
                const installment = await tx.contractInstallment.findUnique({
                    where: { id: payment.installmentId },
                });

                if (installment) {
                    const newPaidAmount = installment.paidAmount + payment.amount;
                    const isPaid = newPaidAmount >= installment.amount;

                    await tx.contractInstallment.update({
                        where: { id: payment.installmentId },
                        data: {
                            paidAmount: newPaidAmount,
                            status: isPaid ? 'PAID' : 'PARTIALLY_PAID',
                            paidDate: isPaid ? new Date() : null,
                        },
                    });
                }
            }

            // Update phase totals (via PaymentPhase extension)
            if (payment.phaseId) {
                const phase = await tx.contractPhase.findUnique({
                    where: { id: payment.phaseId },
                    include: {
                        paymentPhase: true,
                    },
                });

                if (phase && phase.paymentPhase) {
                    const paymentPhase = phase.paymentPhase;
                    const newPaidAmount = paymentPhase.paidAmount + payment.amount;
                    const newRemainingAmount = (paymentPhase.totalAmount ?? 0) - newPaidAmount;
                    const isFullyPaid = newRemainingAmount <= 0;

                    // Update PaymentPhase extension
                    await tx.paymentPhase.update({
                        where: { id: paymentPhase.id },
                        data: {
                            paidAmount: newPaidAmount,
                        },
                    });

                    // Update ContractPhase status
                    if (isFullyPaid) {
                        await tx.contractPhase.update({
                            where: { id: payment.phaseId },
                            data: {
                                status: 'COMPLETED',
                                completedAt: new Date(),
                            },
                        });
                    }

                    // If phase is completed, auto-activate next phase
                    if (isFullyPaid) {
                        // Write phase completed event
                        await tx.domainEvent.create({
                            data: {
                                id: uuidv4(),
                                eventType: 'PHASE.COMPLETED',
                                aggregateType: 'ContractPhase',
                                aggregateId: payment.phaseId,
                                queueName: 'contract-steps',
                                payload: JSON.stringify({
                                    phaseId: payment.phaseId,
                                    contractId: payment.contractId,
                                    phaseType: phase.phaseType,
                                }),
                            },
                        });

                        // Auto-activate next phase
                        const nextPhase = await tx.contractPhase.findFirst({
                            where: {
                                contractId: payment.contractId,
                                order: phase.order + 1,
                            },
                        });

                        if (nextPhase) {
                            await tx.contractPhase.update({
                                where: { id: nextPhase.id },
                                data: {
                                    status: 'IN_PROGRESS',
                                },
                            });

                            // Track the activated phase for post-transaction processing
                            activatedNextPhaseId = nextPhase.id;

                            // Update contract's current phase
                            await tx.contract.update({
                                where: { id: payment.contractId },
                                data: { currentPhaseId: nextPhase.id },
                            });

                            // Write phase activated event
                            await tx.domainEvent.create({
                                data: {
                                    id: uuidv4(),
                                    eventType: 'PHASE.ACTIVATED',
                                    aggregateType: 'ContractPhase',
                                    aggregateId: nextPhase.id,
                                    queueName: 'contract-steps',
                                    payload: JSON.stringify({
                                        phaseId: nextPhase.id,
                                        contractId: payment.contractId,
                                        phaseType: nextPhase.phaseType,
                                    }),
                                },
                            });
                        }
                    }
                }
            }

            // Find next unpaid installment for this contract (via PaymentPhase)
            const nextInstallment = await tx.contractInstallment.findFirst({
                where: {
                    paymentPhase: { phase: { contractId: payment.contractId } },
                    status: { in: ['PENDING', 'PARTIALLY_PAID'] },
                },
                orderBy: { dueDate: 'asc' },
            });

            if (nextInstallment) {
                await tx.contract.update({
                    where: { id: payment.contractId },
                    data: { nextPaymentDueDate: nextInstallment.dueDate },
                });
            }

            // Write domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'PAYMENT.COMPLETED',
                    aggregateType: 'ContractPayment',
                    aggregateId: paymentId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        paymentId,
                        contractId: payment.contractId,
                        amount: payment.amount,
                    }),
                },
            });

            return { updated: result, activatedNextPhaseId };
        });

        // If a new phase was activated, process any auto-executable steps (e.g., GENERATE_DOCUMENT)
        if (activatedNextPhaseId) {
            try {
                // Use the contract's buyer ID for auto-generated documents
                const userId = payment.contract?.buyerId || payment.payerId;
                if (userId) {
                    await contractPhaseService.processAutoExecutableSteps(activatedNextPhaseId, userId);
                }
            } catch (error) {
                console.error('[ContractPaymentService] Failed to process auto-executable steps for activated phase', {
                    phaseId: activatedNextPhaseId,
                    error: error instanceof Error ? error.message : String(error),
                });
                // Don't throw - the phase is still activated, just auto-steps failed
            }
        }

        const completedPayment = await this.findById(updated.id);

        // Send payment received notification
        try {
            const contract = await prisma.contract.findUnique({
                where: { id: payment.contractId },
                include: {
                    buyer: { select: { email: true, firstName: true } },
                    propertyUnit: {
                        include: {
                            variant: { include: { property: true } }
                        }
                    },
                },
            });

            if (contract?.buyer?.email) {
                // Find next installment for next payment date
                const nextInstallment = await prisma.contractInstallment.findFirst({
                    where: {
                        paymentPhase: { phase: { contractId: payment.contractId } },
                        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
                    },
                    orderBy: { dueDate: 'asc' },
                });

                // Calculate remaining balance from all payment phases
                const allPaymentPhases = await prisma.paymentPhase.findMany({
                    where: { phase: { contractId: payment.contractId } },
                });
                const totalPaid = allPaymentPhases.reduce((sum, pp) => sum + pp.paidAmount, 0);
                const remainingBalance = Math.max(0, contract.totalAmount - totalPaid);

                await sendPaymentReceivedNotification({
                    email: contract.buyer.email,
                    userName: contract.buyer.firstName || 'Valued Customer',
                    contractId: contract.id,
                    contractNumber: contract.contractNumber,
                    paymentAmount: payment.amount,
                    paymentDate: new Date(),
                    paymentReference: payment.reference || `PAY-${paymentId.substring(0, 8)}`,
                    remainingBalance,
                    nextPaymentDate: nextInstallment?.dueDate,
                    nextPaymentAmount: nextInstallment?.amount,
                    dashboardUrl: `${DASHBOARD_URL}/contracts/${payment.contractId}`,
                }, paymentId);
            }
        } catch (error) {
            console.error('[Payment] Failed to send received notification', { paymentId, error });
        }

        return completedPayment;
    }

    /**
     * Mark a payment as failed
     */
    private async failPayment(paymentId: string, gatewayResponse?: Record<string, any>) {
        const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.contractPayment.update({
                where: { id: paymentId },
                data: {
                    status: 'FAILED',
                    processedAt: new Date(),
                    gatewayResponse: gatewayResponse ? JSON.stringify(gatewayResponse) : null,
                },
            });

            const payment = await tx.contractPayment.findUnique({
                where: { id: paymentId },
            });

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'PAYMENT.FAILED',
                    aggregateType: 'ContractPayment',
                    aggregateId: paymentId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        paymentId,
                        contractId: payment?.contractId,
                    }),
                },
            });

            return result;
        });

        // Send payment failed notification
        try {
            const contract = await prisma.contract.findUnique({
                where: { id: updated.contractId },
                include: { buyer: true },
            });

            if (contract?.buyer?.email) {
                const nextInstallment = await prisma.contractInstallment.findFirst({
                    where: {
                        paymentPhase: { phase: { contractId: contract.id } },
                        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
                    },
                    orderBy: { dueDate: 'asc' },
                });

                await sendPaymentFailedNotification({
                    email: contract.buyer.email,
                    userName: `${contract.buyer.firstName} ${contract.buyer.lastName}`,
                    contractId: contract.id,
                    paymentAmount: updated.amount,
                    amountDue: nextInstallment?.amount || updated.amount,
                    dueDate: nextInstallment?.dueDate || new Date(),
                    retryUrl: `${DASHBOARD_URL}/mortgages/${contract.id}/payments/${updated.id}/retry`,
                    supportUrl: `${DASHBOARD_URL}/support`,
                });
            }
        } catch (error) {
            console.error('Failed to send payment failed notification:', error);
        }

        return this.findById(updated.id);
    }

    /**
     * Refund a payment
     */
    async refund(paymentId: string, data: RefundPaymentInput, userId: string): Promise<any> {
        const payment = await this.findById(paymentId);

        if (payment.status !== 'COMPLETED') {
            throw new AppError(400, 'Can only refund completed payments');
        }

        const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.contractPayment.update({
                where: { id: paymentId },
                data: {
                    status: 'REFUNDED',
                },
            });

            // Reverse installment update if linked
            if (payment.installmentId) {
                const installment = await tx.contractInstallment.findUnique({
                    where: { id: payment.installmentId },
                });

                if (installment) {
                    const newPaidAmount = Math.max(0, installment.paidAmount - payment.amount);
                    await tx.contractInstallment.update({
                        where: { id: payment.installmentId },
                        data: {
                            paidAmount: newPaidAmount,
                            status: newPaidAmount === 0 ? 'PENDING' : 'PARTIALLY_PAID',
                            paidDate: null,
                        },
                    });
                }
            }

            // Reverse phase totals (via PaymentPhase extension)
            if (payment.phaseId) {
                const phase = await tx.contractPhase.findUnique({
                    where: { id: payment.phaseId },
                    include: {
                        paymentPhase: true,
                    },
                });

                if (phase && phase.paymentPhase) {
                    await tx.paymentPhase.update({
                        where: { id: phase.paymentPhase.id },
                        data: {
                            paidAmount: Math.max(0, phase.paymentPhase.paidAmount - payment.amount),
                        },
                    });
                }
            }

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'PAYMENT.REFUNDED',
                    aggregateType: 'ContractPayment',
                    aggregateId: paymentId,
                    queueName: 'accounting',
                    payload: JSON.stringify({
                        paymentId,
                        contractId: payment.contractId,
                        amount: payment.amount,
                        reason: data.reason,
                    }),
                    actorId: userId,
                },
            });

            return result;
        });

        return this.findById(updated.id);
    }

    /**
     * Pay-ahead: apply excess payment to future installments
     */
    async payAhead(contractId: string, amount: number, userId: string) {
        const contract = await prisma.contract.findUnique({
            where: { id: contractId },
        });

        if (!contract) {
            throw new AppError(404, 'Contract not found');
        }

        // Find all pending installments for this contract (via PaymentPhase)
        const pendingInstallments = await prisma.contractInstallment.findMany({
            where: {
                paymentPhase: { phase: { contractId } },
                status: { in: ['PENDING', 'PARTIALLY_PAID'] },
            },
            orderBy: { dueDate: 'asc' },
            include: {
                paymentPhase: {
                    include: {
                        phase: true,
                    },
                },
            },
        });

        if (pendingInstallments.length === 0) {
            throw new AppError(400, 'No pending installments to pay');
        }

        let remainingAmount = amount;
        const paidInstallments: string[] = [];

        await prisma.$transaction(async (tx) => {
            for (const installment of pendingInstallments) {
                if (remainingAmount <= 0) break;

                const amountOwed = installment.amount - installment.paidAmount;
                const paymentAmount = Math.min(remainingAmount, amountOwed);
                const phaseId = installment.paymentPhase?.phase?.id;

                // Create payment for this installment
                await tx.contractPayment.create({
                    data: {
                        contractId,
                        phaseId: phaseId,
                        installmentId: installment.id,
                        payerId: userId,
                        amount: paymentAmount,
                        principalAmount: (paymentAmount / installment.amount) * installment.principalAmount,
                        interestAmount: (paymentAmount / installment.amount) * installment.interestAmount,
                        paymentMethod: 'WALLET',
                        status: 'COMPLETED',
                        processedAt: new Date(),
                        reference: this.generateReference(),
                    },
                });

                // Update installment
                const newPaidAmount = installment.paidAmount + paymentAmount;
                const isPaid = newPaidAmount >= installment.amount;

                await tx.contractInstallment.update({
                    where: { id: installment.id },
                    data: {
                        paidAmount: newPaidAmount,
                        status: isPaid ? 'PAID' : 'PARTIALLY_PAID',
                        paidDate: isPaid ? new Date() : null,
                    },
                });

                // Update PaymentPhase paidAmount
                if (installment.paymentPhaseId) {
                    await tx.paymentPhase.update({
                        where: { id: installment.paymentPhaseId },
                        data: {
                            paidAmount: { increment: paymentAmount },
                        },
                    });
                }

                remainingAmount -= paymentAmount;
                if (isPaid) {
                    paidInstallments.push(installment.id);
                }
            }

            // Write domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'PAYMENT.PAY_AHEAD',
                    aggregateType: 'Contract',
                    aggregateId: contractId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        contractId,
                        totalPaid: amount - remainingAmount,
                        installmentsPaid: paidInstallments.length,
                        remainingCredit: remainingAmount,
                    }),
                    actorId: userId,
                },
            });
        });

        return {
            totalPaid: amount - remainingAmount,
            installmentsPaid: paidInstallments.length,
            remainingCredit: remainingAmount,
        };
    }
}

export const contractPaymentService = new ContractPaymentService();
