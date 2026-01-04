import { prisma } from '../../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import { createOfferLetterService } from '../offer-letter.service';

/**
 * Metadata schema for GENERATE_DOCUMENT step type.
 * 
 * When Adaeze configures a payment method with a GENERATE_DOCUMENT step,
 * she specifies the document type and optional configuration in the step's metadata.
 * 
 * Example metadata:
 * {
 *   "documentType": "PROVISIONAL_OFFER" | "FINAL_OFFER" | "CONTRACT_SUMMARY",
 *   "templateCode": "PROVISIONAL_OFFER", // optional, defaults to documentType
 *   "autoSend": true, // whether to automatically send the document
 *   "expiresInDays": 30
 * }
 */
export interface GenerateDocumentMetadata {
    documentType: 'PROVISIONAL_OFFER' | 'FINAL_OFFER' | 'CONTRACT_SUMMARY';
    templateCode?: string;
    autoSend?: boolean;
    expiresInDays?: number;
}

/**
 * Validate the metadata for a GENERATE_DOCUMENT step
 */
export function validateGenerateDocumentMetadata(metadata: unknown): GenerateDocumentMetadata {
    if (!metadata || typeof metadata !== 'object') {
        throw new AppError(400, 'GENERATE_DOCUMENT step requires metadata configuration');
    }

    const meta = metadata as Record<string, unknown>;

    if (!meta.documentType) {
        throw new AppError(400, 'GENERATE_DOCUMENT step requires documentType in metadata');
    }

    const validDocumentTypes = ['PROVISIONAL_OFFER', 'FINAL_OFFER', 'CONTRACT_SUMMARY'];
    if (!validDocumentTypes.includes(meta.documentType as string)) {
        throw new AppError(400, `Invalid documentType. Must be one of: ${validDocumentTypes.join(', ')}`);
    }

    return {
        documentType: meta.documentType as GenerateDocumentMetadata['documentType'],
        templateCode: (meta.templateCode as string) || (meta.documentType as string),
        autoSend: meta.autoSend === true,
        expiresInDays: typeof meta.expiresInDays === 'number' ? meta.expiresInDays : 30,
    };
}

/**
 * Handle document generation when a GENERATE_DOCUMENT step is triggered.
 * 
 * This handler is invoked when a GENERATE_DOCUMENT step transitions to IN_PROGRESS.
 * It generates the configured document, optionally sends it, and marks the step as complete.
 */
export async function handleGenerateDocumentStep(
    stepId: string,
    phaseId: string,
    contractId: string,
    userId: string
): Promise<{
    success: boolean;
    documentId?: string;
    documentType?: string;
    error?: string;
}> {
    // Get the step with its metadata
    const step = await prisma.contractPhaseStep.findUnique({
        where: { id: stepId },
        select: {
            id: true,
            stepType: true,
            metadata: true,
            phase: {
                select: {
                    contractId: true,
                },
            },
        },
    });

    if (!step) {
        throw new AppError(404, 'Step not found');
    }

    if (step.stepType !== 'GENERATE_DOCUMENT') {
        throw new AppError(400, 'This handler only processes GENERATE_DOCUMENT steps');
    }

    // Parse and validate metadata
    const metadata = validateGenerateDocumentMetadata(step.metadata);

    try {
        let documentId: string | undefined;

        // Handle different document types
        switch (metadata.documentType) {
            case 'PROVISIONAL_OFFER':
            case 'FINAL_OFFER': {
                // Generate offer letter using the existing offer letter service
                const offerLetterService = createOfferLetterService(prisma);
                const offerLetterType = metadata.documentType === 'PROVISIONAL_OFFER' ? 'PROVISIONAL' : 'FINAL';

                const offerLetter = await offerLetterService.generate(
                    {
                        contractId,
                        type: offerLetterType,
                        expiresInDays: metadata.expiresInDays ?? 30,
                    },
                    userId
                );

                documentId = offerLetter.id;

                // Auto-send if configured
                if (metadata.autoSend && offerLetter.id) {
                    try {
                        await offerLetterService.send(offerLetter.id, {}, userId);
                    } catch (sendError: any) {
                        console.warn('[GenerateDocumentHandler] Auto-send failed, document still generated', {
                            documentId: offerLetter.id,
                            error: sendError.message,
                        });
                    }
                }
                break;
            }

            case 'CONTRACT_SUMMARY': {
                // TODO: Implement contract summary generation
                // For now, we'll log and continue - this allows the step to be marked complete
                console.info('[GenerateDocumentHandler] CONTRACT_SUMMARY generation not yet implemented');
                break;
            }

            default:
                throw new AppError(400, `Unknown document type: ${metadata.documentType}`);
        }

        // Mark the step as completed
        await prisma.contractPhaseStep.update({
            where: { id: stepId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
            },
        });

        console.info('[GenerateDocumentHandler] Document generated successfully', {
            stepId,
            documentType: metadata.documentType,
            documentId,
        });

        return {
            success: true,
            documentId,
            documentType: metadata.documentType,
        };
    } catch (error: any) {
        console.error('[GenerateDocumentHandler] Failed to generate document', {
            stepId,
            documentType: metadata.documentType,
            error: error.message,
        });

        // Mark the step as failed
        await prisma.contractPhaseStep.update({
            where: { id: stepId },
            data: {
                status: 'FAILED',
            },
        });

        return {
            success: false,
            documentType: metadata.documentType,
            error: error.message,
        };
    }
}
