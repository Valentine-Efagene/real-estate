import { prisma } from '@valentine-efagene/qshelter-common';
import { AppError } from '@valentine-efagene/qshelter-common';

interface PaymentPhaseTemplateInput {
    name: string;
    description?: string;
    phaseType: string;
    order: number;
    durationMonths?: number;
    gracePeriodDays?: number;
    paymentFrequency?: string;
    interestRate?: number;
    customFrequencyDays?: number;
    numberOfInstallments?: number;
    installmentAmount?: number;
    calculateInterestDaily?: boolean;
    requiresPreviousPhaseCompletion?: boolean;
    minimumCompletionPercentage?: number;
    requiredDocumentTypes?: string;
}

interface CreatePaymentPlanTemplateInput {
    name: string;
    description?: string;
    category: string;
    allowEarlyPayoff?: boolean;
    earlyPayoffPenaltyRate?: number;
    autoActivatePhases?: boolean;
    requiresManualApproval?: boolean;
    phases?: PaymentPhaseTemplateInput[];
}

interface UpdatePaymentPlanTemplateInput {
    name?: string;
    description?: string;
    category?: string;
    isActive?: boolean;
    allowEarlyPayoff?: boolean;
    earlyPayoffPenaltyRate?: number;
    autoActivatePhases?: boolean;
    requiresManualApproval?: boolean;
}phases: {
    create: phases,
        },
      },
include: {
    phases: {
        orderBy: { order: 'asc' },
    },
},
    });

return templateivationRules)
              : null,
          })),
        },
      },
include: {
    phases: {
        orderBy: { order: 'asc' },
    },
},
    });

return this.formatTemplate(template);
  }

  /**
   * Get all templates with optional filtering
   */
  async getAll(filters: { category?: string; isActive?: boolean } = {}) {
    const templates = await prisma.paymentPlanTemplate.findMany({
        where: {
            ...(filters.category && { category: filters.category }),
            ...(filters.isActive !== undefined && { isActive: filters.isActive }),
        },
        include: {
            phases: {
                orderBy: { order: 'asc' },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    return templates.map((t) => this.formatTemplate(t));
}

  /**
   * Get template by ID
   */
  async getById(id: string) {
    const template = await prisma.paymentPlanTemplate.findUnique({
        where: { id },
        include: {
            phases: {
                orderBy: { order: 'asc' },
            },
        },
    });

    if (!template) {
        throw new AppError(404, 'Payment plan template not found');
    }

    return this.formatTemplate(template);
}

  /**
   * Update template
   */
  async update(id: string, data: UpdatePaymentPlanTemplateInput) {
    const template = await prisma.paymentPlanTemplate.update({
        where: { id },
        data,
        include: {
            phases: {
                orderBy: { order: 'asc' },
            },
        },
    });

    return template;
}

  /**
   * Delete template
   */
  async delete (id: string) {
    await prisma.paymentPlanTemplate.delete({
        where: { id },
    });
}

  /**
   * Clone an existing template
   */
  async clone(id: string, newName: string) {
    const original = await this.getById(id);

    const phases = original.phases.map(
        ({ id: _id, templateId: _templateId, createdAt: _c, updatedAt: _u, ...phase }) => phase
    );

    return this.create({
        name: newName,
        description: `Cloned from ${original.name}`,
        category: original.category,
        config: original.config,
        phases,
    });
} allowEarlyPayoff: original.allowEarlyPayoff,
    earlyPayoffPenaltyRate: original.earlyPayoffPenaltyRate ?? undefined,
        autoActivatePhases: original.autoActivatePhases,
            requiresManualApproval: original.requiresManualApproval,
                phases,
    });
  }

/**
 * Validate template configuration
 */
validateConfig(template: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate phases exist
    const phases = template.phases || [];
    if (phases.length === 0) {
        errors.push('At least one phase is required');
    }

    // Validate phase ordering
    const orders = phases.map((p: any) => p.order);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
        errors.push('Phase orders must be unique');
    }

    // Validate phase types
    const validPhaseTypes = ['DOWNPAYMENT', 'MORTGAGE', 'BALLOON', 'GRACE_PERIOD', 'CUSTOM'];
    phases.forEach((phase: any, idx: number) => {
        if (!validPhaseTypes.includes(phase.phaseType)) {
            errors.push(`Phase ${idx + 1}: Invalid phase type "${phase.phaseType}"`);
        }

        // Validate frequency and custom days
        if (phase.paymentFrequency === 'CUSTOM' && !phase.customFrequencyDays) {
            errors.push(`Phase ${idx + 1}: Custom frequency requires customFrequencyDays`);
        }

        // Validate completion percentage
        if (phase.minimumCompletionPercentage !== undefined) {
            if (phase.minimumCompletionPercentage < 0 || phase.minimumCompletionPercentage > 100) {
                errors.push(`Phase ${idx + 1}: Completion percentage must be between 0 and 100`);
            }
        }
    });

    // Validate early payoff penalty
    if (template.earlyPayoffPenaltyRate !== undefined) {
        if (template.earlyPayoffPenaltyRate < 0 || template.earlyPayoffPenaltyRate > 100) {
            errors.push('Early payoff penalty rate must be between 0 and 100');
        }
    }

    return { valid: errors.length === 0, errors