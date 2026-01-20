-- AlterTable
ALTER TABLE `application_documents` ADD COLUMN `documentName` VARCHAR(191) NULL,
    ADD COLUMN `documentType` VARCHAR(191) NULL,
    MODIFY `status` ENUM('DRAFT', 'PENDING', 'PENDING_SIGNATURE', 'SENT', 'VIEWED', 'SIGNED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'NEEDS_REUPLOAD') NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE `document_definitions` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `uploadedBy` ENUM('CUSTOMER', 'LENDER', 'DEVELOPER', 'LEGAL', 'INSURER', 'PLATFORM') NOT NULL DEFAULT 'CUSTOMER',
    `order` INTEGER NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `maxSizeBytes` INTEGER NULL,
    `allowedMimeTypes` VARCHAR(191) NULL,
    `expiryDays` INTEGER NULL,
    `minFiles` INTEGER NOT NULL DEFAULT 1,
    `maxFiles` INTEGER NOT NULL DEFAULT 1,
    `condition` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_definitions_planId_idx`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_stages` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `reviewParty` ENUM('INTERNAL', 'BANK', 'DEVELOPER', 'LEGAL', 'GOVERNMENT', 'INSURER', 'CUSTOMER') NOT NULL,
    `autoTransition` BOOLEAN NOT NULL DEFAULT false,
    `waitForAllDocuments` BOOLEAN NOT NULL DEFAULT true,
    `allowEarlyVisibility` BOOLEAN NOT NULL DEFAULT false,
    `onRejection` ENUM('CASCADE_BACK', 'RESTART_CURRENT', 'RESTART_FROM_STAGE') NOT NULL DEFAULT 'CASCADE_BACK',
    `restartFromStageOrder` INTEGER NULL,
    `organizationId` VARCHAR(191) NULL,
    `slaHours` INTEGER NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `approval_stages_planId_idx`(`planId`),
    UNIQUE INDEX `approval_stages_planId_order_key`(`planId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_stage_progress` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `documentationPhaseId` VARCHAR(191) NOT NULL,
    `approvalStageId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `reviewParty` ENUM('INTERNAL', 'BANK', 'DEVELOPER', 'LEGAL', 'GOVERNMENT', 'INSURER', 'CUSTOMER') NOT NULL,
    `autoTransition` BOOLEAN NOT NULL DEFAULT false,
    `waitForAllDocuments` BOOLEAN NOT NULL DEFAULT true,
    `allowEarlyVisibility` BOOLEAN NOT NULL DEFAULT false,
    `onRejection` ENUM('CASCADE_BACK', 'RESTART_CURRENT', 'RESTART_FROM_STAGE') NOT NULL DEFAULT 'CASCADE_BACK',
    `restartFromStageOrder` INTEGER NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'AWAITING_TRANSITION', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `activatedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `completedById` VARCHAR(191) NULL,
    `transitionComment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `approval_stage_progress_tenantId_idx`(`tenantId`),
    INDEX `approval_stage_progress_documentationPhaseId_idx`(`documentationPhaseId`),
    INDEX `approval_stage_progress_approvalStageId_idx`(`approvalStageId`),
    INDEX `approval_stage_progress_status_idx`(`status`),
    UNIQUE INDEX `approval_stage_progress_documentationPhaseId_order_key`(`documentationPhaseId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_approvals` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `stageProgressId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NOT NULL,
    `reviewParty` ENUM('INTERNAL', 'BANK', 'DEVELOPER', 'LEGAL', 'GOVERNMENT', 'INSURER', 'CUSTOMER') NOT NULL,
    `decision` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'WAIVED') NOT NULL,
    `comment` TEXT NULL,
    `reviewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_approvals_tenantId_idx`(`tenantId`),
    INDEX `document_approvals_documentId_idx`(`documentId`),
    INDEX `document_approvals_stageProgressId_idx`(`stageProgressId`),
    INDEX `document_approvals_reviewerId_idx`(`reviewerId`),
    INDEX `document_approvals_decision_idx`(`decision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `application_documents_documentType_idx` ON `application_documents`(`documentType`);

-- AddForeignKey
ALTER TABLE `document_definitions` ADD CONSTRAINT `document_definitions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `documentation_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_stages` ADD CONSTRAINT `approval_stages_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `documentation_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_stage_progress` ADD CONSTRAINT `approval_stage_progress_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_stage_progress` ADD CONSTRAINT `approval_stage_progress_documentationPhaseId_fkey` FOREIGN KEY (`documentationPhaseId`) REFERENCES `documentation_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_stage_progress` ADD CONSTRAINT `approval_stage_progress_approvalStageId_fkey` FOREIGN KEY (`approvalStageId`) REFERENCES `approval_stages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_stage_progress` ADD CONSTRAINT `approval_stage_progress_completedById_fkey` FOREIGN KEY (`completedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_approvals` ADD CONSTRAINT `document_approvals_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_approvals` ADD CONSTRAINT `document_approvals_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `application_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_approvals` ADD CONSTRAINT `document_approvals_stageProgressId_fkey` FOREIGN KEY (`stageProgressId`) REFERENCES `approval_stage_progress`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_approvals` ADD CONSTRAINT `document_approvals_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
