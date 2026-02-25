import {
    Prisma,
    PrismaClient,
    NotificationType,
} from '@valentine-efagene/qshelter-common';
import { enqueueOutboxInTx, publishAfterCommit } from '../lib/outbox';
import {
    UnderwritingResponse,
    UnderwritingCondition,
    RuleResult,
} from '../validators/underwriting.validator';

const RULES_VERSION = '1.0.0';

// ============== Rule Definitions ==============

interface RuleContext {
    questionnaire: {
        underwritingScore: number | null;
        monthlyIncome: number | null;
        monthlyExpenses: number | null;
        debtToIncomeRatio: number | null;
        preApprovalAnswers: Record<string, unknown> | null;
    };
    application: {
        totalAmount: number;
    };
    property: {
        price: number;
        name: string;
    };
    user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
    };
}

interface Rule {
    id: string;
    name: string;
    weight: number;
    evaluate: (ctx: RuleContext) => { passed: boolean; score: number; message?: string };
}

// ============== Rule Engine ==============

const rules: Rule[] = [
    {
        id: 'MIN_SCORE',
        name: 'Minimum Eligibility Score',
        weight: 30,
        evaluate: (ctx) => {
            const score = ctx.questionnaire.underwritingScore ?? 0;
            if (score >= 70) return { passed: true, score: 100, message: 'Excellent eligibility score' };
            if (score >= 50) return { passed: true, score: 70, message: 'Acceptable eligibility score' };
            if (score >= 30) return { passed: false, score: 40, message: 'Below minimum eligibility score' };
            return { passed: false, score: 0, message: 'Very low eligibility score' };
        },
    },
    {
        id: 'DTI_RATIO',
        name: 'Debt-to-Income Ratio',
        weight: 25,
        evaluate: (ctx) => {
            const dti = ctx.questionnaire.debtToIncomeRatio;
            if (dti === null) return { passed: true, score: 50, message: 'DTI not calculated' };
            if (dti <= 0.3) return { passed: true, score: 100, message: 'Excellent DTI ratio' };
            if (dti <= 0.4) return { passed: true, score: 80, message: 'Good DTI ratio' };
            if (dti <= 0.5) return { passed: true, score: 60, message: 'Acceptable DTI ratio' };
            return { passed: false, score: 20, message: 'DTI ratio too high' };
        },
    },
    {
        id: 'INCOME_COVERAGE',
        name: 'Income Coverage',
        weight: 25,
        evaluate: (ctx) => {
            const income = ctx.questionnaire.monthlyIncome ?? 0;
            const expenses = ctx.questionnaire.monthlyExpenses ?? 0;
            const totalAmount = ctx.application.totalAmount;

            // Estimate monthly payment (simple: amount / 120 months)
            const estimatedMonthlyPayment = totalAmount / 120;
            const disposableIncome = income - expenses;

            if (disposableIncome <= 0) {
                return { passed: false, score: 0, message: 'No disposable income' };
            }

            const paymentToDisposable = estimatedMonthlyPayment / disposableIncome;
            if (paymentToDisposable <= 0.3) return { passed: true, score: 100, message: 'Excellent income coverage' };
            if (paymentToDisposable <= 0.5) return { passed: true, score: 70, message: 'Acceptable income coverage' };
            return { passed: false, score: 30, message: 'Insufficient income coverage' };
        },
    },
    {
        id: 'LOAN_TO_VALUE',
        name: 'Loan-to-Value Ratio',
        weight: 20,
        evaluate: (ctx) => {
            const requestedAmount = ctx.application.totalAmount;
            const propertyPrice = ctx.property.price;

            if (propertyPrice <= 0) return { passed: true, score: 50, message: 'Property price not set' };

            const ltv = requestedAmount / propertyPrice;
            if (ltv <= 0.7) return { passed: true, score: 100, message: 'Low LTV - good equity' };
            if (ltv <= 0.8) return { passed: true, score: 80, message: 'Acceptable LTV' };
            if (ltv <= 0.9) return { passed: true, score: 60, message: 'High LTV - may require PMI' };
            return { passed: false, score: 20, message: 'LTV too high' };
        },
    },
];

function runRules(ctx: RuleContext): { score: number; results: RuleResult[]; allPassed: boolean } {
    const results: RuleResult[] = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;
    let allPassed = true;

    for (const rule of rules) {
        const result = rule.evaluate(ctx);
        results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            passed: result.passed,
            score: result.score,
            weight: rule.weight,
            message: result.message,
        });

        totalWeightedScore += result.score * rule.weight;
        totalWeight += rule.weight;

        if (!result.passed) {
            allPassed = false;
        }
    }

    const finalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    return { score: Math.round(finalScore * 100) / 100, results, allPassed };
}

