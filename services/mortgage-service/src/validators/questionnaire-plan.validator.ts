import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

const ConditionOperatorEnum = z.enum([
    'EQUALS',
    'NOT_EQUALS',
    'IN',
    'NOT_IN',
    'GREATER_THAN',
    'LESS_THAN',
    'GREATER_THAN_OR_EQUAL',
    'LESS_THAN_OR_EQUAL',
    'EXISTS',
    'NOT_EXISTS',
]);

// Condition schemas for showIf (matches condition-evaluator.service.ts Condition type)
// Simple condition: { questionKey, operator, value } or { questionKey, operator, values }
const SimpleConditionSchema = z.object({
    questionKey: z.string(),
    operator: ConditionOperatorEnum,
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    values: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
}).openapi({
    example: { questionKey: 'employment_status', operator: 'EQUALS', value: 'EMPLOYED' },
    description: 'Simple condition: compare a question answer using an operator',
});

// Compound condition: { all?: Condition[], any?: Condition[] }
// Use z.lazy for self-referential recursion
type ShowIfCondition =
    | { questionKey: string; operator: string; value?: unknown; values?: unknown[] }
    | { all?: ShowIfCondition[]; any?: ShowIfCondition[] };

const ShowIfSchema: z.ZodType<ShowIfCondition> = z.lazy(() =>
    z.union([
        SimpleConditionSchema,
        z.object({
            all: z.array(ShowIfSchema).optional(),
            any: z.array(ShowIfSchema).optional(),
        }),
    ])
).openapi({
    example: {
        any: [
            { questionKey: 'joint_mortgage', operator: 'EQUALS', value: 'YES' },
            {
                all: [
                    { questionKey: 'employment_status', operator: 'EQUALS', value: 'EMPLOYED' },
                    { questionKey: 'annual_income', operator: 'GREATER_THAN_OR_EQUAL', value: 1000000 },
                ]
            },
        ],
    },
    description: 'Conditional display logic. Supports simple conditions (questionKey + operator + value) and compound AND/OR logic ({ all: [...] } / { any: [...] })',
});

// New array-based scoring rule schema
const ScoringRuleSchema = z.object({
    operator: ConditionOperatorEnum.openapi({
        example: 'GREATER_THAN_OR_EQUAL',
        description: 'The comparison operator',
    }),
    value: z.union([z.number(), z.boolean(), z.string()]).openapi({
        example: 3000000,
        description: 'The value to compare against (number for numeric comparisons, boolean/string for EQUALS/NOT_EQUALS)',
    }),
    score: z.number().openapi({
        example: 100,
        description: 'The score to assign if the condition is met',
    }),
});

// Scoring rules: array of condition-based rules
const ScoringRulesSchema = z.array(ScoringRuleSchema).openapi({
    example: [
        { operator: 'GREATER_THAN_OR_EQUAL', value: 3000000, score: 100 },
        { operator: 'EQUALS', value: true, score: 10 },
        { operator: 'EQUALS', value: 'employed', score: 100 },
    ],
    description: 'Scoring rules - array of {operator, value, score}. First matching rule wins. Supports number, boolean, and string values.',
});

// Enums matching Prisma schema
export const QuestionTypeEnum = z.enum([
    'TEXT',
    'NUMBER',
    'CURRENCY',
    'DATE',
    'SELECT',
    'MULTI_SELECT',
    'RADIO',
    'CHECKBOX',
    'FILE_UPLOAD',
    'PHONE',
    'EMAIL',
    'ADDRESS',
    'PERCENTAGE',
    'YEARS_MONTHS',
]);

export const ScoringStrategyEnum = z.enum([
    'SUM',
    'AVERAGE',
    'WEIGHTED_SUM',
    'MIN_ALL',
    'CUSTOM',
]);

export const QuestionnaireCategoryEnum = z.enum([
    'PREQUALIFICATION',
    'AFFORDABILITY',
    'PROPERTY_INTENT',
    'RISK_ASSESSMENT',
    'COMPLIANCE',
    'CUSTOM',
]);

// Category for individual questions within a questionnaire
export const QuestionCategoryEnum = z.enum([
    'ELIGIBILITY',
    'EMPLOYMENT',
    'INCOME',
    'AFFORDABILITY',
    'EXPENSES',
    'APPLICATION_TYPE',
    'PERSONAL',
    'PREFERENCES',
    'PROPERTY',
    'CREDIT',
    'ASSETS',
    'CUSTOM',
]);

