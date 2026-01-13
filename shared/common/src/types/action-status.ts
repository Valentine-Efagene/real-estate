/**
 * Action Status Types - Back-end driven UI indicators
 * 
 * This module provides types for indicating who needs to act next
 * at various levels of the application (application, phase, step).
 * 
 * The frontend uses this to show:
 * - "Awaiting your action" (CUSTOMER)
 * - "Under review" (ADMIN)
 * - "Processing..." (SYSTEM)
 * - "Completed" (NONE)
 * - "Awaiting payment" (CUSTOMER for payment phases)
 */

/**
 * The actor who needs to take the next action
 */
export enum NextActor {
    /** Customer must take action (upload, sign, pay) */
    CUSTOMER = 'CUSTOMER',
    /** Admin must take action (review, approve, reject) */
    ADMIN = 'ADMIN',
    /** System is processing (auto-generation, webhook, etc.) */
    SYSTEM = 'SYSTEM',
    /** No action required - completed or waiting for external event */
    NONE = 'NONE',
}

/**
 * High-level action categories for easier UI grouping
 */
export enum ActionCategory {
    /** Document upload/reupload needed */
    UPLOAD = 'UPLOAD',
    /** Signature required */
    SIGNATURE = 'SIGNATURE',
    /** Review/approval needed */
    REVIEW = 'REVIEW',
    /** Payment required */
    PAYMENT = 'PAYMENT',
    /** Waiting for external process */
    PROCESSING = 'PROCESSING',
    /** Phase/step/application completed */
    COMPLETED = 'COMPLETED',
    /** Waiting for previous phase/step */
    WAITING = 'WAITING',
}

/**
 * Detailed action status for a step, phase, or application
 */
export interface ActionStatus {
    /** Who needs to act next */
    nextActor: NextActor;
    /** Category of action required */
    actionCategory: ActionCategory;
    /** Human-readable description of what's needed */
    actionRequired: string;
    /** Optional: Additional context (e.g., "2 of 3 documents uploaded") */
    progress?: string;
    /** Optional: When this action is due (for time-sensitive actions) */
    dueDate?: Date | string | null;
    /** Optional: Whether this is blocking the overall workflow */
    isBlocking?: boolean;
}

/**
 * Step-level action status with step details
 */
export interface StepActionStatus extends ActionStatus {
    stepId: string;
    stepName: string;
    stepType: string;
    stepOrder: number;
}

/**
 * Phase-level action status with aggregated step info
 */
export interface PhaseActionStatus extends ActionStatus {
    phaseId: string;
    phaseName: string;
    phaseType: string;
    phaseCategory: string;
    /** Current step requiring attention (if documentation phase) */
    currentStep?: StepActionStatus | null;
    /** Summary of step progress (e.g., "3 of 5 steps completed") */
    stepsProgress?: string;
    /** For payment phases: payment progress summary */
    paymentProgress?: string;
}

/**
 * Application-level action status with phase info
 */
export interface ApplicationActionStatus extends ActionStatus {
    applicationId: string;
    applicationNumber: string;
    /** Current phase requiring attention */
    currentPhase?: PhaseActionStatus | null;
    /** Summary of phase progress */
    phasesProgress?: string;
}

/**
 * Compute action status for a documentation step
 */
