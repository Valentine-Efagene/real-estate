/*
  Warnings:

  - You are about to drop the `event_handler_executions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflow_events` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `event_handler_executions` DROP FOREIGN KEY `event_handler_executions_eventId_fkey`;

-- DropForeignKey
ALTER TABLE `event_handler_executions` DROP FOREIGN KEY `event_handler_executions_handlerId_fkey`;

-- DropForeignKey
ALTER TABLE `event_handler_executions` DROP FOREIGN KEY `event_handler_executions_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `workflow_events` DROP FOREIGN KEY `workflow_events_eventTypeId_fkey`;

-- DropForeignKey
ALTER TABLE `workflow_events` DROP FOREIGN KEY `workflow_events_tenantId_fkey`;

-- AlterTable
ALTER TABLE `application_documents` ADD COLUMN `documentDate` DATETIME(3) NULL,
    ADD COLUMN `expectedOrganizationId` VARCHAR(191) NULL,
    ADD COLUMN `expectedUploader` ENUM('CUSTOMER', 'LENDER', 'DEVELOPER', 'LEGAL', 'INSURER', 'PLATFORM') NULL,
    ADD COLUMN `expiredAt` DATETIME(3) NULL,
    ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `expiryDays` INTEGER NULL,
    ADD COLUMN `expiryWarningAt` DATETIME(3) NULL,
    ADD COLUMN `isExpired` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `revalidatedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `application_events` MODIFY `eventGroup` ENUM('STATE_CHANGE', 'PAYMENT', 'DOCUMENT', 'NOTIFICATION', 'WORKFLOW', 'AUTOMATION') NULL,
    MODIFY `eventType` ENUM('APPLICATION_CREATED', 'APPLICATION_STATE_CHANGED', 'PHASE_ACTIVATED', 'PHASE_COMPLETED', 'STEP_COMPLETED', 'STEP_REJECTED', 'DOCUMENT_SUBMITTED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'PAYMENT_INITIATED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'INSTALLMENTS_GENERATED', 'APPLICATION_SIGNED', 'APPLICATION_TERMINATED', 'APPLICATION_TRANSFERRED', 'UNDERWRITING_COMPLETED', 'OFFER_LETTER_GENERATED', 'HANDLER_EXECUTED') NOT NULL;

-- AlterTable
ALTER TABLE `applications` ADD COLUMN `paymentMethodSnapshot` JSON NULL,
    ADD COLUMN `paymentMethodSnapshotAt` DATETIME(3) NULL,
    ADD COLUMN `paymentMethodSnapshotHash` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `event_handler_executions`;

-- DropTable
DROP TABLE `workflow_events`;

-- CreateTable
CREATE TABLE `bank_document_requirements` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `phaseType` VARCHAR(191) NOT NULL,
    `paymentMethodId` VARCHAR(191) NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `modifier` ENUM('REQUIRED', 'OPTIONAL', 'NOT_REQUIRED', 'STRICTER') NOT NULL DEFAULT 'REQUIRED',
    `description` TEXT NULL,
    `expiryDays` INTEGER NULL,
    `minFiles` INTEGER NULL,
    `maxFiles` INTEGER NULL,
    `allowedMimeTypes` VARCHAR(191) NULL,
    `validationRules` JSON NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bank_document_requirements_tenantId_idx`(`tenantId`),
    INDEX `bank_document_requirements_organizationId_idx`(`organizationId`),
    INDEX `bank_document_requirements_phaseType_idx`(`phaseType`),
    INDEX `bank_document_requirements_documentType_idx`(`documentType`),
    INDEX `bank_document_requirements_paymentMethodId_idx`(`paymentMethodId`),
    UNIQUE INDEX `bank_document_requirements_organizationId_phaseType_document_key`(`organizationId`, `phaseType`, `documentType`, `paymentMethodId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_organizations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `role` ENUM('DEVELOPER', 'LENDER', 'LEGAL', 'INSURER', 'GOVERNMENT') NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'DECLINED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING',
    `assignedById` VARCHAR(191) NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `offeredTerms` JSON NULL,
    `termsOfferedAt` DATETIME(3) NULL,
    `termsAcceptedAt` DATETIME(3) NULL,
    `termsDeclinedAt` DATETIME(3) NULL,
    `declineReason` TEXT NULL,
    `activatedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `withdrawnAt` DATETIME(3) NULL,
    `slaHours` INTEGER NULL,
    `slaStartedAt` DATETIME(3) NULL,
    `slaBreachedAt` DATETIME(3) NULL,
    `slaBreachNotified` BOOLEAN NOT NULL DEFAULT false,
    `reminderCount` INTEGER NOT NULL DEFAULT 0,
    `lastReminderSentAt` DATETIME(3) NULL,
    `nextReminderAt` DATETIME(3) NULL,
    `escalatedAt` DATETIME(3) NULL,
    `escalatedToUserId` VARCHAR(191) NULL,
    `escalationNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `application_organizations_tenantId_idx`(`tenantId`),
    INDEX `application_organizations_applicationId_idx`(`applicationId`),
    INDEX `application_organizations_organizationId_idx`(`organizationId`),
    INDEX `application_organizations_role_idx`(`role`),
    INDEX `application_organizations_status_idx`(`status`),
    INDEX `application_organizations_isPrimary_idx`(`isPrimary`),
    INDEX `application_organizations_slaBreachedAt_idx`(`slaBreachedAt`),
    UNIQUE INDEX `application_organizations_applicationId_organizationId_role_key`(`applicationId`, `organizationId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scheduled_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `jobType` ENUM('DOCUMENT_EXPIRY_CHECK', 'SLA_BREACH_CHECK', 'PAYMENT_REMINDER', 'DOCUMENT_EXPIRY_WARNING') NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `scheduledAt` DATETIME(3) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `durationMs` INTEGER NULL,
    `parameters` JSON NULL,
    `itemsProcessed` INTEGER NOT NULL DEFAULT 0,
    `itemsAffected` INTEGER NOT NULL DEFAULT 0,
    `errorCount` INTEGER NOT NULL DEFAULT 0,
    `errors` JSON NULL,
    `summary` TEXT NULL,
    `attemptNumber` INTEGER NOT NULL DEFAULT 1,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `nextRetryAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `scheduled_jobs_tenantId_idx`(`tenantId`),
    INDEX `scheduled_jobs_jobType_idx`(`jobType`),
    INDEX `scheduled_jobs_status_idx`(`status`),
    INDEX `scheduled_jobs_scheduledAt_idx`(`scheduledAt`),
    INDEX `scheduled_jobs_jobType_status_scheduledAt_idx`(`jobType`, `status`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_expiry_warnings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `daysUntil` INTEGER NOT NULL,
    `warningSent` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notificationSent` BOOLEAN NOT NULL DEFAULT false,
    `notificationId` VARCHAR(191) NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedAt` DATETIME(3) NULL,
    `resolvedBy` VARCHAR(191) NULL,
    `newDocumentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_expiry_warnings_tenantId_idx`(`tenantId`),
    INDEX `document_expiry_warnings_documentId_idx`(`documentId`),
    INDEX `document_expiry_warnings_expiresAt_idx`(`expiresAt`),
    INDEX `document_expiry_warnings_resolved_idx`(`resolved`),
    UNIQUE INDEX `document_expiry_warnings_documentId_daysUntil_key`(`documentId`, `daysUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `application_documents_isExpired_idx` ON `application_documents`(`isExpired`);

-- CreateIndex
CREATE INDEX `application_documents_expiresAt_idx` ON `application_documents`(`expiresAt`);

-- AddForeignKey
ALTER TABLE `bank_document_requirements` ADD CONSTRAINT `bank_document_requirements_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_document_requirements` ADD CONSTRAINT `bank_document_requirements_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_document_requirements` ADD CONSTRAINT `bank_document_requirements_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_organizations` ADD CONSTRAINT `application_organizations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_organizations` ADD CONSTRAINT `application_organizations_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_organizations` ADD CONSTRAINT `application_organizations_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
