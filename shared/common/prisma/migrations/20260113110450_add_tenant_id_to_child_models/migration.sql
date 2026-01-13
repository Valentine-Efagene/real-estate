/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,name]` on the table `amenities` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `amenities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `application_documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `application_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `application_payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `application_phases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `documentation_phases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `documentation_step_approvals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `documentation_step_documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `documentation_steps` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `event_handler_executions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `payment_installments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `payment_method_phase_documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `payment_method_phase_fields` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `payment_method_phase_steps` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `payment_phases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `phase_event_attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `property_amenities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `property_documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `property_media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `property_payment_method_links` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `property_payment_method_phases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `property_units` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `property_variant_amenities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `property_variant_media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `property_variants` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `questionnaire_fields` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `questionnaire_phases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `step_event_attachments` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `amenities_name_key` ON `amenities`;

-- AlterTable
ALTER TABLE `amenities` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `application_documents` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `application_events` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `application_payments` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `application_phases` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `documentation_phases` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `documentation_step_approvals` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `documentation_step_documents` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `documentation_steps` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `event_handler_executions` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `payment_installments` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `payment_method_phase_documents` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `payment_method_phase_fields` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `payment_method_phase_steps` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `payment_phases` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `phase_event_attachments` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `property_amenities` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `property_documents` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `property_media` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `property_payment_method_links` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `property_payment_method_phases` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `property_units` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `property_variant_amenities` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `property_variant_media` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `property_variants` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `questionnaire_fields` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `questionnaire_phases` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `step_event_attachments` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `workflow_blockers` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NULL,
    `stepId` VARCHAR(191) NULL,
    `blockerActor` ENUM('CUSTOMER', 'ADMIN', 'SYSTEM', 'EXTERNAL') NOT NULL,
    `blockerCategory` ENUM('UPLOAD', 'RESUBMISSION', 'SIGNATURE', 'REVIEW', 'APPROVAL', 'PAYMENT', 'PROCESSING', 'EXTERNAL_CHECK', 'QUESTIONNAIRE') NOT NULL,
    `urgency` ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'NORMAL',
    `actionRequired` VARCHAR(500) NOT NULL,
    `context` TEXT NULL,
    `expectedByDate` DATETIME(3) NULL,
    `isOverdue` BOOLEAN NOT NULL DEFAULT false,
    `overdueAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `durationMs` INTEGER NULL,
    `resolvedByActor` VARCHAR(191) NULL,
    `resolutionTrigger` VARCHAR(191) NULL,
    `reminderCount` INTEGER NOT NULL DEFAULT 0,
    `lastReminderAt` DATETIME(3) NULL,
    `nextReminderAt` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `workflow_blockers_tenantId_idx`(`tenantId`),
    INDEX `workflow_blockers_applicationId_idx`(`applicationId`),
    INDEX `workflow_blockers_phaseId_idx`(`phaseId`),
    INDEX `workflow_blockers_stepId_idx`(`stepId`),
    INDEX `workflow_blockers_blockerActor_idx`(`blockerActor`),
    INDEX `workflow_blockers_blockerCategory_idx`(`blockerCategory`),
    INDEX `workflow_blockers_urgency_idx`(`urgency`),
    INDEX `workflow_blockers_isOverdue_idx`(`isOverdue`),
    INDEX `workflow_blockers_startedAt_idx`(`startedAt`),
    INDEX `workflow_blockers_resolvedAt_idx`(`resolvedAt`),
    INDEX `workflow_blockers_tenantId_blockerActor_resolvedAt_idx`(`tenantId`, `blockerActor`, `resolvedAt`),
    INDEX `workflow_blockers_tenantId_blockerCategory_resolvedAt_idx`(`tenantId`, `blockerCategory`, `resolvedAt`),
    INDEX `workflow_blockers_tenantId_isOverdue_blockerActor_idx`(`tenantId`, `isOverdue`, `blockerActor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `amenities_tenantId_idx` ON `amenities`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `amenities_tenantId_name_key` ON `amenities`(`tenantId`, `name`);

-- CreateIndex
CREATE INDEX `application_documents_tenantId_idx` ON `application_documents`(`tenantId`);

-- CreateIndex
CREATE INDEX `application_events_tenantId_idx` ON `application_events`(`tenantId`);

-- CreateIndex
CREATE INDEX `application_payments_tenantId_idx` ON `application_payments`(`tenantId`);

-- CreateIndex
CREATE INDEX `application_phases_tenantId_idx` ON `application_phases`(`tenantId`);

-- CreateIndex
CREATE INDEX `documentation_phases_tenantId_idx` ON `documentation_phases`(`tenantId`);

-- CreateIndex
CREATE INDEX `documentation_step_approvals_tenantId_idx` ON `documentation_step_approvals`(`tenantId`);

-- CreateIndex
CREATE INDEX `documentation_step_documents_tenantId_idx` ON `documentation_step_documents`(`tenantId`);

-- CreateIndex
CREATE INDEX `documentation_steps_tenantId_idx` ON `documentation_steps`(`tenantId`);

-- CreateIndex
CREATE INDEX `event_handler_executions_tenantId_idx` ON `event_handler_executions`(`tenantId`);

-- CreateIndex
CREATE INDEX `payment_installments_tenantId_idx` ON `payment_installments`(`tenantId`);

-- CreateIndex
CREATE INDEX `payment_method_phase_documents_tenantId_idx` ON `payment_method_phase_documents`(`tenantId`);

-- CreateIndex
CREATE INDEX `payment_method_phase_fields_tenantId_idx` ON `payment_method_phase_fields`(`tenantId`);

-- CreateIndex
CREATE INDEX `payment_method_phase_steps_tenantId_idx` ON `payment_method_phase_steps`(`tenantId`);

-- CreateIndex
CREATE INDEX `payment_phases_tenantId_idx` ON `payment_phases`(`tenantId`);

-- CreateIndex
CREATE INDEX `phase_event_attachments_tenantId_idx` ON `phase_event_attachments`(`tenantId`);

-- CreateIndex
CREATE INDEX `property_amenities_tenantId_idx` ON `property_amenities`(`tenantId`);

-- CreateIndex
CREATE INDEX `property_documents_tenantId_idx` ON `property_documents`(`tenantId`);

-- CreateIndex
CREATE INDEX `property_media_tenantId_idx` ON `property_media`(`tenantId`);

-- CreateIndex
CREATE INDEX `property_payment_method_links_tenantId_idx` ON `property_payment_method_links`(`tenantId`);

-- CreateIndex
CREATE INDEX `property_payment_method_phases_tenantId_idx` ON `property_payment_method_phases`(`tenantId`);

-- CreateIndex
CREATE INDEX `property_units_tenantId_idx` ON `property_units`(`tenantId`);

-- CreateIndex
CREATE INDEX `property_variant_amenities_tenantId_idx` ON `property_variant_amenities`(`tenantId`);

-- CreateIndex
CREATE INDEX `property_variant_media_tenantId_idx` ON `property_variant_media`(`tenantId`);

-- CreateIndex
CREATE INDEX `property_variants_tenantId_idx` ON `property_variants`(`tenantId`);

-- CreateIndex
CREATE INDEX `questionnaire_fields_tenantId_idx` ON `questionnaire_fields`(`tenantId`);

-- CreateIndex
CREATE INDEX `questionnaire_phases_tenantId_idx` ON `questionnaire_phases`(`tenantId`);

-- CreateIndex
CREATE INDEX `step_event_attachments_tenantId_idx` ON `step_event_attachments`(`tenantId`);

-- AddForeignKey
ALTER TABLE `property_media` ADD CONSTRAINT `property_media_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_documents` ADD CONSTRAINT `property_documents_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `amenities` ADD CONSTRAINT `amenities_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_variants` ADD CONSTRAINT `property_variants_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_variant_amenities` ADD CONSTRAINT `property_variant_amenities_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_variant_media` ADD CONSTRAINT `property_variant_media_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_units` ADD CONSTRAINT `property_units_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_amenities` ADD CONSTRAINT `property_amenities_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_links` ADD CONSTRAINT `property_payment_method_links_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_phases` ADD CONSTRAINT `property_payment_method_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phase_event_attachments` ADD CONSTRAINT `phase_event_attachments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_phase_steps` ADD CONSTRAINT `payment_method_phase_steps_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `step_event_attachments` ADD CONSTRAINT `step_event_attachments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_phase_documents` ADD CONSTRAINT `payment_method_phase_documents_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_phase_fields` ADD CONSTRAINT `payment_method_phase_fields_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_phases` ADD CONSTRAINT `application_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_phases` ADD CONSTRAINT `questionnaire_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_phases` ADD CONSTRAINT `documentation_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_phases` ADD CONSTRAINT `payment_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_fields` ADD CONSTRAINT `questionnaire_fields_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_events` ADD CONSTRAINT `application_events_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_steps` ADD CONSTRAINT `documentation_steps_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_step_documents` ADD CONSTRAINT `documentation_step_documents_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_step_approvals` ADD CONSTRAINT `documentation_step_approvals_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_installments` ADD CONSTRAINT `payment_installments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_payments` ADD CONSTRAINT `application_payments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_documents` ADD CONSTRAINT `application_documents_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_handler_executions` ADD CONSTRAINT `event_handler_executions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