export function computeStepActionStatus(step: {
    id: string;
    name: string;
    stepType: string;
    order: number;
    status: string;
    actionReason?: string | null;
    dueDate?: Date | string | null;
}, pendingDocuments?: number, totalDocuments?: number): StepActionStatus {
    const base = {
        stepId: step.id,
        stepName: step.name,
        stepType: step.stepType,
        stepOrder: step.order,
        dueDate: step.dueDate ?? null,
        isBlocking: true,
    };

    // Handle step status
    switch (step.status) {
        case 'COMPLETED':
            return {
                ...base,
                nextActor: NextActor.NONE,
                actionCategory: ActionCategory.COMPLETED,
                actionRequired: 'Step completed',
                isBlocking: false,
            };

        case 'SKIPPED':
            return {
                ...base,
                nextActor: NextActor.NONE,
                actionCategory: ActionCategory.COMPLETED,
                actionRequired: 'Step skipped',
                isBlocking: false,
            };

        case 'NEEDS_RESUBMISSION':
            return {
                ...base,
                nextActor: NextActor.CUSTOMER,
                actionCategory: ActionCategory.UPLOAD,
                actionRequired: step.actionReason || 'Please resubmit the required document',
                progress: 'Document was rejected - resubmission required',
            };

        case 'ACTION_REQUIRED':
            return {
                ...base,
                nextActor: NextActor.CUSTOMER,
                actionCategory: ActionCategory.UPLOAD,
                actionRequired: step.actionReason || 'Your action is required',
            };

        case 'AWAITING_REVIEW':
            return {
                ...base,
                nextActor: NextActor.ADMIN,
                actionCategory: ActionCategory.REVIEW,
                actionRequired: 'Document submitted - awaiting admin review',
                progress: 'Under review',
            };

        case 'IN_PROGRESS':
        case 'PENDING':
            // Determine based on step type
            return computeStepActionByType(step, base, pendingDocuments, totalDocuments);

        case 'FAILED':
            return {
                ...base,
                nextActor: NextActor.ADMIN,
                actionCategory: ActionCategory.REVIEW,
                actionRequired: 'Step failed - admin intervention required',
            };

        default:
            return {
                ...base,
                nextActor: NextActor.NONE,
                actionCategory: ActionCategory.WAITING,
                actionRequired: 'Waiting',
            };
    }
}

/**
 * Compute action status based on step type for PENDING/IN_PROGRESS steps
 */
function computeStepActionByType(
    step: { id: string; name: string; stepType: string; order: number; status: string },
    base: Omit<StepActionStatus, 'nextActor' | 'actionCategory' | 'actionRequired'>,
    pendingDocuments?: number,
    totalDocuments?: number
): StepActionStatus {
    switch (step.stepType) {
        case 'UPLOAD':
            const progress = totalDocuments !== undefined && pendingDocuments !== undefined
                ? `${totalDocuments - pendingDocuments} of ${totalDocuments} documents uploaded`
                : undefined;
            return {
                ...base,
                nextActor: NextActor.CUSTOMER,
                actionCategory: ActionCategory.UPLOAD,
                actionRequired: `Upload required: ${step.name}`,
                progress,
            };

        case 'SIGNATURE':
            return {
                ...base,
                nextActor: NextActor.CUSTOMER,
                actionCategory: ActionCategory.SIGNATURE,
                actionRequired: `Signature required: ${step.name}`,
            };

        case 'APPROVAL':
        case 'REVIEW':
            return {
                ...base,
                nextActor: NextActor.ADMIN,
                actionCategory: ActionCategory.REVIEW,
                actionRequired: `Admin review required: ${step.name}`,
                progress: 'Awaiting admin approval',
            };

        case 'GENERATE_DOCUMENT':
            return {
                ...base,
                nextActor: NextActor.SYSTEM,
                actionCategory: ActionCategory.PROCESSING,
                actionRequired: `Generating document: ${step.name}`,
                progress: 'System is processing',
            };

        case 'EXTERNAL_CHECK':
        case 'WAIT':
            return {
                ...base,
                nextActor: NextActor.SYSTEM,
                actionCategory: ActionCategory.PROCESSING,
                actionRequired: `Waiting for external process: ${step.name}`,
                progress: 'Awaiting external verification',
            };

        case 'PRE_APPROVAL':
        case 'UNDERWRITING':
            return {
                ...base,
                nextActor: NextActor.SYSTEM,
                actionCategory: ActionCategory.PROCESSING,
                actionRequired: `Processing: ${step.name}`,
                progress: 'Underwriting in progress',
            };

        default:
            return {
                ...base,
                nextActor: NextActor.CUSTOMER,
                actionCategory: ActionCategory.UPLOAD,
                actionRequired: step.name,
            };
    }
}

/**
 * Compute action status for a phase based on its category and current state
 */
