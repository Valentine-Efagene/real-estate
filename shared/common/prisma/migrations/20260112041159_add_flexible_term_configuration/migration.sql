-- AlterTable
ALTER TABLE `payment_phases` ADD COLUMN `numberOfInstallments` INTEGER NULL,
    ADD COLUMN `selectedTermMonths` INTEGER NULL;

-- AlterTable
ALTER TABLE `payment_plans` ADD COLUMN `allowFlexibleTerm` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `maxAgeAtMaturity` INTEGER NULL,
    ADD COLUMN `maxTermMonths` INTEGER NULL,
    ADD COLUMN `minTermMonths` INTEGER NULL,
    ADD COLUMN `termStepMonths` INTEGER NULL,
    MODIFY `numberOfInstallments` INTEGER NULL;
