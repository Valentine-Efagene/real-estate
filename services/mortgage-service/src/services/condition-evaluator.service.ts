/**
 * Condition Evaluator Service
 *
 * Evaluates document conditions against questionnaire answers to determine
 * which documents are required for a specific application.
 *
 * This service is used when a documentation phase is activated to:
 * 1. Load answers from the source questionnaire phase
 * 2. Evaluate each document definition's condition against those answers
 * 3. Determine which documents are actually required
 *
 * Condition format examples:
 * - Simple: { "questionKey": "mortgage_type", "operator": "EQUALS", "value": "JOINT" }
 * - IN operator: { "questionKey": "employment_status", "operator": "IN", "values": ["SELF_EMPLOYED", "BUSINESS_OWNER"] }
 * - AND logic: { "all": [{ ... }, { ... }] }
 * - OR logic: { "any": [{ ... }, { ... }] }
 */

import { ConditionOperator } from '@valentine-efagene/qshelter-common';

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
 * Result of document condition evaluation
 */
export interface DocumentEvaluationResult {
    documentType: string;
    documentName: string;
    condition: Condition | null;
    isApplicable: boolean;
    isRequired: boolean; // Original required status from definition
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
            // field.name is the questionKey, field.answer is the user's answer (JSON field)
            if (field.answer !== null && field.answer !== undefined) {
                // answer is stored as JSON, which may be a string like '"SINGLE"' or a raw value
                const answer = field.answer;
                if (typeof answer === 'string' && answer.startsWith('"') && answer.endsWith('"')) {
                    try {
                        answers[field.name] = JSON.parse(answer);
                    } catch {
                        answers[field.name] = answer;
                    }
                } else {
                    answers[field.name] = answer;
                }
            }
        }

        return answers;
    }

    /**
     * Evaluate all document definitions in a documentation phase and determine applicability
     * Uses documentDefinitionsSnapshot or the linked documentationPlan's definitions
     * Returns list of documents with their applicability status
     */
    async function evaluateDocumentsForPhase(
        documentationPhaseId: string
    ): Promise<DocumentEvaluationResult[]> {
        const docPhase = await prisma.documentationPhase.findUnique({
            where: { id: documentationPhaseId },
            include: {
                documentationPlan: {
                    include: {
                        documentDefinitions: {
                            orderBy: { order: 'asc' },
                        },
                    },
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

        // Get document definitions from snapshot or plan
        let documentDefinitions: any[] = [];
        if (docPhase.documentDefinitionsSnapshot && Array.isArray(docPhase.documentDefinitionsSnapshot)) {
            documentDefinitions = docPhase.documentDefinitionsSnapshot as any[];
        } else if (docPhase.documentationPlan?.documentDefinitions) {
            documentDefinitions = docPhase.documentationPlan.documentDefinitions;
        }

        // If no document definitions, return empty results
        if (documentDefinitions.length === 0) {
            return [];
        }

        // If no source questionnaire, all documents are applicable (unconditional)
        if (!docPhase.sourceQuestionnairePhase) {
            return documentDefinitions.map((doc: any) => ({
                documentType: doc.documentType,
                documentName: doc.documentName,
                condition: doc.condition,
                isApplicable: true,
                isRequired: doc.isRequired ?? true,
            }));
        }

        // Build answers map from questionnaire fields
        const answers: QuestionnaireAnswers = {};
        for (const field of docPhase.sourceQuestionnairePhase.fields) {
            if (field.answer !== null && field.answer !== undefined) {
                const answer = field.answer;
                if (typeof answer === 'string' && answer.startsWith('"') && answer.endsWith('"')) {
                    try {
                        answers[field.name] = JSON.parse(answer);
                    } catch {
                        answers[field.name] = answer;
                    }
                } else {
                    answers[field.name] = answer;
                }
            }
        }

        // Evaluate each document's condition
        return documentDefinitions.map((doc: any) => {
            // Documents without conditions are always applicable
            if (!doc.condition) {
                return {
                    documentType: doc.documentType,
                    documentName: doc.documentName,
                    condition: null,
                    isApplicable: true,
                    isRequired: doc.isRequired ?? true,
                };
            }

            const isApplicable = evaluateCondition(doc.condition as Condition, answers);

            return {
                documentType: doc.documentType,
                documentName: doc.documentName,
                condition: doc.condition as Condition,
                isApplicable,
                isRequired: doc.isRequired ?? true,
            };
        });
    }

    /**
     * Apply condition evaluation results to a documentation phase
     * Updates the required documents count based on applicable documents
     */
    async function applyConditionEvaluation(
        documentationPhaseId: string
    ): Promise<{
        skippedCount: number;
        applicableCount: number;
        results: DocumentEvaluationResult[];
    }> {
        const results = await evaluateDocumentsForPhase(documentationPhaseId);

        const skippedDocs = results.filter((r) => !r.isApplicable);
        const applicableDocs = results.filter((r) => r.isApplicable);
        const requiredApplicableDocs = applicableDocs.filter((r) => r.isRequired);

        // Update the documentation phase with correct required documents count
        // Only count applicable + required documents
        await prisma.documentationPhase.update({
            where: { id: documentationPhaseId },
            data: {
                requiredDocumentsCount: requiredApplicableDocs.length,
            },
        });

        return {
            skippedCount: skippedDocs.length,
            applicableCount: applicableDocs.length,
            results,
        };
    }

    return {
        getQuestionnaireAnswers,
        evaluateDocumentsForPhase,
        applyConditionEvaluation,
        evaluateCondition, // Expose for testing
    };
}

export type ConditionEvaluatorService = ReturnType<typeof createConditionEvaluatorService>;
