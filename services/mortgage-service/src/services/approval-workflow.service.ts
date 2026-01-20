import { prisma } from '../lib/prisma';
import {
    AppError,
    StageStatus,
    ReviewDecision,
    ReviewParty,
    DocumentStatus,
    RejectionBehavior,
    PhaseStatus,
} from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';

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
 */
export interface ApprovalStageSnapshot {
    id: string;
    name: string;
    order: number;
    reviewParty: ReviewParty;
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
    reviewParty: ReviewParty;
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
                reviewParty: stage.reviewParty,
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

            // Get the documentation phase to verify it exists and get the phase ID
            const docPhase = await prisma.documentationPhase.findUnique({
                where: { id: documentationPhaseId },
                select: {
                    id: true,
                    phaseId: true,
                    phase: {
                        select: { status: true },
                    },
                },
            });

            if (!docPhase) {
                throw new AppError(404, 'Documentation phase not found');
            }

            if (docPhase.phase.status !== 'IN_PROGRESS' && docPhase.phase.status !== 'ACTIVE') {
                throw new AppError(400, 'Cannot upload documents to an inactive phase');
            }

            // Check if document already exists for this type
            const existingDoc = await prisma.applicationDocument.findFirst({
                where: {
                    applicationId,
                    phaseId: docPhase.phaseId,
                    documentType,
                },
            });

            if (existingDoc) {
                // Update existing document (re-upload)
                return prisma.applicationDocument.update({
                    where: { id: existingDoc.id },
                    data: {
                        name: fileName,
                        url: fileUrl,
                        documentName,
                        uploadedById,
                        status: 'PENDING',
                        updatedAt: new Date(),
                    },
                });
            }

            // Create new document
            return prisma.applicationDocument.create({
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
                    status: 'PENDING',
                },
            });
        },

        /**
         * Review a document within the current approval stage
         * Creates a DocumentApproval record and updates document status
         */
        async reviewDocument(input: ReviewDocumentInput): Promise<any> {
            const { tenantId, documentId, reviewerId, reviewParty, decision, comment } = input;

            // Get the document and its phase
            const document = await prisma.applicationDocument.findUnique({
                where: { id: documentId },
                include: {
                    application: {
                        select: {
                            phases: {
                                where: { phaseCategory: 'DOCUMENTATION' },
                                include: {
                                    documentationPhase: {
                                        include: {
                                            stageProgress: {
                                                orderBy: { order: 'asc' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            if (!document) {
                throw new AppError(404, 'Document not found');
            }

            // Find the documentation phase for this document
            const docPhase = document.application?.phases.find(
                p => p.documentationPhase !== null
            )?.documentationPhase;

            if (!docPhase) {
                throw new AppError(404, 'Documentation phase not found for this document');
            }

            // Get the current active stage
            const currentStage = docPhase.stageProgress.find(
                s => s.status === 'IN_PROGRESS'
            );

            if (!currentStage) {
                throw new AppError(400, 'No active approval stage found');
            }

            // Verify reviewer's party matches the current stage
            if (currentStage.reviewParty !== reviewParty) {
                throw new AppError(403, `Current stage requires ${currentStage.reviewParty} review, not ${reviewParty}`);
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
                        reviewParty,
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
         */
        async evaluateStageCompletion(
            tx: any,
            documentationPhaseId: string,
            stageProgressId: string
        ): Promise<void> {
            // Get the stage and its documents
            const stage = await tx.approvalStageProgress.findUnique({
                where: { id: stageProgressId },
                include: {
                    documentApprovals: true,
                    documentationPhase: {
                        include: {
                            phase: {
                                include: {
                                    application: {
                                        include: {
                                            documents: {
                                                where: {
                                                    phaseId: undefined, // Will be set properly
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            if (!stage) return;

            // Get documents for this phase
            const phaseDocuments = await tx.applicationDocument.findMany({
                where: {
                    applicationId: stage.documentationPhase.phase.applicationId,
                    phaseId: stage.documentationPhase.phaseId,
                },
            });

            // Check if all documents have been reviewed in this stage
            const approvedDocs = stage.documentApprovals.filter(
                (a: any) => a.decision === 'APPROVED'
            );
            const rejectedDocs = stage.documentApprovals.filter(
                (a: any) => a.decision === 'REJECTED' || a.decision === 'CHANGES_REQUESTED'
            );

            // If any document was rejected, handle rejection behavior
            if (rejectedDocs.length > 0) {
                await this.handleStageRejection(tx, stage, rejectedDocs);
                return;
            }

            // If waiting for all documents and not all are approved, don't transition
            if (stage.waitForAllDocuments && approvedDocs.length < phaseDocuments.length) {
                return;
            }

            // All documents approved - check if auto-transition or mark as awaiting
            if (stage.autoTransition) {
                await this.transitionToNextStage(tx, documentationPhaseId, null, null);
            } else {
                await tx.approvalStageProgress.update({
                    where: { id: stageProgressId },
                    data: { status: 'AWAITING_TRANSITION' },
                });
            }
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
                await tx.approvalStageProgress.update({
                    where: { id: nextStage.id },
                    data: {
                        status: 'IN_PROGRESS',
                        activatedAt: new Date(),
                    },
                });

                // Update phase pointer
                await tx.documentationPhase.update({
                    where: { id: documentationPhaseId },
                    data: { currentStageOrder: nextStage.order },
                });

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
    };
}

export const approvalWorkflowService = createApprovalWorkflowService();
