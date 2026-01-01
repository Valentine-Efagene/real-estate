import { prisma } from '../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import type {
    CreatePaymentInput,
    ProcessPaymentInput,
    RefundPaymentInput,
} from '../validators/contract-payment.validator';

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
        if (data.phaseId) {
            phase = await prisma.contractPhase.findUnique({
                where: { id: data.phaseId },
            });

            if (!phase || phase.contractId !== data.contractId) {
                throw new AppError(400, 'Invalid phase for this contract');
            }

            // Check if this phase collects funds
            // If collectFunds = false, we don't create payment records via this endpoint
            // (they would come from external bank webhooks / reconciliation)
            if (phase.collectFunds === false) {
                throw new AppError(400, 'This phase does not collect funds directly. Payments are tracked via external bank reconciliation.');
            }
        }

        // Validate installment if provided
        let installment = null;
        if (data.installmentId) {
            installment = await prisma.contractInstallment.findUnique({
                where: { id: data.installmentId },
                include: { phase: true },
            });

            if (!installment) {
                throw new AppError(404, 'Installment not found');
            }

            // Check if the installment's phase collects funds
            if (installment.phase && installment.phase.collectFunds === false) {
                throw new AppError(400, 'This phase does not collect funds directly. Payments are tracked via external bank reconciliation.');
            }

            // Auto-set phase from installment
            if (!data.phaseId) {
                data.phaseId = installment.phaseId;
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

    async findById(id: string) {
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

    async findByReference(reference: string) {
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

    async findByContract(contractId: string) {
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
    async process(data: ProcessPaymentInput) {
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

        const updated = await prisma.$transaction(async (tx) => {
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

            // Update phase totals
            if (payment.phaseId) {
                const phase = await tx.contractPhase.findUnique({
                    where: { id: payment.phaseId },
                });

                if (phase) {
                    const newPaidAmount = phase.paidAmount + payment.amount;
                    const newRemainingAmount = (phase.totalAmount ?? 0) - newPaidAmount;
                    const isFullyPaid = newRemainingAmount <= 0;

                    await tx.contractPhase.update({
                        where: { id: payment.phaseId },
                        data: {
                            paidAmount: newPaidAmount,
                            remainingAmount: Math.max(0, newRemainingAmount),
                            status: isFullyPaid ? 'COMPLETED' : phase.status,
                            completedAt: isFullyPaid ? new Date() : phase.completedAt,
                        },
                    });

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

            // Update contract totals
            const contract = await tx.contract.findUnique({
                where: { id: payment.contractId },
            });

            if (contract) {
                await tx.contract.update({
                    where: { id: payment.contractId },
                    data: {
                        totalPaidToDate: contract.totalPaidToDate + payment.amount,
                        totalInterestPaid: contract.totalInterestPaid + payment.interestAmount,
                    },
                });
            }

            // Find next unpaid installment for this contract
            const nextInstallment = await tx.contractInstallment.findFirst({
                where: {
                    phase: { contractId: payment.contractId },
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

            return result;
        });

        return this.findById(updated.id);
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

        return this.findById(updated.id);
    }

    /**
     * Refund a payment
     */
    async refund(paymentId: string, data: RefundPaymentInput, userId: string) {
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

            // Reverse phase totals
            if (payment.phaseId) {
                const phase = await tx.contractPhase.findUnique({
                    where: { id: payment.phaseId },
                });

                if (phase) {
                    await tx.contractPhase.update({
                        where: { id: payment.phaseId },
                        data: {
                            paidAmount: Math.max(0, phase.paidAmount - payment.amount),
                            remainingAmount: (phase.remainingAmount ?? 0) + payment.amount,
                        },
                    });
                }
            }

            // Reverse contract totals
            const contract = await tx.contract.findUnique({
                where: { id: payment.contractId },
            });

            if (contract) {
                await tx.contract.update({
                    where: { id: payment.contractId },
                    data: {
                        totalPaidToDate: Math.max(0, contract.totalPaidToDate - payment.amount),
                        totalInterestPaid: Math.max(0, contract.totalInterestPaid - payment.interestAmount),
                    },
                });
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

        // Find all pending installments for this contract
        const pendingInstallments = await prisma.contractInstallment.findMany({
            where: {
                phase: { contractId },
                status: { in: ['PENDING', 'PARTIALLY_PAID'] },
            },
            orderBy: { dueDate: 'asc' },
            include: {
                phase: true,
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

                // Create payment for this installment
                await tx.contractPayment.create({
                    data: {
                        contractId,
                        phaseId: installment.phaseId,
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

                // Update phase
                await tx.contractPhase.update({
                    where: { id: installment.phaseId },
                    data: {
                        paidAmount: { increment: paymentAmount },
                        remainingAmount: { decrement: paymentAmount },
                    },
                });

                remainingAmount -= paymentAmount;
                if (isPaid) {
                    paidInstallments.push(installment.id);
                }
            }

            // Update contract totals
            await tx.contract.update({
                where: { id: contractId },
                data: {
                    totalPaidToDate: { increment: amount - remainingAmount },
                },
            });

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
