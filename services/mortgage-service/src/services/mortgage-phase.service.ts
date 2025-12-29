import { prisma } from '@valentine-efagene/qshelter-common';
import { AppError } from '@valentine-efagene/qshelter-common';

interface CreateMortgagePhaseInput {
    mortgageId: string;
    name: string;
    description?: string;
    phaseType: string;
    order: number;
    totalAmount: number;
    durationMonths?: number;
    gracePeriodDays?: number;
    paymentFrequency?: string;
    interestRate?: number;
    customFrequencyDays?: number;
    numberOfInstallments?: number;
    installmentAmount?: number;
    calculateInterestDaily?: boolean;
    startDate?: Date;
    endDate?: Date;
}

interface GenerateInstallmentsInput {
    totalAmount: number;
    durationMonths: number;
    interestRate: number;
    frequency: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY';
    startDate: Date;
}

export class MortgagePhaseService {
    /**remainingAmount: data.totalAmount,
        },
        include: {
          installments: {
            orderBy: { installmentNumber: 'asc' },
          },
        },
      });
  
      return phase
          installments: {
            orderBy: { installmentNumber: 'asc' },
          },
        },
      });
  
      return this.formatPhase(phase);
    }
  
    /**
     * Get all phases for a mortgage
     */
    async getByMortgageId(mortgageId: string) {
        const phases = await prisma.mortgagePhase.findMany({
            where: { mortgageId },
            include: {
                installments: {
                    orderBy: { installmentNumber: 'asc' },
                },
            },
            orderBy: { order: 'asc' },
        });

        return phases.map((p) => this.formatPhase(p));
    };
}

  /**
   * Get phase by ID
   */
  async getById(id: string) {
    const phase = await prisma.mortgagePhase.findUnique({
        where: { id },
        include: {
            installments: {
                orderBy: { installmentNumber: 'asc' },
            },
        },
    });

    if (!phase) {
        throw new AppError(404, 'Mortgage phase not found');
    }

    return phase

  /**
   * Activate a phase
   */
  async activate(id: string) {
        const phase = await this.getById(id);

        if (phase.status !== 'PENDING') {
            throw new AppError(400, 'Only pending phases can be activated');
        }

        // Check if previous phases are completed
        const previousPhases = await prisma.mortgagePhase.findMany({
            where: {
                mortgageId: phase.mortgageId,
                order: { lt: phase.order },
                status: { not: 'COMPLETED' },
            },
        });

        if (previousPhases.length > 0) {
            throw new AppError(400, 'Previous phases must be completed first');
        }

        const updated = await prisma.mortgagePhase.update({
            where: { id },
            data: {
                status: 'ACTIVE',
                activatedAt: new Date(),
            },
            include: {
                installments: {
                    orderBy: { installmentNumber: 'asc' },
                },
            },
        });

        return updated;
    }

  /**
   * Complete a phase
   */
  async complete(id: string) {
        const phase = await this.getById(id);

        if (phase.status !== 'ACTIVE') {
            throw new AppError(400, 'Only active phases can be completed');
        }

        if (phase.paidAmount < phase.totalAmount) {
            throw new AppError(400, 'Phase must be fully paid before completion');
        }

        const updated = await prisma.mortgagePhase.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
            },
            include: {
                installments: {
                    orderBy: { installmentNumber: 'asc' },
                },
            },
        });

        // Auto-activate next phase if exists
        const nextPhase = await prisma.mortgagePhase.findFirst({
            where: {
                mortgageId: phase.mortgageId,
                order: phase.order + 1,
                status: 'PENDING',
            },
        });

        if (nextPhase) {
            await this.activate(nextPhase.id);
        }

        return updated;
    }

  /**
   * Generate installments for a phase
   */
  async generateInstallments(phaseId: string, input: GenerateInstallmentsInput) {
        const phase = await this.getById(phaseId);

        if (phase.installments.length > 0) {
            throw new AppError(400, 'Installments already generated for this phase');
        }

        const { totalAmount, durationMonths, interestRate, frequency, startDate } = input;

        // Calculate installment schedule
        const installments = this.calculateInstallmentSchedule({
            totalAmount,
            durationMonths,
            interestRate,
            frequency,
            startDate,
        });

        // Create installments in database
        const created = await Promise.all(
            installments.map((inst, index) =>
                prisma.mortgageInstallment.create({
                    data: {
                        phaseId,
                        installmentNumber: index + 1,
                        amount: inst.amount,
                        principalAmount: inst.principalAmount,
                        interestAmount: inst.interestAmount,
                        dueDate: inst.dueDate,
                    },
                })
            )
        );

        return installments;
    }

  /**
   * Calculate installment schedule using amortization formula
   * Preserves logic from legacy mortgage service
   */
  private calculateInstallmentSchedule(input: GenerateInstallmentsInput) {
        const { totalAmount, durationMonths, interestRate, frequency, startDate } = input;

        // Calculate number of payments based on frequency
        const paymentsPerYear = frequency === 'MONTHLY' ? 12 : frequency === 'BIWEEKLY' ? 26 : 52;
        const totalPayments = Math.floor((durationMonths / 12) * paymentsPerYear);

        // Calculate payment amount using amortization formula
        const periodicRate = interestRate / 100 / paymentsPerYear;
        const paymentAmount =
            periodicRate === 0
                ? totalAmount / totalPayments
                : (totalAmount * periodicRate) / (1 - Math.pow(1 + periodicRate, -totalPayments));

        // Generate schedule
        const installments = [];
        let remainingPrincipal = totalAmount;
        let currentDate = new Date(startDate);

        for (let i = 0; i < totalPayments; i++) {
            const interestAmount = remainingPrincipal * periodicRate;
            const principalAmount = paymentAmount - interestAmount;

            installments.push({
                amount: paymentAmount,
                principalAmount,
                interestAmount,
                dueDate: new Date(currentDate),
            });

            remainingPrincipal -= principalAmount;

            // Increment date based on frequency
            if (frequency === 'MONTHLY') {
                currentDate.setMonth(currentDate.getMonth() + 1);
            } else if (frequency === 'BIWEEKLY') {
                currentDate.setDate(currentDate.getDate() + 14);
            } else {
                currentDate.setDate(currentDate.getDate() + 7);
            }
        }

        return installments;
    }
}