function determineDecision(
    score: number,
    allPassed: boolean,
    results: RuleResult[]
): { decision: 'APPROVED' | 'DECLINED' | 'CONDITIONAL'; reasons: string[]; conditions: UnderwritingCondition[] } {
    const reasons: string[] = [];
    const conditions: UnderwritingCondition[] = [];

    // Collect failure reasons
    for (const r of results) {
        if (!r.passed && r.message) {
            reasons.push(r.message);
        }
    }

    if (allPassed && score >= 70) {
        return { decision: 'APPROVED', reasons: ['All eligibility criteria met'], conditions: [] };
    }

    if (score < 40) {
        return { decision: 'DECLINED', reasons, conditions: [] };
    }

    // Conditional approval — add conditions based on failed rules
    for (const r of results) {
        if (!r.passed) {
            if (r.ruleId === 'DTI_RATIO') {
                conditions.push({
                    code: 'REDUCE_DTI',
                    message: 'Reduce debt-to-income ratio below 50%',
                    field: 'debtToIncomeRatio',
                    required: true,
                });
            }
            if (r.ruleId === 'INCOME_COVERAGE') {
                conditions.push({
                    code: 'INCOME_DOCS',
                    message: 'Provide additional income documentation',
                    field: 'monthlyIncome',
                    required: true,
                });
            }
            if (r.ruleId === 'LOAN_TO_VALUE') {
                conditions.push({
                    code: 'INCREASE_DOWN_PAYMENT',
                    message: 'Increase down payment to reduce LTV below 90%',
                    field: 'totalAmount',
                    required: true,
                });
            }
            if (r.ruleId === 'MIN_SCORE') {
                conditions.push({
                    code: 'COMPLETE_QUESTIONNAIRE',
                    message: 'Complete all eligibility questions',
                    field: 'preApprovalAnswers',
                    required: true,
                });
            }
        }
    }

    return { decision: 'CONDITIONAL', reasons, conditions };
}

// ============== Underwriting Service ==============

