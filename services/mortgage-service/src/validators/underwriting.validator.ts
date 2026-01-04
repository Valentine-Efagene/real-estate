import { z } from 'zod';

// ============== Underwriting Request ==============

export const UnderwritingRequestSchema = z.object({
    prequalificationId: z.string().cuid(),
});

export type UnderwritingRequest = z.infer<typeof UnderwritingRequestSchema>;

// ============== Underwriting Condition ==============

export const UnderwritingConditionSchema = z.object({
    code: z.string(),
    message: z.string().optional(),
    field: z.string().optional(),
    required: z.boolean().default(true),
});

export type UnderwritingCondition = z.infer<typeof UnderwritingConditionSchema>;

// ============== Rule Result ==============

export const RuleResultSchema = z.object({
    ruleId: z.string(),
    ruleName: z.string(),
    passed: z.boolean(),
    score: z.number().optional(),
    weight: z.number().optional(),
    message: z.string().optional(),
});

export type RuleResult = z.infer<typeof RuleResultSchema>;

// ============== Underwriting Response ==============

export const UnderwritingResponseSchema = z.object({
    decisionId: z.string(),
    prequalificationId: z.string(),
    decision: z.enum(['APPROVE', 'REJECT', 'CONDITIONAL']),
    score: z.number().nullable(),
    reasons: z.array(z.string()).optional(),
    conditions: z.array(UnderwritingConditionSchema).optional(),
    rulesVersion: z.string(),
    ruleResults: z.array(RuleResultSchema).optional(),
    evaluatedAt: z.string(),
});

export type UnderwritingResponse = z.infer<typeof UnderwritingResponseSchema>;

// ============== Manual Review Request ==============

export const ManualReviewRequestSchema = z.object({
    decisionId: z.string().cuid(),
    decision: z.enum(['APPROVE', 'REJECT', 'CONDITIONAL']),
    notes: z.string().optional(),
    conditions: z.array(UnderwritingConditionSchema).optional(),
});

export type ManualReviewRequest = z.infer<typeof ManualReviewRequestSchema>;
