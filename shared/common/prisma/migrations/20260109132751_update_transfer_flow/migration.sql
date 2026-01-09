/*
  Warnings:

  - You are about to drop the column `phaseId` on the `contract_installments` table. All the data in the column will be lost.
  - You are about to drop the column `approvedDocumentsCount` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `collectFunds` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `completedStepsCount` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `completionCriterion` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `currentStepId` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `interestRate` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `minimumCompletionPercentage` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `paidAmount` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `paymentPlanId` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `paymentPlanSnapshot` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `remainingAmount` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `requiredDocumentSnapshot` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `requiredDocumentsCount` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `stepDefinitionsSnapshot` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `totalStepsCount` on the `contract_phases` table. All the data in the column will be lost.
  - You are about to drop the column `debtToIncomeRatio` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `downPayment` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `downPaymentPaid` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `interestRate` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `monthlyExpenses` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `monthlyIncome` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `periodicPayment` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `preApprovalAnswers` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `principal` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `termMonths` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `totalInterestPaid` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `totalPaidToDate` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `underwritingScore` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `paymentsMigrated` on the `property_transfer_requests` table. All the data in the column will be lost.
  - You are about to drop the `contract_phase_step_approvals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contract_phase_step_documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contract_phase_steps` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `paymentPhaseId` to the `contract_installments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `contract_installments` DROP FOREIGN KEY `contract_installments_phaseId_fkey`;

-- DropForeignKey
ALTER TABLE `contract_phase_step_approvals` DROP FOREIGN KEY `contract_phase_step_approvals_approverId_fkey`;

-- DropForeignKey
ALTER TABLE `contract_phase_step_approvals` DROP FOREIGN KEY `contract_phase_step_approvals_stepId_fkey`;

-- DropForeignKey
ALTER TABLE `contract_phase_step_documents` DROP FOREIGN KEY `contract_phase_step_documents_stepId_fkey`;

-- DropForeignKey
ALTER TABLE `contract_phase_steps` DROP FOREIGN KEY `contract_phase_steps_assigneeId_fkey`;

-- DropForeignKey
ALTER TABLE `contract_phase_steps` DROP FOREIGN KEY `contract_phase_steps_phaseId_fkey`;

-- DropForeignKey
ALTER TABLE `contract_phases` DROP FOREIGN KEY `contract_phases_currentStepId_fkey`;

-- DropForeignKey
ALTER TABLE `contract_phases` DROP FOREIGN KEY `contract_phases_paymentPlanId_fkey`;

-- DropIndex
DROP INDEX `contract_installments_phaseId_idx` ON `contract_installments`;

-- DropIndex
DROP INDEX `contract_phases_currentStepId_idx` ON `contract_phases`;

-- DropIndex
DROP INDEX `contract_phases_paymentPlanId_idx` ON `contract_phases`;

-- DropIndex
DROP INDEX `contracts_state_idx` ON `contracts`;

-- AlterTable
ALTER TABLE `contract_installments` DROP COLUMN `phaseId`,
    ADD COLUMN `paymentPhaseId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `contract_phases` DROP COLUMN `approvedDocumentsCount`,
    DROP COLUMN `collectFunds`,
    DROP COLUMN `completedStepsCount`,
    DROP COLUMN `completionCriterion`,
    DROP COLUMN `currentStepId`,
    DROP COLUMN `interestRate`,
    DROP COLUMN `minimumCompletionPercentage`,
    DROP COLUMN `paidAmount`,
    DROP COLUMN `paymentPlanId`,
    DROP COLUMN `paymentPlanSnapshot`,
    DROP COLUMN `remainingAmount`,
    DROP COLUMN `requiredDocumentSnapshot`,
    DROP COLUMN `requiredDocumentsCount`,
    DROP COLUMN `stepDefinitionsSnapshot`,
    DROP COLUMN `totalAmount`,
    DROP COLUMN `totalStepsCount`,
    MODIFY `phaseCategory` ENUM('QUESTIONNAIRE', 'DOCUMENTATION', 'PAYMENT') NOT NULL,
    MODIFY `phaseType` ENUM('PRE_APPROVAL', 'UNDERWRITING', 'KYC', 'VERIFICATION', 'DOWNPAYMENT', 'MORTGAGE', 'BALLOON', 'CUSTOM') NOT NULL;

-- AlterTable
ALTER TABLE `contracts` DROP COLUMN `debtToIncomeRatio`,
    DROP COLUMN `downPayment`,
    DROP COLUMN `downPaymentPaid`,
    DROP COLUMN `interestRate`,
    DROP COLUMN `monthlyExpenses`,
    DROP COLUMN `monthlyIncome`,
    DROP COLUMN `periodicPayment`,
    DROP COLUMN `preApprovalAnswers`,
    DROP COLUMN `principal`,
    DROP COLUMN `state`,
    DROP COLUMN `termMonths`,
    DROP COLUMN `totalInterestPaid`,
    DROP COLUMN `totalPaidToDate`,
    DROP COLUMN `underwritingScore`;

-- AlterTable
ALTER TABLE `property_payment_method_phases` MODIFY `phaseCategory` ENUM('QUESTIONNAIRE', 'DOCUMENTATION', 'PAYMENT') NOT NULL,
    MODIFY `phaseType` ENUM('PRE_APPROVAL', 'UNDERWRITING', 'KYC', 'VERIFICATION', 'DOWNPAYMENT', 'MORTGAGE', 'BALLOON', 'CUSTOM') NOT NULL;

-- AlterTable
ALTER TABLE `property_transfer_requests` DROP COLUMN `paymentsMigrated`,
    ADD COLUMN `refundTransactionId` VARCHAR(191) NULL,
    ADD COLUMN `refundedAmount` DOUBLE NULL,
    ADD COLUMN `refundedAt` DATETIME(3) NULL;

-- DropTable
DROP TABLE `contract_phase_step_approvals`;

-- DropTable
DROP TABLE `contract_phase_step_documents`;

-- DropTable
DROP TABLE `contract_phase_steps`;

-- CreateTable
CREATE TABLE `payment_method_phase_fields` (
    `id` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `placeholder` VARCHAR(191) NULL,
    `fieldType` ENUM('TEXT', 'TEXTAREA', 'NUMBER', 'CURRENCY', 'EMAIL', 'PHONE', 'DATE', 'SELECT', 'MULTI_SELECT', 'CHECKBOX', 'RADIO', 'FILE') NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `order` INTEGER NOT NULL,
    `validation` JSON NULL,
    `displayCondition` JSON NULL,
    `defaultValue` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_method_phase_fields_phaseId_idx`(`phaseId`),
    UNIQUE INDEX `payment_method_phase_fields_phaseId_name_key`(`phaseId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questionnaire_phases` (
    `id` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `completedFieldsCount` INTEGER NOT NULL DEFAULT 0,
    `totalFieldsCount` INTEGER NOT NULL DEFAULT 0,
    `underwritingScore` DOUBLE NULL,
    `debtToIncomeRatio` DOUBLE NULL,
    `underwritingDecision` VARCHAR(191) NULL,
    `underwritingNotes` TEXT NULL,
    `fieldsSnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `questionnaire_phases_phaseId_key`(`phaseId`),
    INDEX `questionnaire_phases_phaseId_idx`(`phaseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentation_phases` (
    `id` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `currentStepId` VARCHAR(191) NULL,
    `approvedDocumentsCount` INTEGER NOT NULL DEFAULT 0,
    `requiredDocumentsCount` INTEGER NOT NULL DEFAULT 0,
    `completedStepsCount` INTEGER NOT NULL DEFAULT 0,
    `totalStepsCount` INTEGER NOT NULL DEFAULT 0,
    `minimumCompletionPercentage` DOUBLE NULL,
    `completionCriterion` ENUM('DOCUMENT_APPROVALS', 'PAYMENT_AMOUNT', 'STEPS_COMPLETED') NULL,
    `stepDefinitionsSnapshot` JSON NULL,
    `requiredDocumentSnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `documentation_phases_phaseId_key`(`phaseId`),
    INDEX `documentation_phases_phaseId_idx`(`phaseId`),
    INDEX `documentation_phases_currentStepId_idx`(`currentStepId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_phases` (
    `id` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `paymentPlanId` VARCHAR(191) NULL,
    `totalAmount` DOUBLE NOT NULL,
    `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    `interestRate` DOUBLE NOT NULL DEFAULT 0,
    `collectFunds` BOOLEAN NOT NULL DEFAULT true,
    `minimumCompletionPercentage` DOUBLE NULL,
    `paymentPlanSnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_phases_phaseId_key`(`phaseId`),
    INDEX `payment_phases_phaseId_idx`(`phaseId`),
    INDEX `payment_phases_paymentPlanId_idx`(`paymentPlanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questionnaire_fields` (
    `id` VARCHAR(191) NOT NULL,
    `questionnairePhaseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `placeholder` VARCHAR(191) NULL,
    `fieldType` ENUM('TEXT', 'TEXTAREA', 'NUMBER', 'CURRENCY', 'EMAIL', 'PHONE', 'DATE', 'SELECT', 'MULTI_SELECT', 'CHECKBOX', 'RADIO', 'FILE') NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `order` INTEGER NOT NULL,
    `validation` JSON NULL,
    `displayCondition` JSON NULL,
    `defaultValue` JSON NULL,
    `answer` JSON NULL,
    `isValid` BOOLEAN NOT NULL DEFAULT false,
    `validationErrors` JSON NULL,
    `submittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `questionnaire_fields_questionnairePhaseId_idx`(`questionnairePhaseId`),
    UNIQUE INDEX `questionnaire_fields_questionnairePhaseId_name_key`(`questionnairePhaseId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentation_steps` (
    `id` VARCHAR(191) NOT NULL,
    `documentationPhaseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `stepType` ENUM('UPLOAD', 'REVIEW', 'SIGNATURE', 'APPROVAL', 'EXTERNAL_CHECK', 'WAIT', 'GENERATE_DOCUMENT', 'PRE_APPROVAL', 'UNDERWRITING') NOT NULL,
    `order` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED', 'NEEDS_RESUBMISSION', 'ACTION_REQUIRED', 'AWAITING_REVIEW') NOT NULL DEFAULT 'PENDING',
    `actionReason` TEXT NULL,
    `submissionCount` INTEGER NOT NULL DEFAULT 0,
    `lastSubmittedAt` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `assigneeId` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `documentation_steps_documentationPhaseId_idx`(`documentationPhaseId`),
    INDEX `documentation_steps_status_idx`(`status`),
    INDEX `documentation_steps_order_idx`(`order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentation_step_documents` (
    `id` VARCHAR(191) NOT NULL,
    `stepId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `documentation_step_documents_stepId_documentType_idx`(`stepId`, `documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentation_step_approvals` (
    `id` VARCHAR(191) NOT NULL,
    `stepId` VARCHAR(191) NOT NULL,
    `approverId` VARCHAR(191) NULL,
    `decision` ENUM('APPROVED', 'REJECTED', 'REQUEST_CHANGES') NOT NULL,
    `comment` TEXT NULL,
    `decidedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `documentation_step_approvals_stepId_idx`(`stepId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `contract_installments_paymentPhaseId_idx` ON `contract_installments`(`paymentPhaseId`);

-- CreateIndex
CREATE INDEX `contracts_currentPhaseId_idx` ON `contracts`(`currentPhaseId`);

-- AddForeignKey
ALTER TABLE `payment_method_phase_fields` ADD CONSTRAINT `payment_method_phase_fields_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `property_payment_method_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_currentPhaseId_fkey` FOREIGN KEY (`currentPhaseId`) REFERENCES `contract_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_phases` ADD CONSTRAINT `questionnaire_phases_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `contract_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_phases` ADD CONSTRAINT `documentation_phases_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `contract_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_phases` ADD CONSTRAINT `documentation_phases_currentStepId_fkey` FOREIGN KEY (`currentStepId`) REFERENCES `documentation_steps`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_phases` ADD CONSTRAINT `payment_phases_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `contract_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_phases` ADD CONSTRAINT `payment_phases_paymentPlanId_fkey` FOREIGN KEY (`paymentPlanId`) REFERENCES `payment_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_fields` ADD CONSTRAINT `questionnaire_fields_questionnairePhaseId_fkey` FOREIGN KEY (`questionnairePhaseId`) REFERENCES `questionnaire_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_steps` ADD CONSTRAINT `documentation_steps_documentationPhaseId_fkey` FOREIGN KEY (`documentationPhaseId`) REFERENCES `documentation_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_steps` ADD CONSTRAINT `documentation_steps_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_step_documents` ADD CONSTRAINT `documentation_step_documents_stepId_fkey` FOREIGN KEY (`stepId`) REFERENCES `documentation_steps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_step_approvals` ADD CONSTRAINT `documentation_step_approvals_stepId_fkey` FOREIGN KEY (`stepId`) REFERENCES `documentation_steps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_step_approvals` ADD CONSTRAINT `documentation_step_approvals_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_installments` ADD CONSTRAINT `contract_installments_paymentPhaseId_fkey` FOREIGN KEY (`paymentPhaseId`) REFERENCES `payment_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
