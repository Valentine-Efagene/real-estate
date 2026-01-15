/**
 * Condition Evaluator Service
 *
 * Evaluates step conditions against questionnaire answers to determine
 * which documentation steps apply to a specific application.
 *
 * This service is used when a documentation phase is activated to:
 * 1. Load answers from the source questionnaire phase
 * 2. Evaluate each step's condition against those answers
 * 3. Mark inapplicable steps as SKIPPED
 *
 * Condition format examples:
 * - Simple: { "questionKey": "mortgage_type", "operator": "EQUALS", "value": "JOINT" }
 * - IN operator: { "questionKey": "employment_status", "operator": "IN", "values": ["SELF_EMPLOYED", "BUSINESS_OWNER"] }
 * - AND logic: { "all": [{ ... }, { ... }] }
 * - OR logic: { "any": [{ ... }, { ... }] }
 */

import { ConditionOperator, StepStatus } from '@valentine-efagene/qshelter-common';

// Type definitions for conditions
export interface SimpleCondition {
    questionKey: string;
    operator: ConditionOperator;
    value?: any; // For EQUALS, NOT_EQUALS, GREATER_THAN, LESS_THAN, etc.
    values?: any[]; // For IN, NOT_IN
}

export interface CompoundCondition {
    all?: Condition[]; // AND - all conditions must be true
    any?: Condition[]; // OR - at least one condition must be true
}

export type Condition = SimpleCondition | CompoundCondition;

// Questionnaire answers keyed by questionKey
export type QuestionnaireAnswers = Record<string, any>;

/**
 * Evaluate a simple condition against questionnaire answers
 */
function evaluateSimpleCondition(
    condition: SimpleCondition,
    answers: QuestionnaireAnswers
): boolean {
    const answer = answers[condition.questionKey];

    switch (condition.operator) {
        case 'EQUALS':
            return answer === condition.value;

        case 'NOT_EQUALS':
            return answer !== condition.value;

        case 'IN':
            if (!condition.values || !Array.isArray(condition.values)) {
                return false;
            }
            return condition.values.includes(answer);

        case 'NOT_IN':
            if (!condition.values || !Array.isArray(condition.values)) {
                return true;
            }
            return !condition.values.includes(answer);

        case 'GREATER_THAN':
            return typeof answer === 'number' && answer > condition.value;

        case 'LESS_THAN':
            return typeof answer === 'number' && answer < condition.value;

        case 'GREATER_THAN_OR_EQUAL':
            return typeof answer === 'number' && answer >= condition.value;

        case 'LESS_THAN_OR_EQUAL':
            return typeof answer === 'number' && answer <= condition.value;

        case 'EXISTS':
            return answer !== null && answer !== undefined;

        case 'NOT_EXISTS':
            return answer === null || answer === undefined;

        default:
            // Unknown operator - fail safe by returning true (step is applicable)
            console.warn(`Unknown condition operator: ${condition.operator}`);
            return true;
    }
}

/**
 * Check if a condition is a compound condition (has 'all' or 'any')
 */
function isCompoundCondition(condition: Condition): condition is CompoundCondition {
    return 'all' in condition || 'any' in condition;
}

/**
 * Evaluate a condition (simple or compound) against questionnaire answers
 */
export function evaluateCondition(
    condition: Condition,
    answers: QuestionnaireAnswers
): boolean {
    if (isCompoundCondition(condition)) {
        if (condition.all) {
            // AND logic: all conditions must be true
            return condition.all.every((c) => evaluateCondition(c, answers));
        }
        if (condition.any) {
            // OR logic: at least one condition must be true
            return condition.any.some((c) => evaluateCondition(c, answers));
        }
        // Empty compound condition - return true
        return true;
    }

    // Simple condition
    return evaluateSimpleCondition(condition, answers);
}

/**
 * Result of step condition evaluation
 */
export interface StepEvaluationResult {
    stepId: string;
    stepName: string;
    condition: Condition | null;
    isApplicable: boolean;
}

/**
 * Create the condition evaluator service
 */
