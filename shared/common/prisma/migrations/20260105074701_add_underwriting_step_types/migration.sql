-- AlterTable
ALTER TABLE `contract_phase_steps` ADD COLUMN `debtToIncomeRatio` DOUBLE NULL,
    ADD COLUMN `preApprovalAnswers` JSON NULL,
    ADD COLUMN `underwritingDecision` VARCHAR(191) NULL,
    ADD COLUMN `underwritingNotes` TEXT NULL,
    ADD COLUMN `underwritingScore` DOUBLE NULL,
    MODIFY `stepType` ENUM('UPLOAD', 'REVIEW', 'SIGNATURE', 'APPROVAL', 'EXTERNAL_CHECK', 'WAIT', 'GENERATE_DOCUMENT', 'PRE_APPROVAL', 'UNDERWRITING') NOT NULL;

-- AlterTable
ALTER TABLE `contracts` ADD COLUMN `debtToIncomeRatio` DOUBLE NULL,
    ADD COLUMN `monthlyExpenses` DOUBLE NULL,
    ADD COLUMN `monthlyIncome` DOUBLE NULL,
    ADD COLUMN `preApprovalAnswers` JSON NULL,
    ADD COLUMN `underwritingScore` DOUBLE NULL;

-- AlterTable
ALTER TABLE `payment_method_phase_steps` MODIFY `stepType` ENUM('UPLOAD', 'REVIEW', 'SIGNATURE', 'APPROVAL', 'EXTERNAL_CHECK', 'WAIT', 'GENERATE_DOCUMENT', 'PRE_APPROVAL', 'UNDERWRITING') NOT NULL;
