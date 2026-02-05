import { prisma } from '../lib/prisma';
import {
    AppError,
    StageStatus,
    ReviewDecision,
    DocumentStatus,
    RejectionBehavior,
    PhaseStatus,
} from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import {
    sendBankReviewRequiredNotification,
    sendStageCompletedNotification,
    formatDate,
} from '../lib/notifications';

// Dashboard URL base
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://app.contribuild.com';

/**
 * Document definition from snapshot (JSON)
 */
export interface DocumentDefinitionSnapshot {
    id: string;
    documentType: string;
    documentName: string;
    uploadedBy: 'CUSTOMER' | 'LENDER' | 'DEVELOPER' | 'LEGAL' | 'INSURER' | 'PLATFORM';
    order: number;
    isRequired: boolean;
    description?: string;
    maxSizeBytes?: number;
    allowedMimeTypes?: string;
    expiryDays?: number;
    minFiles: number;
    maxFiles: number;
    condition?: any;
}

/**
 * Approval stage from snapshot (JSON)
 * Stores organizationTypeId (resolved at plan creation time) for audit trail
 */
export interface ApprovalStageSnapshot {
    id: string;
    name: string;
    order: number;
    organizationTypeId: string; // Resolved org type ID (e.g., id of PLATFORM, BANK, etc.)
    autoTransition: boolean;
    waitForAllDocuments: boolean;
    allowEarlyVisibility: boolean;
    onRejection: RejectionBehavior;
    restartFromStageOrder?: number;
    organizationId?: string;
    slaHours?: number;
    description?: string;
}

/**
 * Input for uploading a document
 */
export interface UploadDocumentInput {
    tenantId: string;
    applicationId: string;
    documentationPhaseId: string;
    documentType: string;
    documentName: string;
    fileName: string;
    fileUrl: string;
    uploadedById: string;
}

/**
 * Input for reviewing a document
 */
export interface ReviewDocumentInput {
    tenantId: string;
    documentId: string;
    reviewerId: string;
    organizationTypeId: string; // Resolved org type ID
    decision: ReviewDecision;
    comment?: string;
}

/**
 * Input for transitioning to the next approval stage
 */
export interface TransitionStageInput {
    documentationPhaseId: string;
    userId: string;
    comment?: string;
}

/**
 * Approval Workflow Service
 * 
 * Manages the new two-stage approval workflow:
 * 1. Customer uploads all required documents
 * 2. Documents flow through sequential approval stages (e.g., QShelter → Bank)
 * 3. Each stage reviews all documents before transitioning to next stage
 */