export function computePhaseActionStatus(phase: {
    id: string;
    name: string;
    phaseType: string;
    phaseCategory: string;
    status: string;
    dueDate?: Date | string | null;
    documentationPhase?: {
        currentStep?: any | null;
        steps?: any[];
        completedStepsCount?: number;
        totalStepsCount?: number;
        approvedDocumentsCount?: number;
        requiredDocumentsCount?: number;
    } | null;
    paymentPhase?: {
        totalAmount?: number;
        paidAmount?: number;
        installments?: any[];
    } | null;
    questionnairePhase?: {
        completedFieldsCount?: number;
        totalFieldsCount?: number;
    } | null;
}): PhaseActionStatus {
    const base = {
        phaseId: phase.id,
        phaseName: phase.name,
        phaseType: phase.phaseType,
        phaseCategory: phase.phaseCategory,
        dueDate: phase.dueDate ?? null,
    };

    // Handle phase status
    switch (phase.status) {
        case 'COMPLETED':
            return {
                ...base,
                nextActor: NextActor.NONE,
                actionCategory: ActionCategory.COMPLETED,
                actionRequired: 'Phase completed',
                isBlocking: false,
            };

        case 'SKIPPED':
        case 'SUPERSEDED':
            return {
                ...base,
                nextActor: NextActor.NONE,
                actionCategory: ActionCategory.COMPLETED,
                actionRequired: 'Phase skipped',
                isBlocking: false,
            };

        case 'PENDING':
            return {
                ...base,
                nextActor: NextActor.NONE,
                actionCategory: ActionCategory.WAITING,
                actionRequired: 'Waiting for previous phase to complete',
                isBlocking: false,
            };

        case 'FAILED':
            return {
                ...base,
                nextActor: NextActor.ADMIN,
                actionCategory: ActionCategory.REVIEW,
                actionRequired: 'Phase failed - admin intervention required',
                isBlocking: true,
            };
    }

    // For IN_PROGRESS/ACTIVE phases, determine based on category
    switch (phase.phaseCategory) {
        case 'DOCUMENTATION':
            return computeDocumentationPhaseStatus(phase, base);
        case 'PAYMENT':
            return computePaymentPhaseStatus(phase, base);
        case 'QUESTIONNAIRE':
            return computeQuestionnairePhaseStatus(phase, base);
        default:
            return {
                ...base,
                nextActor: NextActor.CUSTOMER,
                actionCategory: ActionCategory.UPLOAD,
                actionRequired: 'Action required',
                isBlocking: true,
            };
    }
}

function computeDocumentationPhaseStatus(
    phase: any,
    base: Omit<PhaseActionStatus, 'nextActor' | 'actionCategory' | 'actionRequired'>
): PhaseActionStatus {
    const docPhase = phase.documentationPhase;
    if (!docPhase) {
        return {
            ...base,
            nextActor: NextActor.CUSTOMER,
            actionCategory: ActionCategory.UPLOAD,
            actionRequired: 'Documentation required',
            isBlocking: true,
        };
    }

    const completedSteps = docPhase.completedStepsCount ?? 0;
    const totalSteps = docPhase.totalStepsCount ?? docPhase.steps?.length ?? 0;
    const stepsProgress = `${completedSteps} of ${totalSteps} steps completed`;

    // Get current step status
    const currentStep = docPhase.currentStep;
    if (currentStep) {
        const stepStatus = computeStepActionStatus(currentStep);
        return {
            ...base,
            nextActor: stepStatus.nextActor,
            actionCategory: stepStatus.actionCategory,
            actionRequired: stepStatus.actionRequired,
            progress: stepStatus.progress,
            stepsProgress,
            currentStep: stepStatus,
            isBlocking: true,
        };
    }

    // No current step - check if all steps are completed
    const steps = docPhase.steps || [];
    const allCompleted = steps.every((s: any) => s.status === 'COMPLETED');
    if (allCompleted) {
        return {
            ...base,
            nextActor: NextActor.NONE,
            actionCategory: ActionCategory.COMPLETED,
            actionRequired: 'All steps completed',
            stepsProgress,
            isBlocking: false,
        };
    }

    // Find next pending step
    const nextStep = steps.find((s: any) =>
        s.status !== 'COMPLETED' && s.status !== 'SKIPPED'
    );
    if (nextStep) {
        const stepStatus = computeStepActionStatus(nextStep);
        return {
            ...base,
            nextActor: stepStatus.nextActor,
            actionCategory: stepStatus.actionCategory,
            actionRequired: stepStatus.actionRequired,
            progress: stepStatus.progress,
            stepsProgress,
            currentStep: stepStatus,
            isBlocking: true,
        };
    }

    return {
        ...base,
        nextActor: NextActor.NONE,
        actionCategory: ActionCategory.WAITING,
        actionRequired: 'Waiting',
        stepsProgress,
        isBlocking: false,
    };
}

