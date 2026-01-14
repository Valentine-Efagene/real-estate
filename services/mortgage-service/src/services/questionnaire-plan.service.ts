import { prisma as defaultPrisma } from '../lib/prisma';
import { AppError, PrismaClient } from '@valentine-efagene/qshelter-common';
import type {
    CreateQuestionnairePlanInput,
    UpdateQuestionnairePlanInput,
    AddQuestionToPlanInput,
    CalculateScoreInput,
    ScoreResult,
} from '../validators/questionnaire-plan.validator';

type AnyPrismaClient = PrismaClient;

/**
 * QuestionnairePlanService interface
 */
export interface QuestionnairePlanService {
    create(tenantId: string | null, data: CreateQuestionnairePlanInput): Promise<any>;
    findAll(filters?: { isActive?: boolean; category?: string }): Promise<any[]>;
    findById(id: string): Promise<any>;
    findByName(tenantId: string | null, name: string, version?: number): Promise<any>;
    update(id: string, data: UpdateQuestionnairePlanInput): Promise<any>;
    delete(id: string): Promise<{ success: boolean }>;
    clone(id: string, newName: string, incrementVersion?: boolean): Promise<any>;
    addQuestion(planId: string, data: AddQuestionToPlanInput): Promise<any>;
    removeQuestion(planId: string, questionId: string): Promise<{ success: boolean }>;
    updateQuestion(planId: string, questionId: string, data: Partial<AddQuestionToPlanInput>): Promise<any>;
    calculateScore(planId: string, input: CalculateScoreInput): Promise<ScoreResult>;
}

/**
 * Create a questionnaire plan service with the given Prisma client.
 * Use this for tenant-scoped operations.
 */
