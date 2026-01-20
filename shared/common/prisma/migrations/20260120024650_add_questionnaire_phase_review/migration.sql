/*
  Warnings:

  - You are about to drop the column `completedStepsCount` on the `documentation_phases` table. All the data in the column will be lost.
  - You are about to drop the column `completionCriterion` on the `documentation_phases` table. All the data in the column will be lost.
  - You are about to drop the column `currentStepId` on the `documentation_phases` table. All the data in the column will be lost.
  - You are about to drop the column `minimumCompletionPercentage` on the `documentation_phases` table. All the data in the column will be lost.
  - You are about to drop the column `requiredDocumentSnapshot` on the `documentation_phases` table. All the data in the column will be lost.
  - You are about to drop the column `stepDefinitionsSnapshot` on the `documentation_phases` table. All the data in the column will be lost.
  - You are about to drop the column `totalStepsCount` on the `documentation_phases` table. All the data in the column will be lost.
  - You are about to drop the `documentation_plan_steps` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `documentation_step_approvals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `documentation_step_documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `documentation_steps` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `documentation_phases` DROP FOREIGN KEY `documentation_phases_currentStepId_fkey`;

-- DropForeignKey
ALTER TABLE `documentation_plan_steps` DROP FOREIGN KEY `documentation_plan_steps_planId_fkey`;

-- DropForeignKey
ALTER TABLE `documentation_step_approvals` DROP FOREIGN KEY `documentation_step_approvals_approverId_fkey`;

-- DropForeignKey
ALTER TABLE `documentation_step_approvals` DROP FOREIGN KEY `documentation_step_approvals_stepId_fkey`;

-- DropForeignKey
ALTER TABLE `documentation_step_approvals` DROP FOREIGN KEY `documentation_step_approvals_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `documentation_step_documents` DROP FOREIGN KEY `documentation_step_documents_stepId_fkey`;

-- DropForeignKey
ALTER TABLE `documentation_step_documents` DROP FOREIGN KEY `documentation_step_documents_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `documentation_steps` DROP FOREIGN KEY `documentation_steps_assigneeId_fkey`;

-- DropForeignKey
ALTER TABLE `documentation_steps` DROP FOREIGN KEY `documentation_steps_documentationPhaseId_fkey`;

-- DropForeignKey
ALTER TABLE `documentation_steps` DROP FOREIGN KEY `documentation_steps_gateActedById_fkey`;

-- DropForeignKey
ALTER TABLE `documentation_steps` DROP FOREIGN KEY `documentation_steps_tenantId_fkey`;

-- DropIndex
DROP INDEX `documentation_phases_currentStepId_idx` ON `documentation_phases`;

-- AlterTable
ALTER TABLE `documentation_phases` DROP COLUMN `completedStepsCount`,
    DROP COLUMN `completionCriterion`,
    DROP COLUMN `currentStepId`,
    DROP COLUMN `minimumCompletionPercentage`,
    DROP COLUMN `requiredDocumentSnapshot`,
    DROP COLUMN `stepDefinitionsSnapshot`,
    DROP COLUMN `totalStepsCount`,
    ADD COLUMN `approvalStagesSnapshot` JSON NULL,
    ADD COLUMN `currentStageOrder` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `documentDefinitionsSnapshot` JSON NULL;

-- DropTable
DROP TABLE `documentation_plan_steps`;

-- DropTable
DROP TABLE `documentation_step_approvals`;

-- DropTable
DROP TABLE `documentation_step_documents`;

-- DropTable
DROP TABLE `documentation_steps`;

-- CreateTable
CREATE TABLE `questionnaire_phase_reviews` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `questionnairePhaseId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NOT NULL,
    `decision` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'WAIVED') NOT NULL,
    `notes` TEXT NULL,
    `scoreAtReview` INTEGER NULL,
    `passedAtReview` BOOLEAN NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `questionnaire_phase_reviews_tenantId_idx`(`tenantId`),
    INDEX `questionnaire_phase_reviews_questionnairePhaseId_idx`(`questionnairePhaseId`),
    INDEX `questionnaire_phase_reviews_reviewerId_idx`(`reviewerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `questionnaire_phase_reviews` ADD CONSTRAINT `questionnaire_phase_reviews_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_phase_reviews` ADD CONSTRAINT `questionnaire_phase_reviews_questionnairePhaseId_fkey` FOREIGN KEY (`questionnairePhaseId`) REFERENCES `questionnaire_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_phase_reviews` ADD CONSTRAINT `questionnaire_phase_reviews_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
