/**
 * Condition operators for evaluating step conditions against questionnaire answers.
 * Used in DocumentationPlanStep.condition to conditionally require documents
 * based on prequalification answers.
 */

/**
 * Supported condition operators for evaluating document step conditions.
 */
export const CONDITION_OPERATORS = {
    /** Value equals the specified value */
    EQUALS: 'EQUALS',
    /** Value does not equal the specified value */
    NOT_EQUALS: 'NOT_EQUALS',
    /** Value is in the specified array of values */
    IN: 'IN',
    /** Value is not in the specified array of values */
    NOT_IN: 'NOT_IN',
    /** Numeric value is greater than the specified value */
    GREATER_THAN: 'GREATER_THAN',
    /** Numeric value is less than the specified value */
    LESS_THAN: 'LESS_THAN',
    /** Value exists (is not null/undefined) */
    EXISTS: 'EXISTS',
} as const;

/**
 * Type representing a valid condition operator.
 */
export type ConditionOperator = keyof typeof CONDITION_OPERATORS;

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