export function createQuestionnairePlanService(prisma: AnyPrismaClient = defaultPrisma): QuestionnairePlanService {
    async function create(tenantId: string | null, data: CreateQuestionnairePlanInput) {
        // Validate questions have unique orders and keys
        const orders = data.questions.map(q => q.order);
        if (new Set(orders).size !== orders.length) {
            throw new AppError(400, 'Question orders must be unique');
        }

        const keys = data.questions.map(q => q.questionKey);
        if (new Set(keys).size !== keys.length) {
            throw new AppError(400, 'Question keys must be unique');
        }

        const plan = await prisma.questionnairePlan.create({
            data: {
                tenantId,
                name: data.name,
                description: data.description,
                isActive: data.isActive ?? true,
                passingScore: data.passingScore,
                scoringStrategy: data.scoringStrategy ?? 'SUM',
                autoDecisionEnabled: data.autoDecisionEnabled ?? false,
                estimatedMinutes: data.estimatedMinutes,
                category: data.category ?? 'PREQUALIFICATION',
                questions: {
                    create: data.questions.map(question => ({
                        questionKey: question.questionKey,
                        questionText: question.questionText,
                        helpText: question.helpText,
                        questionType: question.questionType,
                        order: question.order,
                        isRequired: question.isRequired ?? true,
                        validationRules: question.validationRules,
                        options: question.options,
                        scoreWeight: question.scoreWeight ?? 1,
                        scoringRules: question.scoringRules,
                        showIf: question.showIf,
                        category: question.category,
                    })),
                },
            },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        return plan;
    }

    async function findAll(filters?: { isActive?: boolean; category?: string }) {
        const where: any = {};
        if (filters?.isActive !== undefined) {
            where.isActive = filters.isActive;
        }
        if (filters?.category) {
            where.category = filters.category;
        }

        const plans = await prisma.questionnairePlan.findMany({
            where,
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: [{ name: 'asc' }, { version: 'desc' }],
        });
        return plans;
    }

    async function findById(id: string) {
        const plan = await prisma.questionnairePlan.findUnique({
            where: { id },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!plan) {
            throw new AppError(404, 'Questionnaire plan not found');
        }

        return plan;
    }

    async function findByName(tenantId: string | null, name: string, version?: number) {
        const where: any = {
            name,
        };

        if (tenantId === null) {
            where.tenantId = null;
        } else {
            where.tenantId = tenantId;
        }

        if (version !== undefined) {
            where.version = version;
        }

        const plans = await prisma.questionnairePlan.findMany({
            where,
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { version: 'desc' },
            take: version !== undefined ? 1 : undefined,
        });

        if (plans.length === 0) {
            return null;
        }

        // Return the latest version if no version specified
        return plans[0];
    }

    async function update(id: string, data: UpdateQuestionnairePlanInput) {
        await findById(id);

        const updated = await prisma.questionnairePlan.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                isActive: data.isActive,
                passingScore: data.passingScore,
                scoringStrategy: data.scoringStrategy,
                autoDecisionEnabled: data.autoDecisionEnabled,
                estimatedMinutes: data.estimatedMinutes,
                category: data.category,
            },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        return updated;
    }

    async function deleteById(id: string) {
        await findById(id);

        // Check if plan is in use by payment method phases
        const methodPhaseCount = await prisma.propertyPaymentMethodPhase.count({
            where: { questionnairePlanId: id },
        });

        if (methodPhaseCount > 0) {
            throw new AppError(400, `Cannot delete questionnaire plan: used by ${methodPhaseCount} payment method phase(s)`);
        }

        // Check if plan is in use by questionnaire phases
        const questionnairePhaseCount = await prisma.questionnairePhase.count({
            where: { questionnairePlanId: id },
        });

        if (questionnairePhaseCount > 0) {
            throw new AppError(400, `Cannot delete questionnaire plan: used by ${questionnairePhaseCount} questionnaire phase(s)`);
        }

        await prisma.questionnairePlan.delete({
            where: { id },
        });

        return { success: true };
    }

    async function clone(id: string, newName: string, incrementVersion = false) {
        const source = await findById(id);

        // If incrementing version, keep the same name but bump version
        const name = incrementVersion ? source.name : newName;
        const version = incrementVersion ? source.version + 1 : 1;

        const cloned = await prisma.questionnairePlan.create({
            data: {
                tenantId: source.tenantId,
                name,
                description: source.description,
                version,
                isActive: source.isActive,
                passingScore: source.passingScore,
                scoringStrategy: source.scoringStrategy,
                autoDecisionEnabled: source.autoDecisionEnabled,
                estimatedMinutes: source.estimatedMinutes,
                category: source.category,
                questions: {
                    create: source.questions.map((question: any) => ({
                        questionKey: question.questionKey,
                        questionText: question.questionText,
                        helpText: question.helpText,
                        questionType: question.questionType,
                        order: question.order,
                        isRequired: question.isRequired,
                        validationRules: question.validationRules,
                        options: question.options,
                        scoreWeight: question.scoreWeight,
                        scoringRules: question.scoringRules,
                        showIf: question.showIf,
                        category: question.category,
                    })),
                },
            },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        return cloned;
    }

    async function addQuestion(planId: string, data: AddQuestionToPlanInput) {
        await findById(planId);

        // Check for duplicate question key
        const existing = await prisma.questionnairePlanQuestion.findFirst({
            where: { questionnairePlanId: planId, questionKey: data.questionKey },
        });

        if (existing) {
            throw new AppError(400, `Question with key "${data.questionKey}" already exists in this plan`);
        }

        const question = await prisma.questionnairePlanQuestion.create({
            data: {
                questionnairePlanId: planId,
                questionKey: data.questionKey,
                questionText: data.questionText,
                helpText: data.helpText,
                questionType: data.questionType,
                order: data.order,
                isRequired: data.isRequired ?? true,
                validationRules: data.validationRules,
                options: data.options,
                scoreWeight: data.scoreWeight ?? 1,
                scoringRules: data.scoringRules,
                showIf: data.showIf,
                category: data.category,
            },
        });

        return question;
    }

    async function removeQuestion(planId: string, questionId: string) {
        await findById(planId);

        const question = await prisma.questionnairePlanQuestion.findUnique({
            where: { id: questionId },
        });

        if (!question || question.questionnairePlanId !== planId) {
            throw new AppError(404, 'Question not found in this plan');
        }

        await prisma.questionnairePlanQuestion.delete({
            where: { id: questionId },
        });

        return { success: true };
    }

    async function updateQuestion(planId: string, questionId: string, data: Partial<AddQuestionToPlanInput>) {
        await findById(planId);

        const question = await prisma.questionnairePlanQuestion.findUnique({
            where: { id: questionId },
        });

        if (!question || question.questionnairePlanId !== planId) {
            throw new AppError(404, 'Question not found in this plan');
        }

        // If changing key, check for duplicates
        if (data.questionKey && data.questionKey !== question.questionKey) {
            const existing = await prisma.questionnairePlanQuestion.findFirst({
                where: {
                    questionnairePlanId: planId,
                    questionKey: data.questionKey,
                    id: { not: questionId },
                },
            });
            if (existing) {
                throw new AppError(400, `Question with key "${data.questionKey}" already exists in this plan`);
            }
        }

        const updated = await prisma.questionnairePlanQuestion.update({
            where: { id: questionId },
            data: {
                questionKey: data.questionKey,
                questionText: data.questionText,
                helpText: data.helpText,
                questionType: data.questionType,
                order: data.order,
                isRequired: data.isRequired,
                validationRules: data.validationRules,
                options: data.options,
                scoreWeight: data.scoreWeight,
                scoringRules: data.scoringRules,
                showIf: data.showIf,
                category: data.category,
            },
        });

        return updated;
    }

    /**
     * Calculate score for given answers against a questionnaire plan
     */
    async function calculateScore(planId: string, input: CalculateScoreInput): Promise<ScoreResult> {
        const plan = await findById(planId);
        const { answers } = input;

        let totalScore = 0;
        let maxPossibleScore = 0;
        const breakdown: ScoreResult['breakdown'] = [];

        for (const question of plan.questions) {
            const answer = answers[question.questionKey];
            const weight = question.scoreWeight ?? 1;
            let score = 0;

            // Calculate score based on scoring rules
            if (question.scoringRules && answer !== undefined) {
                const rules = question.scoringRules as Record<string, number>;
                const answerKey = String(answer);

                if (rules[answerKey] !== undefined) {
                    score = rules[answerKey];
                } else if (typeof answer === 'number') {
                    // Check for range-based scoring
                    for (const [key, value] of Object.entries(rules)) {
                        if (key.startsWith('>=') && answer >= parseFloat(key.slice(2))) {
                            score = Math.max(score, value);
                        } else if (key.startsWith('<=') && answer <= parseFloat(key.slice(2))) {
                            score = Math.max(score, value);
                        } else if (key.startsWith('>') && answer > parseFloat(key.slice(1))) {
                            score = Math.max(score, value);
                        } else if (key.startsWith('<') && answer < parseFloat(key.slice(1))) {
                            score = Math.max(score, value);
                        }
                    }
                }
            } else if (question.options && answer !== undefined) {
                // Check options for score
                const options = question.options as Array<{ value: string; label: string; score?: number }>;
                const option = options.find(o => o.value === String(answer));
                if (option?.score !== undefined) {
                    score = option.score;
                }
            }

            // Calculate weighted score based on strategy
            const weightedScore = plan.scoringStrategy === 'WEIGHTED_SUM' ? score * weight : score;

            // Max possible score is the highest score in scoring rules or options
            let maxQuestionScore = 0;
            if (question.scoringRules) {
                const rules = question.scoringRules as Record<string, number>;
                maxQuestionScore = Math.max(...Object.values(rules), 0);
            } else if (question.options) {
                const options = question.options as Array<{ value: string; label: string; score?: number }>;
                maxQuestionScore = Math.max(...options.map(o => o.score ?? 0), 0);
            }
            const maxWeightedScore = plan.scoringStrategy === 'WEIGHTED_SUM' ? maxQuestionScore * weight : maxQuestionScore;

            totalScore += weightedScore;
            maxPossibleScore += maxWeightedScore;

            breakdown.push({
                questionKey: question.questionKey,
                score,
                weight,
                weightedScore,
            });
        }

        // Apply scoring strategy for final score
        if (plan.scoringStrategy === 'AVERAGE' && plan.questions.length > 0) {
            totalScore = totalScore / plan.questions.length;
        } else if (plan.scoringStrategy === 'MIN_ALL') {
            // For MIN_ALL, pass only if all answers score > 0
            const allPassed = breakdown.every(b => b.score > 0);
            totalScore = allPassed ? totalScore : 0;
        }

        // Determine pass/fail
        let passed: boolean | null = null;
        if (plan.passingScore !== null) {
            passed = totalScore >= plan.passingScore;
        }

        return {
            totalScore: Math.round(totalScore * 100) / 100,
            maxPossibleScore: Math.round(maxPossibleScore * 100) / 100,
            passed,
            passingScore: plan.passingScore,
            breakdown,
        };
    }

    return {
        create,
        findAll,
        findById,
        findByName,
        update,
        delete: deleteById,
        clone,
        addQuestion,
        removeQuestion,
        updateQuestion,
        calculateScore,
    };
}
