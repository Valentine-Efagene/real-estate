/*
  Warnings:

  - You are about to alter the column `status` on the `contract_documents` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(16))`.
  - You are about to alter the column `status` on the `contract_installments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(14))`.
  - You are about to alter the column `status` on the `contract_payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(15))`.
  - You are about to alter the column `decision` on the `contract_phase_step_approvals` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(13))`.
  - You are about to drop the column `requiredDocumentTypes` on the `contract_phase_steps` table. All the data in the column will be lost.
  - You are about to alter the column `stepType` on the `contract_phase_steps` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(11))`.
  - You are about to alter the column `status` on the `contract_phase_steps` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(12))`.
  - You are about to alter the column `phaseCategory` on the `contract_phases` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(7))`.
  - You are about to alter the column `phaseType` on the `contract_phases` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(8))`.
  - You are about to alter the column `status` on the `contract_phases` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(9))`.
  - You are about to alter the column `status` on the `contracts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(6))`.
  - You are about to alter the column `state` on the `contracts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(6))`.
  - You are about to alter the column `paymentFrequency` on the `payment_plans` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(0))`.
  - You are about to drop the column `requiredDocumentTypes` on the `property_payment_method_phases` table. All the data in the column will be lost.
  - You are about to drop the column `stepDefinitions` on the `property_payment_method_phases` table. All the data in the column will be lost.
  - You are about to alter the column `phaseCategory` on the `property_payment_method_phases` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(7))`.
  - You are about to alter the column `phaseType` on the `property_payment_method_phases` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(8))`.

*/
-- AlterTable
ALTER TABLE `contract_documents` MODIFY `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `contract_installments` MODIFY `status` ENUM('PENDING', 'PAID', 'OVERDUE', 'PARTIALLY_PAID', 'WAIVED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `contract_payments` MODIFY `status` ENUM('INITIATED', 'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'INITIATED';

-- AlterTable
ALTER TABLE `contract_phase_step_approvals` MODIFY `decision` ENUM('APPROVED', 'REJECTED', 'REQUEST_CHANGES') NOT NULL;

-- AlterTable
ALTER TABLE `contract_phase_steps` DROP COLUMN `requiredDocumentTypes`,
    MODIFY `stepType` ENUM('UPLOAD', 'REVIEW', 'SIGNATURE', 'APPROVAL', 'EXTERNAL_CHECK', 'WAIT') NOT NULL,
    MODIFY `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `contract_phases` ADD COLUMN `approvedDocumentsCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `completedStepsCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `completionCriterion` ENUM('DOCUMENT_APPROVALS', 'PAYMENT_AMOUNT', 'STEPS_COMPLETED') NULL,
    ADD COLUMN `paymentPlanSnapshot` JSON NULL,
    ADD COLUMN `requiredDocumentSnapshot` JSON NULL,
    ADD COLUMN `requiredDocumentsCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `stepDefinitionsSnapshot` JSON NULL,
    ADD COLUMN `totalStepsCount` INTEGER NOT NULL DEFAULT 0,
    MODIFY `phaseCategory` ENUM('DOCUMENTATION', 'PAYMENT') NOT NULL,
    MODIFY `phaseType` ENUM('KYC', 'VERIFICATION', 'DOWNPAYMENT', 'MORTGAGE', 'BALLOON', 'CUSTOM') NOT NULL,
    MODIFY `status` ENUM('PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'ACTIVE', 'COMPLETED', 'SKIPPED', 'FAILED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `contracts` MODIFY `status` ENUM('DRAFT', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED') NOT NULL DEFAULT 'DRAFT',
    MODIFY `state` ENUM('DRAFT', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `payment_plans` MODIFY `paymentFrequency` ENUM('MONTHLY', 'BIWEEKLY', 'WEEKLY', 'ONE_TIME', 'CUSTOM') NOT NULL;

-- AlterTable
ALTER TABLE `property_payment_method_phases` DROP COLUMN `requiredDocumentTypes`,
    DROP COLUMN `stepDefinitions`,
    ADD COLUMN `completionCriterion` ENUM('DOCUMENT_APPROVALS', 'PAYMENT_AMOUNT', 'STEPS_COMPLETED') NULL,
    ADD COLUMN `requiredDocumentSnapshot` JSON NULL,
    ADD COLUMN `stepDefinitionsSnapshot` JSON NULL,
    MODIFY `phaseCategory` ENUM('DOCUMENTATION', 'PAYMENT') NOT NULL,
    MODIFY `phaseType` ENUM('KYC', 'VERIFICATION', 'DOWNPAYMENT', 'MORTGAGE', 'BALLOON', 'CUSTOM') NOT NULL;

-- CreateTable
CREATE TABLE `payment_method_phase_steps` (
    `id` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `stepType` ENUM('UPLOAD', 'REVIEW', 'SIGNATURE', 'APPROVAL', 'EXTERNAL_CHECK', 'WAIT') NOT NULL,
    `order` INTEGER NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_method_phase_steps_phaseId_idx`(`phaseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_method_phase_documents` (
    `id` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `allowedMimeTypes` VARCHAR(191) NULL,
    `maxSizeBytes` INTEGER NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_method_phase_documents_phaseId_documentType_idx`(`phaseId`, `documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_phase_step_documents` (
    `id` VARCHAR(191) NOT NULL,
    `stepId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_phase_step_documents_stepId_documentType_idx`(`stepId`, `documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payment_method_phase_steps` ADD CONSTRAINT `payment_method_phase_steps_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `property_payment_method_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_phase_documents` ADD CONSTRAINT `payment_method_phase_documents_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `property_payment_method_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_phase_step_documents` ADD CONSTRAINT `contract_phase_step_documents_stepId_fkey` FOREIGN KEY (`stepId`) REFERENCES `contract_phase_steps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
