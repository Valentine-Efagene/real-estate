import { prisma } from '../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import type {
    CreatePaymentInput,
    ProcessPaymentInput,
    RefundPaymentInput,
} from '../validators/application-payment.validator';
import {
    sendPaymentReceivedNotification,
    sendPaymentFailedNotification,
    formatCurrency,
    formatDate,
} from '../lib/notifications';
import { applicationPhaseService } from './application-phase.service';

// Dashboard URL base
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://app.contribuild.com';

class ApplicationPaymentService {
    /**
     * Generate a unique payment reference
     */
    private generateReference(): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `PAY-${timestamp}-${random}`;
    }

    /**
     * Create a payment for a application
     */
    async create(data: CreatePaymentInput, userId: string) {
        const application = await prisma.application.findUnique({
            where: { id: data.applicationId },
            include: {
                phases: true,
            },
        });

        if (!application) {
            throw new AppError(404, 'application not found');
        }

        // Validate phase if provided
        let phase = null;
        let paymentPhase = null;
        if (data.phaseId) {
            phase = await prisma.applicationPhase.findUnique({
                where: { id: data.phaseId },
                include: {
                    paymentPhase: true,
                },
            });

            if (!phase || phase.applicationId !== data.applicationId) {
                throw new AppError(400, 'Invalid phase for this application');
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
            installment = await prisma.paymentInstallment.findUnique({
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
            const created = await tx.applicationPayment.create({
                data: {
                    tenantId: application.tenantId,
                    applicationId: data.applicationId,
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
                    tenantId: application.tenantId,
                    eventType: 'PAYMENT.INITIATED',
                    aggregateType: 'ApplicationPayment',
                    aggregateId: created.id,
                    queueName: 'payments',
                    payload: JSON.stringify({
                        paymentId: created.id,
                        applicationId: data.applicationId,
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
        const payment = await prisma.applicationPayment.findUnique({
            where: { id },
            include: {
                application: true,
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
        const payment = await prisma.applicationPayment.findUnique({
            where: { reference },
            include: {
                application: true,
                phase: true,
                installment: true,
            },
        });

        if (!payment) {
            throw new AppError(404, 'Payment not found');
        }

        return payment;
    }

    async findByApplication(applicationId: string): Promise<any[]> {
        const payments = await prisma.applicationPayment.findMany({
            where: { applicationId },
            orderBy: { createdAt: 'desc' },
            include: {
                phase: true,
                installment: true,
            },
        });
        return payments;
    }

    async findByPhase(phaseId: string) {
        const payments = await prisma.applicationPayment.findMany({
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
            const result = await tx.applicationPayment.update({
                where: { id: paymentId },
                data: {
                    status: 'COMPLETED',
                    processedAt: new Date(),
                    gatewayResponse: gatewayResponse ? JSON.stringify(gatewayResponse) : null,
                },
            });

            // Update installment if linked
            if (payment.installmentId) {
                const installment = await tx.paymentInstallment.findUnique({
                    where: { id: payment.installmentId },
                });

                if (installment) {
                    const newPaidAmount = installment.paidAmount + payment.amount;
                    const isPaid = newPaidAmount >= installment.amount;

                    await tx.paymentInstallment.update({
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
                const phase = await tx.applicationPhase.findUnique({
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

                    // Update ApplicationPhase status
                    if (isFullyPaid) {
                        await tx.applicationPhase.update({
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
                                tenantId: payment.tenantId,
                                eventType: 'PHASE.COMPLETED',
                                aggregateType: 'ApplicationPhase',
                                aggregateId: payment.phaseId,
                                queueName: 'application-steps',
                                payload: JSON.stringify({
                                    phaseId: payment.phaseId,
                                    applicationId: payment.applicationId,
                                    phaseType: phase.phaseType,
                                }),
                            },
                        });

                        // Auto-activate next phase
                        const nextPhase = await tx.applicationPhase.findFirst({
                            where: {
                                applicationId: payment.applicationId,
                                order: phase.order + 1,
                            },
                        });

                        if (nextPhase) {
                            await tx.applicationPhase.update({
                                where: { id: nextPhase.id },
                                data: {
                                    status: 'IN_PROGRESS',
                                },
                            });

                            // Track the activated phase for post-transaction processing
                            activatedNextPhaseId = nextPhase.id;

                            // Update application's current phase
                            await tx.application.update({
                                where: { id: payment.applicationId },
                                data: { currentPhaseId: nextPhase.id },
                            });

                            // Write phase activated event
                            await tx.domainEvent.create({
                                data: {
                                    id: uuidv4(),
                                    tenantId: payment.tenantId,
                                    eventType: 'PHASE.ACTIVATED',
                                    aggregateType: 'ApplicationPhase',
                                    aggregateId: nextPhase.id,
                                    queueName: 'application-steps',
                                    payload: JSON.stringify({
                                        phaseId: nextPhase.id,
                                        applicationId: payment.applicationId,
                                        phaseType: nextPhase.phaseType,
                                    }),
                                },
                            });
                        }
                    }
                }
            }

            // Find next unpaid installment for this application (via PaymentPhase)
            const nextInstallment = await tx.paymentInstallment.findFirst({
                where: {
                    paymentPhase: { phase: { applicationId: payment.applicationId } },
                    status: { in: ['PENDING', 'PARTIALLY_PAID'] },
                },
                orderBy: { dueDate: 'asc' },
            });

            if (nextInstallment) {
                await tx.application.update({
                    where: { id: payment.applicationId },
                    data: { nextPaymentDueDate: nextInstallment.dueDate },
                });
            }

            // Write domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: payment.tenantId,
                    eventType: 'PAYMENT.COMPLETED',
                    aggregateType: 'ApplicationPayment',
                    aggregateId: paymentId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        paymentId,
                        applicationId: payment.applicationId,
                        amount: payment.amount,
                    }),
                },
            });

            return { updated: result, activatedNextPhaseId };
        });

        // If a new phase was activated, process any auto-executable steps (e.g., GENERATE_DOCUMENT)
        if (activatedNextPhaseId) {
            try {
                // Use the application's buyer ID for auto-generated documents
                const userId = payment.application?.buyerId || payment.payerId;
                if (userId) {
                    await applicationPhaseService.processAutoExecutableSteps(activatedNextPhaseId, userId);
                }
            } catch (error) {
                console.error('[ApplicationPaymentService] Failed to process auto-executable steps for activated phase', {
                    phaseId: activatedNextPhaseId,
                    error: error instanceof Error ? error.message : String(error),
                });
                // Don't throw - the phase is still activated, just auto-steps failed
            }
        }

        const completedPayment = await this.findById(updated.id);

        // Send payment received notification
        try {
            const application = await prisma.application.findUnique({
                where: { id: payment.applicationId },
                include: {
                    buyer: { select: { email: true, firstName: true } },
                    propertyUnit: {
                        include: {
                            variant: { include: { property: true } }
                        }
                    },
                },
            });

            if (application?.buyer?.email) {
                // Find next installment for next payment date
                const nextInstallment = await prisma.paymentInstallment.findFirst({
                    where: {
                        paymentPhase: { phase: { applicationId: payment.applicationId } },
                        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
                    },
                    orderBy: { dueDate: 'asc' },
                });

                // Calculate remaining balance from all payment phases
                const allPaymentPhases = await prisma.paymentPhase.findMany({
                    where: { phase: { applicationId: payment.applicationId } },
                });
                const totalPaid = allPaymentPhases.reduce((sum, pp) => sum + pp.paidAmount, 0);
                const remainingBalance = Math.max(0, application.totalAmount - totalPaid);

                await sendPaymentReceivedNotification({
                    email: application.buyer.email,
                    userName: application.buyer.firstName || 'Valued Customer',
                    applicationId: application.id,
                    applicationNumber: application.applicationNumber,
                    paymentAmount: payment.amount,
                    paymentDate: new Date(),
                    paymentReference: payment.reference || `PAY-${paymentId.substring(0, 8)}`,
                    remainingBalance,
                    nextPaymentDate: nextInstallment?.dueDate,
                    nextPaymentAmount: nextInstallment?.amount,
                    dashboardUrl: `${DASHBOARD_URL}/applications/${payment.applicationId}`,
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
            const result = await tx.applicationPayment.update({
                where: { id: paymentId },
                data: {
                    status: 'FAILED',
                    processedAt: new Date(),
                    gatewayResponse: gatewayResponse ? JSON.stringify(gatewayResponse) : null,
                },
            });

            const payment = await tx.applicationPayment.findUnique({
                where: { id: paymentId },
            });

            if (!payment?.tenantId) {
                throw new Error('Payment must have tenantId for event creation');
            }

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: payment.tenantId,
                    eventType: 'PAYMENT.FAILED',
                    aggregateType: 'ApplicationPayment',
                    aggregateId: paymentId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        paymentId,
                        applicationId: payment?.applicationId,
                    }),
                },
            });

            return result;
        });

        // Send payment failed notification
        try {
            const application = await prisma.application.findUnique({
                where: { id: updated.applicationId },
                include: { buyer: true },
            });

            if (application?.buyer?.email) {
                const nextInstallment = await prisma.paymentInstallment.findFirst({
                    where: {
                        paymentPhase: { phase: { applicationId: application.id } },
                        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
                    },
                    orderBy: { dueDate: 'asc' },
                });

                await sendPaymentFailedNotification({
                    email: application.buyer.email,
                    userName: `${application.buyer.firstName} ${application.buyer.lastName}`,
                    applicationId: application.id,
                    paymentAmount: updated.amount,
                    amountDue: nextInstallment?.amount || updated.amount,
                    dueDate: nextInstallment?.dueDate || new Date(),
                    retryUrl: `${DASHBOARD_URL}/mortgages/${application.id}/payments/${updated.id}/retry`,
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
            const result = await tx.applicationPayment.update({
                where: { id: paymentId },
                data: {
                    status: 'REFUNDED',
                },
            });

            // Reverse installment update if linked
            if (payment.installmentId) {
                const installment = await tx.paymentInstallment.findUnique({
                    where: { id: payment.installmentId },
                });

                if (installment) {
                    const newPaidAmount = Math.max(0, installment.paidAmount - payment.amount);
                    await tx.paymentInstallment.update({
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
                const phase = await tx.applicationPhase.findUnique({
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
                    tenantId: payment.tenantId,
                    eventType: 'PAYMENT.REFUNDED',
                    aggregateType: 'ApplicationPayment',
                    aggregateId: paymentId,
                    queueName: 'accounting',
                    payload: JSON.stringify({
                        paymentId,
                        applicationId: payment.applicationId,
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
    async payAhead(applicationId: string, amount: number, userId: string) {
        const application = await prisma.application.findUnique({
            where: { id: applicationId },
        });

        if (!application) {
            throw new AppError(404, 'application not found');
        }

        // Find all pending installments for this application (via PaymentPhase)
        const pendingInstallments = await prisma.paymentInstallment.findMany({
            where: {
                paymentPhase: { phase: { applicationId } },
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
                await tx.applicationPayment.create({
                    data: {
                        tenantId: application.tenantId,
                        applicationId,
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

                await tx.paymentInstallment.update({
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
                    tenantId: application.tenantId,
                    eventType: 'PAYMENT.PAY_AHEAD',
                    aggregateType: 'Application',
                    aggregateId: applicationId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        applicationId,
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

export const applicationPaymentService = new ApplicationPaymentService();