export class UnderwritingService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Helper to extract numeric field values from questionnaire fields
     */
    private extractFieldValue(fields: Array<{ name: string; answer: unknown }>, fieldName: string): number | null {
        const field = fields.find(f => f.name === fieldName);
        if (!field || field.answer === null || field.answer === undefined) return null;
        const value = typeof field.answer === 'number' ? field.answer : Number(field.answer);
        return isNaN(value) ? null : value;
    }

    /**
     * Helper to convert questionnaire fields to a key-value object
     */
    private fieldsToAnswers(fields: Array<{ name: string; answer: unknown }>): Record<string, unknown> {
        const answers: Record<string, unknown> = {};
        for (const field of fields) {
            answers[field.name] = field.answer;
        }
        return answers;
    }

    /**
     * Evaluate a application's underwriting step.
     * 
     * @deprecated Steps have been removed. Use evaluateForApplication instead.
     */
    async evaluateForStep(
        _applicationId: string,
        _stepId: string,
        _actorId?: string
    ): Promise<UnderwritingResponse> {
        throw new Error(
            'evaluateForStep is deprecated. Steps have been removed. Use evaluateForApplication instead.'
        );
    }

    /**
     * Evaluate underwriting for an application.
     * 
     * Underwriting data comes from QuestionnairePhase fields.
     * Results are stored in the QuestionnairePhase.
     * 
     * @param applicationId - The application to evaluate
     * @param actorId - The user triggering the evaluation
     */
    async evaluateForApplication(
        applicationId: string,
        actorId?: string
    ): Promise<UnderwritingResponse> {
        // Fetch application with related data including questionnaire phases
        const application = await this.prisma.application.findUnique({
            where: { id: applicationId },
            include: {
                buyer: true,
                propertyUnit: {
                    include: {
                        variant: {
                            include: { property: true },
                        },
                    },
                },
                phases: {
                    where: { phaseCategory: 'QUESTIONNAIRE' },
                    include: {
                        questionnairePhase: {
                            include: { fields: true },
                        },
                    },
                    orderBy: { order: 'desc' },
                },
                tenant: true,
            },
        });

        if (!application) {
            throw new Error(`application ${applicationId} not found`);
        }

        // Find the most recent questionnaire phase with underwriting data
        const questionnairePhase = application.phases
            .find((p: { questionnairePhase?: { fields?: unknown[] } | null }) =>
                p.questionnairePhase?.fields && p.questionnairePhase.fields.length > 0
            )
            ?.questionnairePhase;

        const fields = questionnairePhase?.fields ?? [];

        // Extract financial data from questionnaire fields
        const monthlyIncome = this.extractFieldValue(fields as Array<{ name: string; answer: unknown }>, 'monthly_income');
        const monthlyExpenses = this.extractFieldValue(fields as Array<{ name: string; answer: unknown }>, 'monthly_expenses');
        const existingDti = questionnairePhase?.debtToIncomeRatio ?? null;
        const existingScore = questionnairePhase?.underwritingScore ?? null;

        // Build rule context
        const propertyPrice = application.propertyUnit?.variant?.price ?? application.totalAmount;
        const propertyName = application.propertyUnit?.variant?.property?.title ?? 'Unknown Property';

        const ctx: RuleContext = {
            questionnaire: {
                underwritingScore: existingScore,
                monthlyIncome,
                monthlyExpenses,
                debtToIncomeRatio: existingDti,
                preApprovalAnswers: this.fieldsToAnswers(fields as Array<{ name: string; answer: unknown }>),
            },
            application: {
                totalAmount: application.totalAmount,
            },
            property: {
                price: propertyPrice,
                name: propertyName,
            },
            user: {
                id: application.buyer.id,
                email: application.buyer.email,
                firstName: application.buyer.firstName,
                lastName: application.buyer.lastName,
            },
        };

        // Run rules
        const { score, results, allPassed } = runRules(ctx);
        const { decision, reasons, conditions } = determineDecision(score, allPassed, results);

        // Calculate DTI if not already set
        let calculatedDti = existingDti;
        if (calculatedDti === null && monthlyIncome && monthlyIncome > 0) {
            // Estimate monthly payment (120 months default)
            const monthlyPayment = application.totalAmount / 120;
            calculatedDti = ((monthlyExpenses ?? 0) + monthlyPayment) / monthlyIncome;
        }

        // Update questionnaire phase in transaction
        const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Store underwriting results in the QuestionnairePhase
            if (questionnairePhase) {
                await tx.questionnairePhase.update({
                    where: { id: questionnairePhase.id },
                    data: {
                        underwritingScore: score,
                        debtToIncomeRatio: calculatedDti,
                        underwritingDecision: decision,
                        underwritingNotes: JSON.stringify({
                            applicationId,
                            reasons,
                            conditions,
                            ruleResults: results,
                            rulesVersion: RULES_VERSION,
                            evaluatedAt: new Date().toISOString(),
                        }),
                    },
                });
            }

            // Determine notification type
            const notificationType =
                decision === 'APPROVED'
                    ? NotificationType.UNDERWRITING_APPROVED
                    : decision === 'DECLINED'
                        ? NotificationType.UNDERWRITING_REJECTED
                        : NotificationType.UNDERWRITING_CONDITIONAL;

            // Enqueue domain event for notification
            const outboxId = await enqueueOutboxInTx(tx, {
                tenantId: application.tenantId,
                eventType: notificationType,
                aggregateType: 'application',
                aggregateId: applicationId,
                queueName: 'qshelter-notifications',
                payload: {
                    applicationId,
                    decision,
                    score,
                    reasons,
                    conditions,
                    user: {
                        id: ctx.user.id,
                        email: ctx.user.email,
                        firstName: ctx.user.firstName,
                        lastName: ctx.user.lastName,
                    },
                    property: {
                        name: ctx.property.name,
                        price: ctx.property.price,
                    },
                    evaluatedAt: new Date().toISOString(),
                },
                actorId,
                actorRole: 'system',
            });

            return { outboxId };
        });

        // Attempt immediate publish (best-effort)
        await publishAfterCommit(this.prisma, result.outboxId);

        return {
            decisionId: applicationId, // Use application ID as decision ID
            applicationId,
            decision,
            score,
            reasons,
            conditions,
            rulesVersion: RULES_VERSION,
            ruleResults: results,
            evaluatedAt: new Date().toISOString(),
        };
    }

    /**
     * Get underwriting results for a application step
     * 
     * @deprecated Steps have been removed. Use getByApplicationId instead.
     */
    async getByStepId(_stepId: string): Promise<UnderwritingResponse | null> {
        throw new Error(
            'getByStepId is deprecated. Steps have been removed. Use getByApplicationId instead.'
        );
    }

    /**
     * Get all underwriting evaluations for a application
     * 
     * Returns underwriting results from QuestionnairePhases.
     */
    async getByApplicationId(applicationId: string): Promise<UnderwritingResponse[]> {
        // Find all QuestionnairePhases with underwriting results
        const phases = await this.prisma.questionnairePhase.findMany({
            where: {
                phase: { applicationId },
                underwritingScore: { not: null },
            },
            include: {
                phase: true,
            },
            orderBy: { updatedAt: 'desc' },
        });

        return phases.map((qp) => {
            const notes = qp.underwritingNotes ? JSON.parse(qp.underwritingNotes) : {};
            return {
                decisionId: notes.stepId || qp.id,
                applicationId,
                decision: (qp.underwritingDecision as 'APPROVED' | 'DECLINED' | 'CONDITIONAL') || 'CONDITIONAL',
                score: qp.underwritingScore ?? 0,
                reasons: notes.reasons || [],
                conditions: notes.conditions || [],
                rulesVersion: notes.rulesVersion || RULES_VERSION,
                ruleResults: notes.ruleResults || [],
                evaluatedAt: notes.evaluatedAt || qp.updatedAt.toISOString(),
            };
        });
    }
}
