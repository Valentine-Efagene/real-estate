/**
 * Condition operators for evaluating step conditions against questionnaire answers.
 * Used in DocumentationPlanStep.condition to conditionally require documents
 * based on prequalification answers.
 *
 * ConditionOperator is a Prisma enum - this file provides TypeScript interfaces
 * for building condition objects.
 */

import { ConditionOperator } from '../../generated/client/enums';

// Re-export for convenience (the Prisma enum is the source of truth)
export { ConditionOperator };

/**
 * Interface for a simple condition that checks a single question answer.
 */
export interface SimpleCondition {
    /** The question key to check the answer for */
    questionKey: string;
    /** The comparison operator */
    operator: ConditionOperator;
    /** The value to compare against (for EQUALS, NOT_EQUALS, GREATER_THAN, LESS_THAN) */
    value?: string | number | boolean;
    /** The values to compare against (for IN, NOT_IN) */
    values?: (string | number)[];
}

/**
 * Interface for a compound condition that combines multiple conditions.
 */
export interface CompoundCondition {
    /** All conditions must be true (AND) */
    all?: StepCondition[];
    /** At least one condition must be true (OR) */
    any?: StepCondition[];
}

/**
 * A step condition can be either a simple condition or a compound condition.
 */
export type StepCondition = SimpleCondition | CompoundCondition;
