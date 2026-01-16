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

// =============================================================================
// SCORING RULES - For questionnaire question scoring
// =============================================================================

/**
 * A single scoring rule that defines a condition and its associated score.
 * Used in QuestionnairePlanQuestion.scoringRules to score answers.
 *
 * Example:
 * ```typescript
 * // Score 100 if age <= 55
 * { operator: ConditionOperator.LESS_THAN_OR_EQUAL, value: 55, score: 100 }
 *
 * // Score 80 if income >= 2000000
 * { operator: ConditionOperator.GREATER_THAN_OR_EQUAL, value: 2000000, score: 80 }
 *
 * // Score 10 if married is true
 * { operator: ConditionOperator.EQUALS, value: true, score: 10 }
 *
 * // Score 100 if employment_status is "employed"
 * { operator: ConditionOperator.EQUALS, value: "employed", score: 100 }
 * ```
 */
export interface ScoringRule {
    /** The comparison operator for the condition */
    operator: ConditionOperator;
    /** The value to compare against (number for numeric comparisons, boolean/string for EQUALS/NOT_EQUALS) */
    value: number | boolean | string;
    /** The score to assign if the condition is met */
    score: number;
}

/**
 * Array of scoring rules evaluated in order.
 * First matching rule's score is used.
 * Rules should be ordered from most to least restrictive.
 *
 * Example:
 * ```typescript
 * // Income scoring: first match wins
 * [
 *   { operator: ConditionOperator.GREATER_THAN_OR_EQUAL, value: 3000000, score: 100 },
 *   { operator: ConditionOperator.GREATER_THAN_OR_EQUAL, value: 2000000, score: 80 },
 *   { operator: ConditionOperator.GREATER_THAN_OR_EQUAL, value: 1000000, score: 50 },
 *   { operator: ConditionOperator.LESS_THAN, value: 1000000, score: 0 },
 * ]
 * ```
 */
export type ScoringRules = ScoringRule[];
