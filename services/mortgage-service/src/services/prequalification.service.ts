import { prisma } from '../lib/prisma';
import { AppError, PrequalificationStatus, Prisma } from '@valentine-efagene/qshelter-common';
import type {
    CreatePrequalificationInput,
    UpdatePrequalificationInput,
    SubmitDocumentInput,
    ReviewPrequalificationInput,
} from '../validators/prequalification.validator';
import {
    sendPrequalificationSubmittedNotification,
    sendPrequalificationApprovedNotification,
    sendPrequalificationRejectedNotification,
    formatCurrency,
    formatDate,
} from '../lib/notifications';
import { UnderwritingService } from './underwriting.service';

// Dashboard URL base - would come from config in production
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://app.contribuild.com';

class PrequalificationService {
    async create(tenantId: string, userId: string, data: CreatePrequalificationInput): Promise<any> {
        // Check if property exists
        const property = await prisma.property.findUnique({
            where: { id: data.propertyId },
        });
        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        // Check if payment method exists
        const paymentMethod = await prisma.propertyPaymentMethod.findUnique({
            where: { id: data.paymentMethodId },
        });
        if (!paymentMethod) {
            throw new AppError(404, 'Payment method not found');
        }

        // Calculate debt-to-income ratio if income and expenses provided
        let debtToIncomeRatio: number | null = null;
        if (data.monthlyIncome && data.monthlyExpenses) {
            debtToIncomeRatio = data.monthlyExpenses / data.monthlyIncome;
        }

        const prequal = await prisma.prequalification.create({
            data: {
                tenantId,
                userId,
                propertyId: data.propertyId,
                paymentMethodId: data.paymentMethodId,
                answers: (data.answers ?? {}) as Prisma.InputJsonValue,
                requestedAmount: data.requestedAmount,
                monthlyIncome: data.monthlyIncome,
                monthlyExpenses: data.monthlyExpenses,
                debtToIncomeRatio,
                status: PrequalificationStatus.DRAFT,
            },
            include: {
                property: true,
                paymentMethod: true,
            },
        });

        return prequal;
    }

