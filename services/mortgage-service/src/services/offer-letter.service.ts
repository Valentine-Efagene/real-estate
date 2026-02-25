import { prisma as defaultPrisma } from '../lib/prisma';
import {
    AppError,
    Prisma,
    PrismaClient,
} from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import type {
    GenerateOfferLetterInput,
    SendOfferLetterInput,
    SignOfferLetterInput,
    UpdateOfferLetterInput,
    CancelOfferLetterInput,
    ListOfferLettersInput,
} from '../validators/offer-letter.validator';
import {
    sendOfferLetterNotification,
    formatCurrency,
    formatDate,
} from '../lib/notifications';
import { documentsClient } from '../lib/documents-client';

// Offer letter types - matches Prisma enum
type OfferLetterType = 'PROVISIONAL' | 'FINAL';

type AnyPrismaClient = PrismaClient;

// Dashboard URL base
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://app.contribuild.com';

/**
 * Generate a unique offer letter number
 */
function generateLetterNumber(type: OfferLetterType): string {
    const prefix = type === 'PROVISIONAL' ? 'POL' : 'FOL';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Build merge data from application and related entities
 */
function buildMergeData(application: any, customData?: Record<string, any>): Record<string, any> {
    const buyer = application.buyer;
    const property = application.propertyUnit?.variant?.property;
    const unit = application.propertyUnit;
    const variant = application.propertyUnit?.variant;

    return {
        // Buyer info
        buyerName: `${buyer?.firstName || ''} ${buyer?.lastName || ''}`.trim() || 'Valued Customer',
        buyerFirstName: buyer?.firstName || 'Valued Customer',
        buyerLastName: buyer?.lastName || '',
        buyerEmail: buyer?.email || '',
        buyerPhone: buyer?.phone || '',

        // Property info
        propertyName: property?.title || 'Property',
        propertyAddress: property?.address || '',
        propertyCity: property?.city || '',
        propertyState: property?.state || '',
        unitNumber: unit?.unitNumber || '',
        variantName: variant?.name || '',

        // Financial info
        totalAmount: formatCurrency(application.totalAmount || 0),
        totalAmountRaw: application.totalAmount || 0,
        downPayment: formatCurrency(application.downPayment || 0),
        downPaymentRaw: application.downPayment || 0,
        principal: formatCurrency(application.principal || 0),
        principalRaw: application.principal || 0,
        interestRate: application.interestRate || 0,
        termMonths: application.termMonths || 0,
        periodicPayment: formatCurrency(application.periodicPayment || 0),
        periodicPaymentRaw: application.periodicPayment || 0,

        // application info
        applicationNumber: application.applicationNumber,
        applicationType: application.applicationType || 'MORTGAGE',
        applicationDate: formatDate(application.createdAt),

        // Dates
        currentDate: formatDate(new Date()),
        year: new Date().getFullYear(),

        // Dashboard
        dashboardUrl: `${DASHBOARD_URL}/applications/${application.id}`,

        // Custom overrides
        ...customData,
    };
}

/**
 * Offer letter service interface
 */
export interface OfferLetterService {
    generate(data: GenerateOfferLetterInput, userId: string): Promise<any>;
    findById(id: string): Promise<any>;
    findAll(filters: ListOfferLettersInput): Promise<any[]>;
    findByapplication(applicationId: string): Promise<any[]>;
    send(id: string, data: SendOfferLetterInput, userId: string): Promise<any>;
    markViewed(id: string): Promise<any>;
    sign(id: string, data: SignOfferLetterInput, signerIp: string): Promise<any>;
    update(id: string, data: UpdateOfferLetterInput, userId: string): Promise<any>;
    cancel(id: string, data: CancelOfferLetterInput, userId: string): Promise<any>;
    checkExpired(): Promise<number>;
}

/**
 * Create an offer letter service with the given Prisma client
 */
export function createOfferLetterService(prisma: AnyPrismaClient = defaultPrisma): OfferLetterService {
    /**
     * Generate a new offer letter from template
     * Calls the documents-service to render the template
     */
    async function generate(data: GenerateOfferLetterInput, userId: string): Promise<any> {
        // Get the application with all related data
        const application = await prisma.application.findUnique({
            where: { id: data.applicationId },
            include: {
                propertyUnit: {
                    include: {
                        variant: {
                            include: {
                                property: true,
                            },
                        },
                    },
                },
                buyer: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                    },
                },
                seller: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!application) {
            throw new AppError(404, 'application not found');
        }

        const tenantId = (application as any).tenantId;

        // Check for existing non-cancelled offer letter of this type
        const existing = await prisma.offerLetter.findFirst({
            where: {
                applicationId: data.applicationId,
                type: data.type,
                status: {
                    notIn: ['CANCELLED', 'EXPIRED'],
                },
            },
        });

        if (existing) {
            throw new AppError(400, `An active ${data.type.toLowerCase()} offer letter already exists for this application`);
        }

        // Build merge data
        const mergeData = buildMergeData(application, data.customMergeData);

        // Call documents-service to generate the HTML from template
        let generatedDoc;
        try {
            generatedDoc = await documentsClient.generateOfferLetter(
                data.type,
                mergeData,
                tenantId
            );
        } catch (error: any) {
            console.error('[OfferLetter] Failed to generate document from template', { error: error.message });
            throw new AppError(400, `Failed to generate offer letter: ${error.message}`);
        }

        // Calculate expiration date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 30));

        // Create the offer letter
        const offerLetter = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const created = await tx.offerLetter.create({
                data: {
                    tenantId,
                    applicationId: data.applicationId,
                    templateId: data.templateId || null,
                    letterNumber: generateLetterNumber(data.type),
                    type: data.type,
                    status: 'GENERATED',
                    htmlContent: generatedDoc.html,
                    mergeData: generatedDoc.mergeData,
                    expiresAt,
                    generatedById: userId,
                },
            });

            // Create domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId,
                    eventType: 'OFFER_LETTER.GENERATED',
                    aggregateType: 'OfferLetter',
                    aggregateId: created.id,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        offerLetterId: created.id,
                        applicationId: data.applicationId,
                        type: data.type,
                        buyerId: application.buyerId,
                    }),
                    actorId: userId,
                },
            });

            return created;
        });

        return findById(offerLetter.id);
    }

    /**
     * Find offer letter by ID
     */
    async function findById(id: string): Promise<any> {
        const offerLetter = await prisma.offerLetter.findUnique({
            where: { id },
            include: {
                application: {
                    include: {
                        buyer: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                        propertyUnit: {
                            include: {
                                variant: {
                                    include: {
                                        property: true,
                                    },
                                },
                            },
                        },
                    },
                },
                template: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        version: true,
                    },
                },
                generatedBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                sentBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!offerLetter) {
            throw new AppError(404, 'Offer letter not found');
        }

        return offerLetter;
    }

    /**
     * Find all offer letters with filters
     */
    async function findAll(filters: ListOfferLettersInput): Promise<any[]> {
        return prisma.offerLetter.findMany({
            where: filters,
            orderBy: { createdAt: 'desc' },
            include: {
                application: {
                    select: {
                        id: true,
                        applicationNumber: true,
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
                template: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
            },
        });
    }

    /**
     * Find offer letters by application
     */
    async function findByapplication(applicationId: string): Promise<any[]> {
        return prisma.offerLetter.findMany({
            where: { applicationId },
            orderBy: { createdAt: 'desc' },
            include: {
                template: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
            },
        });
    }

    /**
     * Send offer letter to buyer via email
     */
    async function send(id: string, data: SendOfferLetterInput, userId: string): Promise<any> {
        const offerLetter = await findById(id);

        if (!['GENERATED', 'SENT'].includes(offerLetter.status)) {
            throw new AppError(400, `Cannot send offer letter in ${offerLetter.status} status`);
        }

        // Check if expired
        if (offerLetter.expiresAt && new Date(offerLetter.expiresAt) < new Date()) {
            throw new AppError(400, 'Offer letter has expired');
        }

        const application = offerLetter.application;
        const buyer = application.buyer;

        const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const result = await tx.offerLetter.update({
                where: { id },
                data: {
                    status: 'SENT',
                    sentAt: new Date(),
                    sentById: userId,
                },
            });

            // Create domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: application.tenantId,
                    eventType: 'OFFER_LETTER.SENT',
                    aggregateType: 'OfferLetter',
                    aggregateId: id,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        offerLetterId: id,
                        applicationId: application.id,
                        type: offerLetter.type,
                        buyerId: buyer.id,
                        buyerEmail: buyer.email,
                    }),
                    actorId: userId,
                },
            });

            return result;
        });

        // Send email notification
        try {
            await sendOfferLetterNotification({
                email: buyer.email,
                userName: buyer.firstName || 'Valued Customer',
                letterNumber: offerLetter.letterNumber,
                letterType: offerLetter.type === 'PROVISIONAL' ? 'Provisional Offer Letter' : 'Final Offer Letter',
                applicationNumber: application.applicationNumber,
                propertyName: application.propertyUnit?.variant?.property?.title || 'Your Property',
                expiryDate: formatDate(offerLetter.expiresAt),
                viewUrl: `${DASHBOARD_URL}/offer-letters/${id}`,
                customMessage: data.message,
            }, id);
        } catch (error) {
            console.error('[OfferLetter] Failed to send notification', { id, error });
        }

        return findById(id);
    }

    /**
     * Mark offer letter as viewed by buyer
     */
    async function markViewed(id: string): Promise<any> {
        const offerLetter = await findById(id);

        // Only update if not already viewed
        if (!offerLetter.viewedAt) {
            await prisma.offerLetter.update({
                where: { id },
                data: {
                    status: 'VIEWED',
                    viewedAt: new Date(),
                },
            });
        }

        return findById(id);
    }

    /**
     * Sign offer letter (customer acceptance)
     */
    async function sign(id: string, data: SignOfferLetterInput, signerIp: string): Promise<any> {
        const offerLetter = await findById(id);

        if (!['SENT', 'VIEWED'].includes(offerLetter.status)) {
            throw new AppError(400, `Cannot sign offer letter in ${offerLetter.status} status`);
        }

        // Check if expired
        if (offerLetter.expiresAt && new Date(offerLetter.expiresAt) < new Date()) {
            throw new AppError(400, 'Offer letter has expired');
        }

        const application = offerLetter.application;
        const buyer = application.buyer;

        const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const result = await tx.offerLetter.update({
                where: { id },
                data: {
                    status: 'SIGNED',
                    signedAt: new Date(),
                    signatureIp: signerIp,
                    signatureData: {
                        method: data.signatureMethod,
                        timestamp: new Date().toISOString(),
                        agreedToTerms: true,
                        hasSignatureImage: !!data.signatureData,
                    },
                },
            });

            // Create domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: application.tenantId,
                    eventType: 'OFFER_LETTER.SIGNED',
                    aggregateType: 'OfferLetter',
                    aggregateId: id,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        offerLetterId: id,
                        applicationId: application.id,
                        type: offerLetter.type,
                        buyerId: buyer.id,
                        signedAt: new Date().toISOString(),
                    }),
                    actorId: buyer.id,
                },
            });

            return result;
        });

        return findById(id);
    }

    /**
     * Update offer letter (e.g., add PDF URL after external generation)
     */
    async function update(id: string, data: UpdateOfferLetterInput, userId: string): Promise<any> {
        const offerLetter = await findById(id);

        if (['SIGNED', 'EXPIRED', 'CANCELLED'].includes(offerLetter.status)) {
            throw new AppError(400, `Cannot update offer letter in ${offerLetter.status} status`);
        }

        await prisma.offerLetter.update({
            where: { id },
            data,
        });

        return findById(id);
    }

    /**
     * Cancel offer letter
     */
    async function cancel(id: string, data: CancelOfferLetterInput, userId: string): Promise<any> {
        const offerLetter = await findById(id);

        if (['SIGNED', 'EXPIRED', 'CANCELLED'].includes(offerLetter.status)) {
            throw new AppError(400, `Cannot cancel offer letter in ${offerLetter.status} status`);
        }

        const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const result = await tx.offerLetter.update({
                where: { id },
                data: {
                    status: 'CANCELLED',
                    cancelledAt: new Date(),
                    cancelReason: data.reason,
                },
            });

            // Create domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: offerLetter.application.tenantId,
                    eventType: 'OFFER_LETTER.CANCELLED',
                    aggregateType: 'OfferLetter',
                    aggregateId: id,
                    queueName: 'audit',
                    payload: JSON.stringify({
                        offerLetterId: id,
                        applicationId: offerLetter.applicationId,
                        reason: data.reason,
                    }),
                    actorId: userId,
                },
            });

            return result;
        });

        return findById(id);
    }

    /**
     * Check and mark expired offer letters
     * This should be called by a scheduled job
     */
    async function checkExpired(): Promise<number> {
        const now = new Date();

        const result = await prisma.offerLetter.updateMany({
            where: {
                status: {
                    in: ['GENERATED', 'SENT', 'VIEWED'],
                },
                expiresAt: {
                    lt: now,
                },
            },
            data: {
                status: 'EXPIRED',
                expiredAt: now,
            },
        });

        return result.count;
    }

    return {
        generate,
        findById,
        findAll,
        findByapplication,
        send,
        markViewed,
        sign,
        update,
        cancel,
        checkExpired,
    };
}

// Default instance for backward compatibility
export const offerLetterService: OfferLetterService = createOfferLetterService();
