/**
 * Condition Evaluator
 * 
 * Evaluates conditional logic for documentation plan steps based on questionnaire answers.
 * Used to determine which document requirements apply to a specific application.
 */

import { CONDITION_OPERATORS, type StepCondition } from '@valentine-efagene/qshelter-common';

// Re-export for convenience
export { CONDITION_OPERATORS };
export type { StepCondition };

export interface QuestionnaireAnswers {
    [questionKey: string]: string | number | boolean | null | undefined;
}

/**
 * Evaluates a single condition against questionnaire answers.
 * Returns true if the condition is met, false otherwise.
 * 
 * @param condition - The condition to evaluate
 * @param answers - The questionnaire answers to evaluate against
 * @returns Whether the condition is satisfied
 */
export function evaluateCondition(condition: StepCondition | null | undefined, answers: QuestionnaireAnswers): boolean {
    // No condition means always required
    if (!condition) {
        return true;
    }

    // Handle compound conditions (AND/OR logic)
    if ('all' in condition && condition.all && Array.isArray(condition.all)) {
        return condition.all.every((subCondition: StepCondition) => evaluateCondition(subCondition, answers));
    }

    if ('any' in condition && condition.any && Array.isArray(condition.any)) {
        return condition.any.some((subCondition: StepCondition) => evaluateCondition(subCondition, answers));
    }

    // Handle simple conditions - must have questionKey and operator
    if (!('questionKey' in condition) || !('operator' in condition) || !condition.questionKey || !condition.operator) {
        // Invalid condition structure - treat as always required for safety
        return true;
    }

    const answerValue = answers[condition.questionKey];

    switch (condition.operator) {
        case CONDITION_OPERATORS.EQUALS:
            return answerValue === condition.value;

        case CONDITION_OPERATORS.NOT_EQUALS:
            return answerValue !== condition.value;

        case CONDITION_OPERATORS.IN:
            if (!condition.values || !Array.isArray(condition.values)) {
                return false;
            }
            return condition.values.includes(answerValue as string | number);

        case CONDITION_OPERATORS.NOT_IN:
            if (!condition.values || !Array.isArray(condition.values)) {
                return true;
            }
            return !condition.values.includes(answerValue as string | number);

        case CONDITION_OPERATORS.GREATER_THAN:
            if (typeof answerValue !== 'number' || typeof condition.value !== 'number') {
                return false;
            }
            return answerValue > condition.value;

        case CONDITION_OPERATORS.LESS_THAN:
            if (typeof answerValue !== 'number' || typeof condition.value !== 'number') {
                return false;
            }
            return answerValue < condition.value;

        case CONDITION_OPERATORS.EXISTS:
            return answerValue !== null && answerValue !== undefined;

        default:
            // Unknown operator - treat as always required for safety
            return true;
    }
}

/**
 * Filters documentation plan steps based on questionnaire answers.
 * Only returns steps whose conditions are satisfied.
 * 
 * @param steps - The documentation plan steps to filter
 * @param answers - The questionnaire answers to evaluate against
 * @returns Filtered array of steps that apply based on conditions
 */
export function filterStepsByCondition<T extends { condition?: StepCondition | null }>(
    steps: T[],
    answers: QuestionnaireAnswers
): T[] {
    return steps.filter(step => evaluateCondition(step.condition, answers));
}

/**
 * Example usage:
 * 
 * const answers = {
 *   mortgage_type: 'JOINT',
 *   employment_status: 'EMPLOYED',
 *   annual_income: 5000000
 * };
 * 
 * const steps = [
 *   { name: 'ID Card', condition: null },  // Always required
 *   { name: 'Spouse ID', condition: { questionKey: 'mortgage_type', operator: 'EQUALS', value: 'JOINT' } },
 *   { name: 'Business Registration', condition: { questionKey: 'employment_status', operator: 'IN', values: ['SELF_EMPLOYED', 'BUSINESS_OWNER'] } },
 *   { name: 'High Income Verification', condition: { questionKey: 'annual_income', operator: 'GREATER_THAN', value: 10000000 } },
 * ];
 * 
 * const applicableSteps = filterStepsByCondition(steps, answers);
 * // Returns: [{ name: 'ID Card', ... }, { name: 'Spouse ID', ... }]
 */