export function createConditionEvaluatorService(prisma: any) {
    /**
     * Get answers from a questionnaire phase as a flat key-value map
     */
    async function getQuestionnaireAnswers(
        questionnairePhaseId: string
    ): Promise<QuestionnaireAnswers> {
        const questionnairePhase = await prisma.questionnairePhase.findUnique({
            where: { id: questionnairePhaseId },
            include: {
                fields: true,
            },
        });

        if (!questionnairePhase) {
            throw new Error(`Questionnaire phase not found: ${questionnairePhaseId}`);
        }

        const answers: QuestionnaireAnswers = {};

        for (const field of questionnairePhase.fields) {
            // field.name is the questionKey, field.value is the answer
            if (field.value !== null && field.value !== undefined) {
                answers[field.name] = field.value;
            }
        }

        return answers;
    }

    /**
     * Evaluate all steps in a documentation phase and determine applicability
     * Returns list of step IDs that should be skipped
     */
    async function evaluateStepsForPhase(
        documentationPhaseId: string
    ): Promise<StepEvaluationResult[]> {
        const docPhase = await prisma.documentationPhase.findUnique({
            where: { id: documentationPhaseId },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
                sourceQuestionnairePhase: {
                    include: {
                        fields: true,
                    },
                },
            },
        });

        if (!docPhase) {
            throw new Error(`Documentation phase not found: ${documentationPhaseId}`);
        }

        // If no source questionnaire, all steps are applicable (unconditional)
        if (!docPhase.sourceQuestionnairePhase) {
            return docPhase.steps.map((step: any) => ({
                stepId: step.id,
                stepName: step.name,
                condition: step.condition,
                isApplicable: true,
            }));
        }

        // Build answers map from questionnaire fields
        const answers: QuestionnaireAnswers = {};
        for (const field of docPhase.sourceQuestionnairePhase.fields) {
            if (field.value !== null && field.value !== undefined) {
                answers[field.name] = field.value;
            }
        }

        // Evaluate each step's condition
        return docPhase.steps.map((step: any) => {
            // Steps without conditions are always applicable
            if (!step.condition) {
                return {
                    stepId: step.id,
                    stepName: step.name,
                    condition: null,
                    isApplicable: true,
                };
            }

            const isApplicable = evaluateCondition(step.condition as Condition, answers);

            return {
                stepId: step.id,
                stepName: step.name,
                condition: step.condition as Condition,
                isApplicable,
            };
        });
    }

    /**
     * Apply condition evaluation results to a documentation phase
     * Marks inapplicable steps as SKIPPED and updates counters
     */
    async function applyConditionEvaluation(
        documentationPhaseId: string
    ): Promise<{
        skippedCount: number;
        applicableCount: number;
        results: StepEvaluationResult[];
    }> {
        const results = await evaluateStepsForPhase(documentationPhaseId);

        const stepsToSkip = results.filter((r) => !r.isApplicable);
        const applicableSteps = results.filter((r) => r.isApplicable);

        // Mark inapplicable steps as SKIPPED
        if (stepsToSkip.length > 0) {
            await prisma.documentationStep.updateMany({
                where: {
                    id: { in: stepsToSkip.map((s) => s.stepId) },
                },
                data: {
                    status: 'SKIPPED' as StepStatus,
                },
            });

            // Update the documentation phase counters
            // Skipped steps count as completed for progress tracking
            await prisma.documentationPhase.update({
                where: { id: documentationPhaseId },
                data: {
                    completedStepsCount: { increment: stepsToSkip.length },
                    totalStepsCount: applicableSteps.length, // Only applicable steps count toward total
                },
            });
        }

        return {
            skippedCount: stepsToSkip.length,
            applicableCount: applicableSteps.length,
            results,
        };
    }

    return {
        getQuestionnaireAnswers,
        evaluateStepsForPhase,
        applyConditionEvaluation,
        evaluateCondition, // Expose for testing
    };
}

export type ConditionEvaluatorService = ReturnType<typeof createConditionEvaluatorService>;