    async findById(id: string): Promise<any> {
        const prequal = await prisma.prequalification.findUnique({
            where: { id },
            include: {
                property: true,
                paymentMethod: {
                    include: {
                        phases: {
                            orderBy: { order: 'asc' },
                        },
                    },
                },
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!prequal) {
            throw new AppError(404, 'Prequalification not found');
        }

        return prequal;
    }

    async findAll(tenantId: string, filters?: { status?: string; userId?: string }): Promise<any[]> {
        const where: Record<string, any> = { tenantId };

        if (filters?.status) {
            where.status = filters.status;
        }
        if (filters?.userId) {
            where.userId = filters.userId;
        }

        const prequals = await prisma.prequalification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                property: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        return prequals;
    }

    async update(id: string, data: UpdatePrequalificationInput): Promise<any> {
        const existing = await this.findById(id);

        if (existing.status !== PrequalificationStatus.DRAFT) {
            throw new AppError(400, 'Only DRAFT prequalifications can be updated');
        }

        // Recalculate debt-to-income ratio if income or expenses updated
        let debtToIncomeRatio = existing.debtToIncomeRatio;
        const income = data.monthlyIncome ?? existing.monthlyIncome;
        const expenses = data.monthlyExpenses ?? existing.monthlyExpenses;
        if (income && expenses) {
            debtToIncomeRatio = expenses / income;
        }

        const updateData: Record<string, any> = {
            debtToIncomeRatio,
        };

        if (data.answers !== undefined) {
            updateData.answers = data.answers;
        }
        if (data.requestedAmount !== undefined) {
            updateData.requestedAmount = data.requestedAmount;
        }
        if (data.monthlyIncome !== undefined) {
            updateData.monthlyIncome = data.monthlyIncome;
        }
        if (data.monthlyExpenses !== undefined) {
            updateData.monthlyExpenses = data.monthlyExpenses;
        }

        const updated = await prisma.prequalification.update({
            where: { id },
            data: updateData,
            include: {
                property: true,
                paymentMethod: true,
            },
        });

        return updated;
    }

    async getRequiredDocuments(id: string) {
        const prequal = await this.findById(id);

        // Get document rules for this tenant for prequalification context
        const rules = await prisma.documentRequirementRule.findMany({
            where: {
                tenantId: prequal.tenantId,
                isActive: true,
                context: 'PREQUALIFICATION',
            },
            orderBy: { documentType: 'asc' },
        });

        return rules;
    }

    async submitDocument(prequalId: string, userId: string, data: SubmitDocumentInput) {
        const prequal = await this.findById(prequalId);

        if (prequal.status !== PrequalificationStatus.DRAFT) {
            throw new AppError(400, 'Documents can only be added to DRAFT prequalifications');
        }

        // Store document reference in answers (or could use a separate documents table)
        const currentAnswers = (prequal.answers as Record<string, any>) || {};
        const documents = currentAnswers.documents || [];
        documents.push({
            documentType: data.documentType,
            documentUrl: data.url,
            fileName: data.fileName,
            mimeType: data.mimeType,
            sizeBytes: data.sizeBytes,
            uploadedAt: new Date().toISOString(),
            uploadedBy: userId,
        });

        const updated = await prisma.prequalification.update({
            where: { id: prequalId },
            data: {
                answers: { ...currentAnswers, documents } as Prisma.InputJsonValue,
            },
        });

        return {
            id: prequalId,
            documentType: data.documentType,
            documentUrl: data.url,
            status: 'PENDING',
        };
    }

    async submit(id: string): Promise<any> {
        const prequal = await this.findById(id);

        if (prequal.status !== PrequalificationStatus.DRAFT) {
            throw new AppError(400, 'Only DRAFT prequalifications can be submitted');
        }

        // Calculate eligibility score based on financial data
        let score = 0;
        if (prequal.monthlyIncome) {
            // Basic scoring logic
            if (prequal.debtToIncomeRatio !== null) {
                if (prequal.debtToIncomeRatio < 0.3) score += 40;
                else if (prequal.debtToIncomeRatio < 0.4) score += 30;
                else if (prequal.debtToIncomeRatio < 0.5) score += 20;
                else score += 10;
            }

            // Income relative to requested amount
            if (prequal.requestedAmount && prequal.monthlyIncome) {
                const monthsToPayoff = prequal.requestedAmount / prequal.monthlyIncome;
                if (monthsToPayoff < 60) score += 30;
                else if (monthsToPayoff < 120) score += 25;
                else if (monthsToPayoff < 180) score += 20;
                else score += 10;
            }

            // Documents submitted
            const answers = prequal.answers as Record<string, any>;
            const docs = answers?.documents || [];
            score += Math.min(docs.length * 10, 30);
        }

        const updated = await prisma.prequalification.update({
            where: { id },
            data: {
                status: PrequalificationStatus.SUBMITTED,
                score,
            },
            include: {
                property: true,
                paymentMethod: true,
            },
        });

        // Create domain event
        await prisma.domainEvent.create({
            data: {
                queueName: 'mortgage-events',
                aggregateType: 'Prequalification',
                aggregateId: id,
                eventType: 'PREQUALIFICATION.SUBMITTED',
                payload: JSON.stringify({
                    tenantId: prequal.tenantId,
                    prequalificationId: id,
                    userId: prequal.userId,
                    propertyId: prequal.propertyId,
                    score,
                }),
                occurredAt: new Date(),
            },
        });

        // Send email notification
        try {
            await sendPrequalificationSubmittedNotification({
                email: prequal.user.email,
                userName: prequal.user.firstName || 'Valued Customer',
                applicationId: id.substring(0, 8).toUpperCase(),
                propertyName: prequal.property?.title || 'Your Selected Property',
                requestedAmount: formatCurrency(prequal.requestedAmount || 0),
                submittedDate: formatDate(new Date()),
                dashboardUrl: `${DASHBOARD_URL}/prequalifications/${id}`,
            }, id);
        } catch (error) {
            console.error('[Prequalification] Failed to send submitted notification', { id, error });
            // Don't throw - notification failure shouldn't fail the main operation
        }

        // Trigger automated underwriting
        try {
            const underwritingService = new UnderwritingService(prisma);
            const underwritingResult = await underwritingService.evaluate(id, prequal.userId);
            console.info('[Prequalification] Underwriting completed', {
                id,
                decision: underwritingResult.decision,
                score: underwritingResult.score,
            });

            // Re-fetch to get updated status from underwriting
            return await this.findById(id);
        } catch (error) {
            console.error('[Prequalification] Underwriting evaluation failed', { id, error });
            // Don't throw - underwriting failure shouldn't fail submission
            // The prequalification remains SUBMITTED and can be re-evaluated
        }

        return updated;
    }

    async review(id: string, reviewerId: string, data: ReviewPrequalificationInput): Promise<any> {
        const prequal = await this.findById(id);

        if (prequal.status !== PrequalificationStatus.SUBMITTED) {
            throw new AppError(400, 'Only SUBMITTED prequalifications can be reviewed');
        }

        const updateData: any = {
            status: data.status,
            notes: data.notes,
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
        };

        if (data.status === 'APPROVED') {
            updateData.suggestedTermMonths = data.suggestedTermMonths;
            updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days default
        }

        const updated = await prisma.prequalification.update({
            where: { id },
            data: updateData,
            include: {
                property: true,
                paymentMethod: true,
            },
        });

        // Create domain event
        await prisma.domainEvent.create({
            data: {
                queueName: 'notifications',
                aggregateType: 'Prequalification',
                aggregateId: id,
                eventType: `PREQUALIFICATION.${data.status}`,
                payload: JSON.stringify({
                    tenantId: prequal.tenantId,
                    prequalificationId: id,
                    userId: prequal.userId,
                    reviewedBy: reviewerId,
                    status: data.status,
                    notes: data.notes,
                }),
                occurredAt: new Date(),
            },
        });

        // Send email notification based on status
        try {
            if (data.status === 'APPROVED') {
                await sendPrequalificationApprovedNotification({
                    email: prequal.user.email,
                    userName: prequal.user.firstName || 'Valued Customer',
                    applicationId: id.substring(0, 8).toUpperCase(),
                    propertyName: prequal.property?.title || 'Your Selected Property',
                    approvedAmount: formatCurrency(prequal.requestedAmount || 0),
                    termMonths: data.suggestedTermMonths || 120,
                    expiryDate: formatDate(updated.expiresAt || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
                    dashboardUrl: `${DASHBOARD_URL}/prequalifications/${id}`,
                }, id);
            } else if (data.status === 'REJECTED') {
                await sendPrequalificationRejectedNotification({
                    email: prequal.user.email,
                    userName: prequal.user.firstName || 'Valued Customer',
                    applicationId: id.substring(0, 8).toUpperCase(),
                    propertyName: prequal.property?.title || 'Your Selected Property',
                    reason: data.notes,
                }, id);
            }
        } catch (error) {
            console.error('[Prequalification] Failed to send review notification', { id, status: data.status, error });
            // Don't throw - notification failure shouldn't fail the main operation
        }

        return updated;
    }

    async delete(id: string) {
        const prequal = await this.findById(id);

        if (prequal.status !== PrequalificationStatus.DRAFT) {
            throw new AppError(400, 'Only DRAFT prequalifications can be deleted');
        }

        await prisma.prequalification.delete({
            where: { id },
        });

        return { success: true };
    }
}

export const prequalificationService = new PrequalificationService();
