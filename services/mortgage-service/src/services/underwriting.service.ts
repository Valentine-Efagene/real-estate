import {
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
    contract: {
        underwritingScore: number | null;
        monthlyIncome: number | null;
        monthlyExpenses: number | null;
        debtToIncomeRatio: number | null;
        totalAmount: number;
        preApprovalAnswers: any | null;
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
            const score = ctx.contract.underwritingScore ?? 0;
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
            const dti = ctx.contract.debtToIncomeRatio;
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
            const income = ctx.contract.monthlyIncome ?? 0;
            const expenses = ctx.contract.monthlyExpenses ?? 0;
            const totalAmount = ctx.contract.totalAmount;

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
            const requestedAmount = ctx.contract.totalAmount;
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
     * Evaluate a contract's underwriting step.
     * Called when an UNDERWRITING step is being completed.
     * 
     * @param contractId - The contract to evaluate
     * @param stepId - The UNDERWRITING step being completed
     * @param actorId - The user triggering the evaluation
     */
    async evaluateForStep(
        contractId: string,
        stepId: string,
        actorId?: string
    ): Promise<UnderwritingResponse> {
        // Fetch contract with related data
        const contract = await this.prisma.contract.findUnique({
            where: { id: contractId },
            include: {
                buyer: true,
                propertyUnit: {
                    include: {
                        variant: {
                            include: { property: true },
                        },
                    },
                },
                tenant: true,
            },
        });

        if (!contract) {
            throw new Error(`Contract ${contractId} not found`);
        }

        const step = await this.prisma.documentationStep.findUnique({
            where: { id: stepId },
        });

        if (!step) {
            throw new Error(`Step ${stepId} not found`);
        }

        if (step.stepType !== 'UNDERWRITING') {
            throw new Error(`Step ${stepId} is not an UNDERWRITING step`);
        }

        // Build rule context from contract data
        const propertyPrice = contract.propertyUnit?.variant?.price ?? contract.totalAmount;
        const propertyName = contract.propertyUnit?.variant?.property?.title ?? 'Unknown Property';

        const ctx: RuleContext = {
            contract: {
                underwritingScore: contract.underwritingScore,
                monthlyIncome: contract.monthlyIncome,
                monthlyExpenses: contract.monthlyExpenses,
                debtToIncomeRatio: contract.debtToIncomeRatio,
                totalAmount: contract.totalAmount,
                preApprovalAnswers: contract.preApprovalAnswers,
            },
            property: {
                price: propertyPrice,
                name: propertyName,
            },
            user: {
                id: contract.buyer.id,
                email: contract.buyer.email,
                firstName: contract.buyer.firstName,
                lastName: contract.buyer.lastName,
            },
        };

        // Run rules
        const { score, results, allPassed } = runRules(ctx);
        const { decision, reasons, conditions } = determineDecision(score, allPassed, results);

        // Calculate DTI if not already set
        let calculatedDti = contract.debtToIncomeRatio;
        if (calculatedDti === null && contract.monthlyIncome && contract.monthlyIncome > 0) {
            const monthlyPayment = contract.totalAmount / (contract.termMonths || 120);
            calculatedDti = ((contract.monthlyExpenses ?? 0) + monthlyPayment) / contract.monthlyIncome;
        }

        // Update step and contract in transaction
        const result = await this.prisma.$transaction(async (tx: any) => {
            // Update the UNDERWRITING step with results
            await tx.documentationStep.update({
                where: { id: stepId },
                data: {
                    underwritingScore: score,
                    debtToIncomeRatio: calculatedDti,
                    underwritingDecision: decision,
                    underwritingNotes: JSON.stringify({
                        reasons,
                        conditions,
                        ruleResults: results,
                        rulesVersion: RULES_VERSION,
                    }),
                    status: 'COMPLETED',
                    completedAt: new Date(),
                },
            });

            // Update contract with underwriting results
            await tx.contract.update({
                where: { id: contractId },
                data: {
                    underwritingScore: score,
                    debtToIncomeRatio: calculatedDti,
                },
            });

            // Record contract event
            await tx.contractEvent.create({
                data: {
                    contractId,
                    eventType: 'UNDERWRITING.COMPLETED',
                    eventGroup: 'DOCUMENT',
                    data: {
                        stepId,
                        decision,
                        score,
                        reasons,
                        conditions,
                    },
                    actorId,
                    actorType: actorId ? 'USER' : 'SYSTEM',
                },
            });

            // Determine notification type
            const notificationType =
                decision === 'APPROVED'
                    ? NotificationType.UNDERWRITING_APPROVED
                    : decision === 'DECLINED'
                        ? NotificationType.UNDERWRITING_REJECTED
                        : NotificationType.UNDERWRITING_CONDITIONAL;

            // Enqueue domain event for notification
            const outboxId = await enqueueOutboxInTx(tx, {
                eventType: notificationType,
                aggregateType: 'Contract',
                aggregateId: contractId,
                queueName: 'qshelter-notifications',
                payload: {
                    contractId,
                    stepId,
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
            decisionId: stepId, // Use step ID as decision ID
            contractId,
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
     * Get underwriting results for a contract step
     */
    async getByStepId(stepId: string): Promise<UnderwritingResponse | null> {
        const step = await this.prisma.documentationStep.findUnique({
            where: { id: stepId },
            include: {
                phase: {
                    include: { contract: true },
                },
            },
        });

        if (!step || step.stepType !== 'UNDERWRITING') return null;

        const notes = step.underwritingNotes ? JSON.parse(step.underwritingNotes) : {};

        return {
            decisionId: step.id,
            contractId: step.phase.contractId,
            decision: (step.underwritingDecision as 'APPROVED' | 'DECLINED' | 'CONDITIONAL') || 'CONDITIONAL',
            score: step.underwritingScore ?? 0,
            reasons: notes.reasons || [],
            conditions: notes.conditions || [],
            rulesVersion: notes.rulesVersion || RULES_VERSION,
            ruleResults: notes.ruleResults || [],
            evaluatedAt: step.completedAt?.toISOString() || step.createdAt.toISOString(),
        };
    }

    /**
     * Get all underwriting steps for a contract
     */
    async getByContractId(contractId: string): Promise<UnderwritingResponse[]> {
        const steps = await this.prisma.documentationStep.findMany({
            where: {
                stepType: 'UNDERWRITING',
                phase: { contractId },
            },
            include: {
                phase: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return steps.map((step) => {
            const notes = step.underwritingNotes ? JSON.parse(step.underwritingNotes) : {};
            return {
                decisionId: step.id,
                contractId,
                decision: (step.underwritingDecision as 'APPROVED' | 'DECLINED' | 'CONDITIONAL') || 'CONDITIONAL',
                score: step.underwritingScore ?? 0,
                reasons: notes.reasons || [],
                conditions: notes.conditions || [],
                rulesVersion: notes.rulesVersion || RULES_VERSION,
                ruleResults: notes.ruleResults || [],
                evaluatedAt: step.completedAt?.toISOString() || step.createdAt.toISOString(),
            };
        });
    }
}