function computePaymentPhaseStatus(
    phase: any,
    base: Omit<PhaseActionStatus, 'nextActor' | 'actionCategory' | 'actionRequired'>
): PhaseActionStatus {
    const payPhase = phase.paymentPhase;
    if (!payPhase) {
        return {
            ...base,
            nextActor: NextActor.CUSTOMER,
            actionCategory: ActionCategory.PAYMENT,
            actionRequired: 'Payment required',
            isBlocking: true,
        };
    }

    const totalAmount = payPhase.totalAmount ?? 0;
    const paidAmount = payPhase.paidAmount ?? 0;
    const remainingAmount = totalAmount - paidAmount;
    const paymentProgress = `₦${paidAmount.toLocaleString()} of ₦${totalAmount.toLocaleString()} paid`;

    if (remainingAmount <= 0) {
        return {
            ...base,
            nextActor: NextActor.NONE,
            actionCategory: ActionCategory.COMPLETED,
            actionRequired: 'Payment completed',
            paymentProgress,
            isBlocking: false,
        };
    }

    // Check for pending installments
    const installments = payPhase.installments || [];
    const pendingInstallment = installments.find(
        (i: any) => i.status === 'PENDING' || i.status === 'OVERDUE' || i.status === 'PARTIALLY_PAID'
    );

    if (pendingInstallment) {
        const isOverdue = pendingInstallment.status === 'OVERDUE';
        return {
            ...base,
            nextActor: NextActor.CUSTOMER,
            actionCategory: ActionCategory.PAYMENT,
            actionRequired: isOverdue
                ? `Overdue payment: ₦${pendingInstallment.amount.toLocaleString()}`
                : `Payment due: ₦${pendingInstallment.amount.toLocaleString()}`,
            paymentProgress,
            dueDate: pendingInstallment.dueDate,
            isBlocking: true,
        };
    }

    return {
        ...base,
        nextActor: NextActor.CUSTOMER,
        actionCategory: ActionCategory.PAYMENT,
        actionRequired: `Remaining balance: ₦${remainingAmount.toLocaleString()}`,
        paymentProgress,
        isBlocking: true,
    };
}

function computeQuestionnairePhaseStatus(
    phase: any,
    base: Omit<PhaseActionStatus, 'nextActor' | 'actionCategory' | 'actionRequired'>
): PhaseActionStatus {
    const qPhase = phase.questionnairePhase;
    if (!qPhase) {
        return {
            ...base,
            nextActor: NextActor.CUSTOMER,
            actionCategory: ActionCategory.UPLOAD,
            actionRequired: 'Complete questionnaire',
            isBlocking: true,
        };
    }

    const completedFields = qPhase.completedFieldsCount ?? 0;
    const totalFields = qPhase.totalFieldsCount ?? 0;
    const progress = `${completedFields} of ${totalFields} fields completed`;

    if (completedFields >= totalFields && totalFields > 0) {
        return {
            ...base,
            nextActor: NextActor.NONE,
            actionCategory: ActionCategory.COMPLETED,
            actionRequired: 'Questionnaire completed',
            progress,
            isBlocking: false,
        };
    }

    return {
        ...base,
        nextActor: NextActor.CUSTOMER,
        actionCategory: ActionCategory.UPLOAD,
        actionRequired: 'Complete questionnaire fields',
        progress,
        isBlocking: true,
    };
}