// Question schema for questionnaire plans
export const QuestionnairePlanQuestionSchema = z.object({
    questionKey: z.string().min(1).max(100).openapi({
        example: 'annual_income',
        description: 'Unique identifier for this question',
    }),
    questionText: z.string().min(1).openapi({
        example: 'What is your annual gross income?',
        description: 'The question text displayed to users',
    }),
    helpText: z.string().optional().openapi({
        example: 'Include salary, bonuses, and other regular income',
        description: 'Optional help text/tooltip',
    }),
    questionType: QuestionTypeEnum.openapi({ example: 'CURRENCY' }),
    order: z.number().int().min(1).openapi({ example: 1 }),
    isRequired: z.boolean().default(true),
    validationRules: z.object({
        min: z.number().optional(),
        max: z.number().optional(),
        pattern: z.string().optional(),
        message: z.string().optional(),
    }).optional().openapi({
        example: { min: 0, max: 10000000 },
        description: 'Validation rules for the answer',
    }),
    options: z.array(z.object({
        value: z.string(),
        label: z.string(),
        score: z.number().optional(),
    })).optional().openapi({
        example: [
            { value: 'employed', label: 'Employed', score: 10 },
            { value: 'self_employed', label: 'Self-Employed', score: 7 },
            { value: 'retired', label: 'Retired', score: 5 },
        ],
        description: 'Options for SELECT/MULTI_SELECT/RADIO questions',
    }),
    scoreWeight: z.number().int().min(0).default(1).openapi({
        example: 2,
        description: 'Weight multiplier for scoring',
    }),
    scoringRules: ScoringRulesSchema.optional(),
    showIf: ShowIfSchema.optional().openapi({
        example: { questionKey: 'joint_mortgage', operator: 'EQUALS', value: 'YES' },
        description: 'Conditional display logic. Supports simple conditions ({ questionKey, operator, value }) and compound AND/OR ({ all: [...] } / { any: [...] })',
    }),
    category: QuestionCategoryEnum.optional().openapi({
        example: 'INCOME',
        description: 'Category for grouping questions (e.g., ELIGIBILITY, EMPLOYMENT, INCOME, AFFORDABILITY)',
    }),
}).openapi('QuestionnairePlanQuestion');

// Create questionnaire plan input schema
export const CreateQuestionnairePlanSchema = z.object({
    name: z.string().min(1).max(100).openapi({
        example: 'Prequalification Form',
        description: 'Name of the questionnaire plan',
    }),
    description: z.string().optional().openapi({
        example: 'Initial prequalification questionnaire for mortgage applicants',
    }),
    isActive: z.boolean().default(true),
    passingScore: z.number().int().min(0).optional().openapi({
        example: 70,
        description: 'Minimum score to pass (null = no auto-scoring)',
    }),
    scoringStrategy: ScoringStrategyEnum.default('SUM').openapi({
        example: 'SUM',
        description: 'How to calculate the total score',
    }),
    autoDecisionEnabled: z.boolean().default(false).openapi({
        example: true,
        description: 'Whether to auto-pass/fail based on score',
    }),
    estimatedMinutes: z.number().int().min(1).optional().openapi({
        example: 15,
        description: 'Estimated time to complete in minutes',
    }),
    category: QuestionnaireCategoryEnum.default('PREQUALIFICATION').openapi({
        example: 'PREQUALIFICATION',
        description: 'Category of questionnaire',
    }),
    questions: z.array(QuestionnairePlanQuestionSchema).min(1).openapi({
        description: 'Questions in this questionnaire plan',
    }),
}).openapi('CreateQuestionnairePlanInput');

export type CreateQuestionnairePlanInput = z.infer<typeof CreateQuestionnairePlanSchema>;

// Update questionnaire plan input schema
export const UpdateQuestionnairePlanSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    passingScore: z.number().int().min(0).nullable().optional(),
    scoringStrategy: ScoringStrategyEnum.optional(),
    autoDecisionEnabled: z.boolean().optional(),
    estimatedMinutes: z.number().int().min(1).nullable().optional(),
    category: QuestionnaireCategoryEnum.optional(),
}).openapi('UpdateQuestionnairePlanInput');

export type UpdateQuestionnairePlanInput = z.infer<typeof UpdateQuestionnairePlanSchema>;

// Add question to plan schema
export const AddQuestionToPlanSchema = QuestionnairePlanQuestionSchema.openapi('AddQuestionToPlanInput');

export type AddQuestionToPlanInput = z.infer<typeof AddQuestionToPlanSchema>;

// Scoring calculation input
export const CalculateScoreSchema = z.object({
    answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).openapi({
        example: { annual_income: 75000, employment_status: 'employed' },
        description: 'Map of questionKey to answer value',
    }),
}).openapi('CalculateScoreInput');

export type CalculateScoreInput = z.infer<typeof CalculateScoreSchema>;

// Score result
export const ScoreResultSchema = z.object({
    totalScore: z.number(),
    maxPossibleScore: z.number(),
    passed: z.boolean().nullable(),
    passingScore: z.number().nullable(),
    breakdown: z.array(z.object({
        questionKey: z.string(),
        score: z.number(),
        weight: z.number(),
        weightedScore: z.number(),
    })),
}).openapi('ScoreResult');

export type ScoreResult = z.infer<typeof ScoreResultSchema>;