export function createApprovalWorkflowService() {
    return {
        /**
         * Initialize approval stage progress when a documentation phase is activated
         * Creates ApprovalStageProgress records from the documentation plan's approval stages
         */
        async initializeStageProgress(
            tx: any,
            documentationPhaseId: string,
            tenantId: string,
            approvalStages: ApprovalStageSnapshot[]
        ): Promise<void> {
            // Create progress records for each approval stage
            const stageProgressData = approvalStages.map((stage, index) => ({
                id: uuidv4(),
                tenantId,
                documentationPhaseId,
                approvalStageId: stage.id,
                name: stage.name,
                order: stage.order,
                organizationTypeId: stage.organizationTypeId,
                autoTransition: stage.autoTransition,
                waitForAllDocuments: stage.waitForAllDocuments,
                allowEarlyVisibility: stage.allowEarlyVisibility,
                onRejection: stage.onRejection,
                restartFromStageOrder: stage.restartFromStageOrder,
                status: index === 0 ? 'IN_PROGRESS' as StageStatus : 'PENDING' as StageStatus,
                activatedAt: index === 0 ? new Date() : null,
            }));

            await tx.approvalStageProgress.createMany({
                data: stageProgressData,
            });
        },

        /**
         * Get current stage progress for a documentation phase
         */
        async getCurrentStage(documentationPhaseId: string): Promise<any> {
            const phase = await prisma.documentationPhase.findUnique({
                where: { id: documentationPhaseId },
                select: { currentStageOrder: true },
            });

            if (!phase) {
                throw new AppError(404, 'Documentation phase not found');
            }

            return prisma.approvalStageProgress.findFirst({
                where: {
                    documentationPhaseId,
                    order: phase.currentStageOrder,
                },
                include: {
                    documentApprovals: {
                        include: {
                            document: true,
                            reviewer: {
                                select: { id: true, email: true, firstName: true, lastName: true },
                            },
                        },
                    },
                },
            });
        },

        /**
         * Get all stage progress for a documentation phase
         */
        async getAllStageProgress(documentationPhaseId: string): Promise<any[]> {
            return prisma.approvalStageProgress.findMany({
                where: { documentationPhaseId },
                orderBy: { order: 'asc' },
                include: {
                    documentApprovals: {
                        include: {
                            document: true,
                            reviewer: {
                                select: { id: true, email: true, firstName: true, lastName: true },
                            },
                        },
                    },
                },
            });
        },

        /**
         * Upload a document for review
         * Documents are uploaded to the documentation phase, not to a specific step
         * 
         * If the current approval stage has autoTransition=true and the document's
         * uploadedBy matches the stage's organization type, the document is auto-approved.
         */
        async uploadDocument(input: UploadDocumentInput): Promise<any> {
            const {
                tenantId,
                applicationId,
                documentationPhaseId,
                documentType,
                documentName,
                fileName,
                fileUrl,
                uploadedById,
            } = input;

            // Get the documentation phase with stage progress and document definitions
            const docPhase = await prisma.documentationPhase.findUnique({
                where: { id: documentationPhaseId },
                include: {
                    phase: {
                        select: { status: true, applicationId: true },
                    },
                    stageProgress: {
                        orderBy: { order: 'asc' },
                    },
                },
            });

            if (!docPhase) {
                throw new AppError(404, 'Documentation phase not found');
            }

            if (docPhase.phase.status !== 'IN_PROGRESS' && docPhase.phase.status !== 'ACTIVE') {
                throw new AppError(400, 'Cannot upload documents to an inactive phase');
            }

            // Get document definition from snapshot
            const documentDefinitions = (docPhase.documentDefinitionsSnapshot as unknown as DocumentDefinitionSnapshot[]) || [];
            const docDef = documentDefinitions.find(d => d.documentType === documentType);

            // Check if document already exists for this type
            const existingDoc = await prisma.applicationDocument.findFirst({
                where: {
                    applicationId,
                    phaseId: docPhase.phaseId,
                    documentType,
                },
            });

            let document: any;

            // Get expectedUploader from document definition (LENDER, CUSTOMER, etc.)
            const expectedUploader = docDef?.uploadedBy || 'CUSTOMER';

            if (existingDoc) {
                // Update existing document (re-upload)
                document = await prisma.applicationDocument.update({
                    where: { id: existingDoc.id },
                    data: {
                        name: fileName,
                        url: fileUrl,
                        documentName,
                        uploadedById,
                        expectedUploader,
                        status: 'PENDING',
                        updatedAt: new Date(),
                    },
                });
            } else {
                // Create new document
                document = await prisma.applicationDocument.create({
                    data: {
                        id: uuidv4(),
                        tenantId,
                        applicationId,
                        phaseId: docPhase.phaseId,
                        documentType,
                        documentName,
                        name: fileName,
                        url: fileUrl,
                        type: documentType, // Legacy field
                        uploadedById,
                        expectedUploader,
                        status: 'PENDING',
                    },
                });
            }

            // Check for auto-approval: if current stage's organization type matches document uploadedBy
            const currentStage = docPhase.stageProgress.find(
                (s: any) => s.order === docPhase.currentStageOrder
            );

            if (currentStage && docDef && currentStage.organizationTypeId) {
                // Map uploadedBy to organization type code (LENDER -> BANK, etc.)
                const uploadedByToOrgTypeCode: Record<string, string> = {
                    'DEVELOPER': 'DEVELOPER',
                    'LENDER': 'BANK',
                    'LEGAL': 'LEGAL',
                    'INSURER': 'INSURER',
                    'PLATFORM': 'PLATFORM',
                    'CUSTOMER': 'CUSTOMER',
                };

                const expectedOrgTypeCode = uploadedByToOrgTypeCode[docDef.uploadedBy] || docDef.uploadedBy;

                // Fetch the organization type to check code
                const stageOrgType = await prisma.organizationType.findUnique({
                    where: { id: currentStage.organizationTypeId },
                    select: { code: true },
                });

                // Auto-approve if uploader matches reviewer (they don't need to review their own work)
                if (stageOrgType && stageOrgType.code === expectedOrgTypeCode) {
                    // Auto-approve the document and check for stage completion
                    await prisma.$transaction(async (tx: any) => {
                        // Create auto-approval record
                        await tx.documentApproval.create({
                            data: {
                                id: uuidv4(),
                                tenantId,
                                documentId: document.id,
                                stageProgressId: currentStage.id,
                                reviewerId: uploadedById,
                                organizationTypeId: currentStage.organizationTypeId,
                                decision: 'APPROVED',
                                comment: 'Auto-approved: uploaded by authorized party',
                                reviewedAt: new Date(),
                            },
                        });

                        // Update document status to APPROVED
                        await tx.applicationDocument.update({
                            where: { id: document.id },
                            data: { status: 'APPROVED' },
                        });

                        // Update approvedDocumentsCount
                        await tx.documentationPhase.update({
                            where: { id: documentationPhaseId },
                            data: { approvedDocumentsCount: { increment: 1 } },
                        });

                        // Evaluate stage completion
                        await this.evaluateStageCompletion(tx, documentationPhaseId, currentStage.id);
                    });

                    // Refetch document with updated status
                    return prisma.applicationDocument.findUnique({
                        where: { id: document.id },
                    });
                }
            }

            return document;
        },

        /**
         * Review a document within the current approval stage
         * Creates a DocumentApproval record and updates document status
         */
        async reviewDocument(input: ReviewDocumentInput): Promise<any> {
            const { tenantId, documentId, reviewerId, organizationTypeId, decision, comment } = input;

            // Get the document
            const document = await prisma.applicationDocument.findUnique({
                where: { id: documentId },
            });

            if (!document) {
                throw new AppError(404, 'Document not found');
            }

            if (!document.phaseId) {
                throw new AppError(400, 'Document is not linked to a phase');
            }

            // Get the documentation phase for this specific document's phaseId
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: document.phaseId },
                include: {
                    documentationPhase: {
                        include: {
                            stageProgress: {
                                orderBy: { order: 'asc' },
                                include: {
                                    organizationType: {
                                        select: { id: true, code: true, name: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            if (!phase || !phase.documentationPhase) {
                throw new AppError(404, 'Documentation phase not found for this document');
            }

            const docPhase = phase.documentationPhase;

            // Get the current active stage
            const currentStage = docPhase.stageProgress.find(
                (s: any) => s.status === 'IN_PROGRESS'
            );

            if (!currentStage) {
                throw new AppError(400, 'No active approval stage found');
            }

            // Verify reviewer's organization type matches the current stage
            if (currentStage.organizationTypeId !== organizationTypeId) {
                const stageName = currentStage.organizationType?.name || currentStage.organizationType?.code || 'unknown';
                throw new AppError(403, `Current stage requires ${stageName} review`);
            }

            return prisma.$transaction(async (tx) => {
                // Create document approval record
                const approval = await tx.documentApproval.create({
                    data: {
                        id: uuidv4(),
                        tenantId,
                        documentId,
                        stageProgressId: currentStage.id,
                        reviewerId,
                        organizationTypeId,
                        decision,
                        comment,
                    },
                });

                // Update document status based on decision
                let newStatus: DocumentStatus = 'PENDING';
                if (decision === 'APPROVED') {
                    newStatus = 'APPROVED';
                } else if (decision === 'REJECTED') {
                    newStatus = 'REJECTED';
                } else if (decision === 'CHANGES_REQUESTED') {
                    newStatus = 'NEEDS_REUPLOAD';
                }

                await tx.applicationDocument.update({
                    where: { id: documentId },
                    data: { status: newStatus },
                });

                // Check if all documents are now reviewed
                await this.evaluateStageCompletion(tx, docPhase.id, currentStage.id);

                return approval;
            });
        },

        /**
         * Evaluate if the current stage should be completed
         * Called after each document review
         * 
         * Each stage is only responsible for reviewing documents that match its organization type.
         * For example:
         * - PLATFORM stage reviews documents uploaded by CUSTOMER or PLATFORM
         * - BANK stage reviews documents uploaded by LENDER
         * - DEVELOPER stage reviews documents uploaded by DEVELOPER
         */
        async evaluateStageCompletion(
            tx: any,
            documentationPhaseId: string,
            stageProgressId: string
        ): Promise<void> {
            // Get the stage and documentation phase with snapshots
            const stage = await tx.approvalStageProgress.findUnique({
                where: { id: stageProgressId },
                include: {
                    documentApprovals: true,
                    organizationType: { select: { code: true } },
                    documentationPhase: {
                        include: {
                            phase: true,
                        },
                    },
                },
            });

            if (!stage) return;

            const docPhase = stage.documentationPhase;

            // Map organization type code back to uploadedBy values that this stage is responsible for
            const orgTypeCodeToUploadedBy: Record<string, string[]> = {
                'PLATFORM': ['CUSTOMER', 'PLATFORM'],  // Platform team reviews customer and platform uploads
                'BANK': ['LENDER'],                     // Bank stage reviews lender uploads
                'DEVELOPER': ['DEVELOPER'],
                'LEGAL': ['LEGAL'],
                'INSURER': ['INSURER'],
                'CUSTOMER': ['CUSTOMER'],
                'GOVERNMENT': ['GOVERNMENT'],
            };

            const orgTypeCode = stage.organizationType?.code || '';
            const uploadedByValues = orgTypeCodeToUploadedBy[orgTypeCode] || [];

            // Get document definitions from snapshot to find which document types this stage reviews
            const documentDefinitions = (docPhase.documentDefinitionsSnapshot as unknown as DocumentDefinitionSnapshot[]) || [];
            const stageDocumentTypes = documentDefinitions
                .filter(def => uploadedByValues.includes(def.uploadedBy))
                .map(def => def.documentType);

            // Get documents for this phase that this stage is responsible for
            const stageDocuments = await tx.applicationDocument.findMany({
                where: {
                    applicationId: docPhase.phase.applicationId,
                    phaseId: docPhase.phaseId,
                    documentType: { in: stageDocumentTypes },
                },
            });

            // Get all approvals for this stage (including the one just created)
            const stageApprovals = await tx.documentApproval.findMany({
                where: {
                    stageProgressId: stageProgressId,
                },
            });

            // Check if all documents for this stage have been reviewed
            const approvedDocs = stageApprovals.filter(
                (a: any) => a.decision === 'APPROVED'
            );
            const rejectedDocs = stageApprovals.filter(
                (a: any) => a.decision === 'REJECTED' || a.decision === 'CHANGES_REQUESTED'
            );

            // If any document was rejected, handle rejection behavior
            if (rejectedDocs.length > 0) {
                await this.handleStageRejection(tx, stage, rejectedDocs);
                return;
            }

            // If waiting for all documents and not all stage documents are approved, don't transition
            if (stage.waitForAllDocuments && approvedDocs.length < stageDocuments.length) {
                return;
            }

            // All stage documents approved - transition to next stage
            await this.transitionToNextStage(tx, documentationPhaseId, null, null);
        },

        /**
         * Handle rejection behavior when a document is rejected
         */
        async handleStageRejection(
            tx: any,
            stage: any,
            rejectedDocs: any[]
        ): Promise<void> {
            const { onRejection, restartFromStageOrder, documentationPhaseId } = stage;

            switch (onRejection) {
                case 'CASCADE_BACK':
                    // Reset to stage 1 for re-review
                    await this.resetToStage(tx, documentationPhaseId, 1);
                    break;

                case 'RESTART_CURRENT':
                    // Reset current stage only
                    await tx.approvalStageProgress.update({
                        where: { id: stage.id },
                        data: {
                            status: 'IN_PROGRESS',
                            activatedAt: new Date(),
                        },
                    });
                    break;

                case 'RESTART_FROM_STAGE':
                    // Reset to specific stage
                    if (restartFromStageOrder) {
                        await this.resetToStage(tx, documentationPhaseId, restartFromStageOrder);
                    }
                    break;
            }
        },

        /**
         * Reset progress back to a specific stage
         */
        async resetToStage(
            tx: any,
            documentationPhaseId: string,
            stageOrder: number
        ): Promise<void> {
            // Update documentation phase current stage
            await tx.documentationPhase.update({
                where: { id: documentationPhaseId },
                data: { currentStageOrder: stageOrder },
            });

            // Reset all stages from stageOrder onwards to PENDING
            await tx.approvalStageProgress.updateMany({
                where: {
                    documentationPhaseId,
                    order: { gte: stageOrder },
                },
                data: {
                    status: 'PENDING',
                    activatedAt: null,
                    completedAt: null,
                    completedById: null,
                    transitionComment: null,
                },
            });

            // Activate the target stage
            await tx.approvalStageProgress.updateMany({
                where: {
                    documentationPhaseId,
                    order: stageOrder,
                },
                data: {
                    status: 'IN_PROGRESS',
                    activatedAt: new Date(),
                },
            });

            // Reset document statuses to PENDING
            const docPhase = await tx.documentationPhase.findUnique({
                where: { id: documentationPhaseId },
                select: { phaseId: true },
            });

            if (docPhase) {
                await tx.applicationDocument.updateMany({
                    where: { phaseId: docPhase.phaseId },
                    data: { status: 'PENDING' },
                });
            }
        },

        /**
         * Manually transition to the next approval stage
         * Called when autoTransition is false and user explicitly approves stage
         */
        async transitionToNextStage(
            tx: any,
            documentationPhaseId: string,
            userId: string | null,
            comment: string | null
        ): Promise<{ completed: boolean; nextStage: any | null }> {
            // Get current stage and all stages
            const docPhase = await tx.documentationPhase.findUnique({
                where: { id: documentationPhaseId },
                include: {
                    stageProgress: {
                        orderBy: { order: 'asc' },
                    },
                    phase: true,
                },
            });

            if (!docPhase) {
                throw new AppError(404, 'Documentation phase not found');
            }

            const currentStage = docPhase.stageProgress.find(
                (s: any) => s.order === docPhase.currentStageOrder
            );

            if (!currentStage) {
                throw new AppError(400, 'No active stage found');
            }

            // Mark current stage as completed
            await tx.approvalStageProgress.update({
                where: { id: currentStage.id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    completedById: userId,
                    transitionComment: comment,
                },
            });

            // Find next stage
            const nextStage = docPhase.stageProgress.find(
                (s: any) => s.order === currentStage.order + 1
            );

            if (nextStage) {
                // Activate next stage
                const activatedAt = new Date();
                await tx.approvalStageProgress.update({
                    where: { id: nextStage.id },
                    data: {
                        status: 'IN_PROGRESS',
                        activatedAt,
                    },
                });

                // Update phase pointer
                await tx.documentationPhase.update({
                    where: { id: documentationPhaseId },
                    data: { currentStageOrder: nextStage.order },
                });

                // AUTOMATIC: Notify organization when their review stage activates
                // This is CORE functionality - not configurable via event handlers
                await this.notifyOrganizationOfReviewStage(
                    tx,
                    docPhase,
                    nextStage,
                    activatedAt
                );

                return { completed: false, nextStage };
            } else {
                // All stages completed - mark documentation phase as complete
                await tx.applicationPhase.update({
                    where: { id: docPhase.phaseId },
                    data: {
                        status: 'COMPLETED',
                        completedAt: new Date(),
                    },
                });

                // Auto-activate next application phase
                const nextApplicationPhase = await tx.applicationPhase.findFirst({
                    where: {
                        applicationId: docPhase.phase.applicationId,
                        order: docPhase.phase.order + 1,
                    },
                });

                if (nextApplicationPhase) {
                    await tx.applicationPhase.update({
                        where: { id: nextApplicationPhase.id },
                        data: {
                            status: 'IN_PROGRESS',
                            activatedAt: new Date(),
                        },
                    });

                    // Update application's current phase
                    await tx.application.update({
                        where: { id: docPhase.phase.applicationId },
                        data: { currentPhaseId: nextApplicationPhase.id },
                    });

                    // Create domain event for phase activation
                    await tx.domainEvent.create({
                        data: {
                            id: uuidv4(),
                            tenantId: docPhase.tenantId,
                            eventType: 'PHASE.ACTIVATED',
                            aggregateType: 'ApplicationPhase',
                            aggregateId: nextApplicationPhase.id,
                            queueName: 'notifications',
                            payload: JSON.stringify({
                                applicationId: docPhase.phase.applicationId,
                                phaseId: nextApplicationPhase.id,
                                phaseName: nextApplicationPhase.name,
                                phaseType: nextApplicationPhase.phaseType,
                            }),
                        },
                    });
                } else {
                    // No more phases - mark application as COMPLETED
                    await tx.application.update({
                        where: { id: docPhase.phase.applicationId },
                        data: {
                            status: 'COMPLETED',
                            endDate: new Date(),
                        },
                    });

                    // Create domain event for application completion
                    await tx.domainEvent.create({
                        data: {
                            id: uuidv4(),
                            tenantId: docPhase.tenantId,
                            eventType: 'APPLICATION.COMPLETED',
                            aggregateType: 'Application',
                            aggregateId: docPhase.phase.applicationId,
                            queueName: 'notifications',
                            payload: JSON.stringify({
                                applicationId: docPhase.phase.applicationId,
                            }),
                        },
                    });
                }

                return { completed: true, nextStage: null };
            }
        },

        /**
         * Get document checklist for a documentation phase
         * Returns required documents with their upload/approval status
         */
        async getDocumentChecklist(documentationPhaseId: string): Promise<any[]> {
            const docPhase = await prisma.documentationPhase.findUnique({
                where: { id: documentationPhaseId },
                include: {
                    phase: {
                        include: {
                            application: {
                                include: {
                                    documents: {
                                        where: {
                                            // Documents for this phase
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            if (!docPhase) {
                throw new AppError(404, 'Documentation phase not found');
            }

            const definitions = (docPhase.documentDefinitionsSnapshot as unknown as DocumentDefinitionSnapshot[]) || [];

            // Get uploaded documents for this phase
            const uploadedDocs = await prisma.applicationDocument.findMany({
                where: {
                    applicationId: docPhase.phase.applicationId,
                    phaseId: docPhase.phaseId,
                },
                include: {
                    approvalTrail: {
                        orderBy: { createdAt: 'desc' },
                    },
                },
            });

            // Map definitions to checklist items
            return definitions.map(def => {
                const doc = uploadedDocs.find(d => d.documentType === def.documentType);
                return {
                    documentType: def.documentType,
                    documentName: def.documentName,
                    isRequired: def.isRequired,
                    uploadedBy: def.uploadedBy,
                    description: def.description,
                    // Status
                    isUploaded: !!doc,
                    document: doc || null,
                    status: doc?.status || null,
                    approvals: doc?.approvalTrail || [],
                };
            });
        },

        /**
         * AUTOMATIC: Notify organization members when their review stage activates.
         * This is CORE functionality - not manually configurable.
         * 
         * When a stage for BANK, DEVELOPER, LEGAL, etc. organization type activates:
         * 1. Find the ApplicationOrganization binding for that organization type
         * 2. Start SLA clock on the ApplicationOrganization
         * 3. Notify all organization members with reviewer role
         */
        async notifyOrganizationOfReviewStage(
            tx: any,
            docPhase: any,
            stage: any,
            activatedAt: Date
        ): Promise<void> {
            try {
                // Stage must have an organizationType - skip if missing or if it's PLATFORM/CUSTOMER
                // (PLATFORM and CUSTOMER stages don't need external organization notifications)
                if (!stage.organizationType?.code) {
                    return;
                }

                const orgTypeCode = stage.organizationType.code;
                if (orgTypeCode === 'PLATFORM' || orgTypeCode === 'CUSTOMER') {
                    // Internal/customer stages don't map to external organizations
                    return;
                }

                // Get application with property details
                const application = await tx.application.findUnique({
                    where: { id: docPhase.phase.applicationId },
                    include: {
                        buyer: true,
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
                });

                if (!application) return;

                // Find ApplicationOrganization binding for this org type
                const appOrgs = await tx.applicationOrganization.findMany({
                    where: {
                        applicationId: application.id,
                    },
                    include: {
                        organization: {
                            include: {
                                types: {
                                    include: {
                                        type: true,
                                    },
                                },
                                members: {
                                    include: {
                                        user: true,
                                    },
                                },
                            },
                        },
                    },
                });

                // Find the org that has the matching type
                const appOrg = appOrgs.find(
                    (ao: any) => ao.organization.types.some((t: any) => t.type.code === orgTypeCode)
                );

                if (!appOrg) {
                    console.log(`[ApprovalWorkflow] No ${orgTypeCode} organization bound to application ${application.id}`);
                    return;
                }

                // Start SLA clock on ApplicationOrganization
                const slaDeadline = appOrg.slaHours
                    ? new Date(activatedAt.getTime() + appOrg.slaHours * 60 * 60 * 1000)
                    : null;

                await tx.applicationOrganization.update({
                    where: { id: appOrg.id },
                    data: {
                        status: 'ACTIVE',
                        activatedAt,
                    },
                });

                // Get pending documents count for this stage
                const pendingDocs = await tx.applicationDocument.count({
                    where: {
                        applicationId: application.id,
                        phaseId: docPhase.phaseId,
                        status: 'PENDING',
                    },
                });

                // Notify all organization members (role-based filtering removed - use RBAC permissions instead)
                const members = appOrg.organization.members.filter(
                    (m: any) => m.user?.email
                );

                for (const member of members) {
                    try {
                        await sendBankReviewRequiredNotification({
                            email: member.user.email,
                            reviewerName: member.user.firstName || member.user.email,
                            organizationName: appOrg.organization.name,
                            applicationNumber: application.applicationNumber || application.id,
                            customerName: `${application.buyer.firstName || ''} ${application.buyer.lastName || ''}`.trim() || application.buyer.email,
                            propertyName: application.propertyUnit?.variant?.property?.title || 'Property',
                            unitNumber: application.propertyUnit?.unitNumber || '',
                            stageName: stage.name,
                            documentsCount: pendingDocs,
                            slaHours: appOrg.slaHours,
                            slaDeadline: slaDeadline ? formatDate(slaDeadline) : undefined,
                            dashboardUrl: `${DASHBOARD_URL}/reviews/${application.id}`,
                        });
                    } catch (notifyError) {
                        console.error(`[ApprovalWorkflow] Failed to notify ${member.user.email}:`, notifyError);
                    }
                }

                console.log(`[ApprovalWorkflow] Notified ${members.length} reviewers at ${appOrg.organization.name} for stage ${stage.name}`);
            } catch (error) {
                // Notification failures should not break the main flow
                console.error('[ApprovalWorkflow] Error notifying organization:', error);
            }
        },
    };
}

export const approvalWorkflowService = createApprovalWorkflowService();
