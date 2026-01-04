import { prisma as defaultPrisma } from '../lib/prisma';
import {
    AppError,
    PrismaClient,
} from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import Handlebars from 'handlebars';
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
 * Build merge data from contract and related entities
 */
function buildMergeData(contract: any, customData?: Record<string, any>): Record<string, any> {
    const buyer = contract.buyer;
    const property = contract.propertyUnit?.variant?.property;
    const unit = contract.propertyUnit;
    const variant = contract.propertyUnit?.variant;

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
        totalAmount: formatCurrency(contract.totalAmount || 0),
        totalAmountRaw: contract.totalAmount || 0,
        downPayment: formatCurrency(contract.downPayment || 0),
        downPaymentRaw: contract.downPayment || 0,
        principal: formatCurrency(contract.principal || 0),
        principalRaw: contract.principal || 0,
        interestRate: contract.interestRate || 0,
        termMonths: contract.termMonths || 0,
        periodicPayment: formatCurrency(contract.periodicPayment || 0),
        periodicPaymentRaw: contract.periodicPayment || 0,

        // Contract info
        contractNumber: contract.contractNumber,
        contractType: contract.contractType || 'MORTGAGE',
        contractDate: formatDate(contract.createdAt),

        // Dates
        currentDate: formatDate(new Date()),
        year: new Date().getFullYear(),

        // Dashboard
        dashboardUrl: `${DASHBOARD_URL}/contracts/${contract.id}`,

        // Custom overrides
        ...customData,
    };
}

/**
 * Compile and render Handlebars template
 */
function renderTemplate(htmlTemplate: string, mergeData: Record<string, any>): string {
    const template = Handlebars.compile(htmlTemplate);
    return template(mergeData);
}

/**
 * Offer letter service interface
 */
export interface OfferLetterService {
    generate(data: GenerateOfferLetterInput, userId: string): Promise<any>;
    findById(id: string): Promise<any>;
    findAll(filters: ListOfferLettersInput): Promise<any[]>;
    findByContract(contractId: string): Promise<any[]>;
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
     */
    async function generate(data: GenerateOfferLetterInput, userId: string): Promise<any> {
        // Get the contract with all related data
        const contract = await prisma.contract.findUnique({
            where: { id: data.contractId },
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

        if (!contract) {
            throw new AppError(404, 'Contract not found');
        }

        // Get the template (provided or default)
        let template;
        if (data.templateId) {
            template = await prisma.documentTemplate.findUnique({
                where: { id: data.templateId },
            });
            if (!template) {
                throw new AppError(404, 'Template not found');
            }
        } else {
            // Find default template for this type
            const templateCode = data.type === 'PROVISIONAL' ? 'PROVISIONAL_OFFER' : 'FINAL_OFFER';
            template = await prisma.documentTemplate.findFirst({
                where: {
                    tenantId: (contract as any).tenantId,
                    code: templateCode,
                    isActive: true,
                    isDefault: true,
                },
                orderBy: { version: 'desc' },
            });

            if (!template) {
                // Try any active template for this type
                template = await prisma.documentTemplate.findFirst({
                    where: {
                        tenantId: (contract as any).tenantId,
                        code: templateCode,
                        isActive: true,
                    },
                    orderBy: { version: 'desc' },
                });
            }

            if (!template) {
                throw new AppError(400, `No ${data.type.toLowerCase()} offer letter template configured for this tenant`);
            }
        }

        // Check for existing non-cancelled offer letter of this type
        const existing = await prisma.offerLetter.findFirst({
            where: {
                contractId: data.contractId,
                type: data.type,
                status: {
                    notIn: ['CANCELLED', 'EXPIRED'],
                },
            },
        });

        if (existing) {
            throw new AppError(400, `An active ${data.type.toLowerCase()} offer letter already exists for this contract`);
        }

        // Build merge data and render template
        const mergeData = buildMergeData(contract, data.customMergeData);
        const htmlContent = renderTemplate(template.htmlTemplate, mergeData);

        // Calculate expiration date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 30));

        // Create the offer letter
        const offerLetter = await prisma.$transaction(async (tx: any) => {
            const created = await tx.offerLetter.create({
                data: {
                    tenantId: (contract as any).tenantId,
                    contractId: data.contractId,
                    templateId: template.id,
                    letterNumber: generateLetterNumber(data.type),
                    type: data.type,
                    status: 'GENERATED',
                    htmlContent,
                    mergeData,
                    expiresAt,
                    generatedById: userId,
                },
            });

            // Create domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'OFFER_LETTER.GENERATED',
                    aggregateType: 'OfferLetter',
                    aggregateId: created.id,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        offerLetterId: created.id,
                        contractId: data.contractId,
                        type: data.type,
                        buyerId: contract.buyerId,
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
                contract: {
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
                contract: {
                    select: {
                        id: true,
                        contractNumber: true,
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
     * Find offer letters by contract
     */
    async function findByContract(contractId: string): Promise<any[]> {
        return prisma.offerLetter.findMany({
            where: { contractId },
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

        const contract = offerLetter.contract;
        const buyer = contract.buyer;

        const updated = await prisma.$transaction(async (tx: any) => {
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
                    eventType: 'OFFER_LETTER.SENT',
                    aggregateType: 'OfferLetter',
                    aggregateId: id,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        offerLetterId: id,
                        contractId: contract.id,
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
                contractNumber: contract.contractNumber,
                propertyName: contract.propertyUnit?.variant?.property?.title || 'Your Property',
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

        const contract = offerLetter.contract;
        const buyer = contract.buyer;

        const updated = await prisma.$transaction(async (tx: any) => {
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
                    eventType: 'OFFER_LETTER.SIGNED',
                    aggregateType: 'OfferLetter',
                    aggregateId: id,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        offerLetterId: id,
                        contractId: contract.id,
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

        const updated = await prisma.$transaction(async (tx: any) => {
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
                    eventType: 'OFFER_LETTER.CANCELLED',
                    aggregateType: 'OfferLetter',
                    aggregateId: id,
                    queueName: 'audit',
                    payload: JSON.stringify({
                        offerLetterId: id,
                        contractId: offerLetter.contractId,
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
        findByContract,
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
