/*
  Warnings:

  - You are about to drop the column `requiredDocumentSnapshot` on the `property_payment_method_phases` table. All the data in the column will be lost.
  - You are about to drop the column `stepDefinitionsSnapshot` on the `property_payment_method_phases` table. All the data in the column will be lost.
  - You are about to drop the `payment_method_phase_documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_method_phase_fields` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_method_phase_steps` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `step_event_attachments` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `payment_method_phase_documents` DROP FOREIGN KEY `payment_method_phase_documents_phaseId_fkey`;

-- DropForeignKey
ALTER TABLE `payment_method_phase_documents` DROP FOREIGN KEY `payment_method_phase_documents_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `payment_method_phase_fields` DROP FOREIGN KEY `payment_method_phase_fields_phaseId_fkey`;

-- DropForeignKey
ALTER TABLE `payment_method_phase_fields` DROP FOREIGN KEY `payment_method_phase_fields_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `payment_method_phase_steps` DROP FOREIGN KEY `payment_method_phase_steps_phaseId_fkey`;

-- DropForeignKey
ALTER TABLE `payment_method_phase_steps` DROP FOREIGN KEY `payment_method_phase_steps_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `step_event_attachments` DROP FOREIGN KEY `step_event_attachments_handlerId_fkey`;

-- DropForeignKey
ALTER TABLE `step_event_attachments` DROP FOREIGN KEY `step_event_attachments_stepId_fkey`;

-- DropForeignKey
ALTER TABLE `step_event_attachments` DROP FOREIGN KEY `step_event_attachments_tenantId_fkey`;

-- AlterTable
ALTER TABLE `document_definitions` ADD COLUMN `autoApprove` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `property_payment_method_phases` DROP COLUMN `requiredDocumentSnapshot`,
    DROP COLUMN `stepDefinitionsSnapshot`;

-- DropTable
DROP TABLE `payment_method_phase_documents`;

-- DropTable
DROP TABLE `payment_method_phase_fields`;

-- DropTable
DROP TABLE `payment_method_phase_steps`;

-- DropTable
DROP TABLE `step_event_attachments`;

-- CreateTable
CREATE TABLE `co_applicants` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `relationship` VARCHAR(191) NOT NULL,
    `monthlyIncome` DOUBLE NULL,
    `employmentType` VARCHAR(191) NULL,
    `inviteToken` VARCHAR(191) NULL,
    `inviteTokenExpiresAt` DATETIME(3) NULL,
    `status` ENUM('INVITED', 'ACTIVE', 'REMOVED', 'DECLINED') NOT NULL DEFAULT 'INVITED',
    `invitedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acceptedAt` DATETIME(3) NULL,
    `removedAt` DATETIME(3) NULL,
    `removedById` VARCHAR(191) NULL,
    `removalReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `co_applicants_inviteToken_key`(`inviteToken`),
    INDEX `co_applicants_tenantId_idx`(`tenantId`),
    INDEX `co_applicants_applicationId_idx`(`applicationId`),
    INDEX `co_applicants_userId_idx`(`userId`),
    UNIQUE INDEX `co_applicants_applicationId_email_key`(`applicationId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `async_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `jobType` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `result` JSON NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `async_jobs_tenantId_idx`(`tenantId`),
    INDEX `async_jobs_jobType_idx`(`jobType`),
    INDEX `async_jobs_status_idx`(`status`),
    INDEX `async_jobs_jobType_status_idx`(`jobType`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `co_applicants` ADD CONSTRAINT `co_applicants_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `co_applicants` ADD CONSTRAINT `co_applicants_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `co_applicants` ADD CONSTRAINT `co_applicants_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `co_applicants` ADD CONSTRAINT `co_applicants_removedById_fkey` FOREIGN KEY (`removedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
