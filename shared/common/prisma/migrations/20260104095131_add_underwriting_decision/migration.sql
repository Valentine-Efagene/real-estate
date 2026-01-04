-- CreateTable
CREATE TABLE `underwriting_decisions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `prequalificationId` VARCHAR(191) NOT NULL,
    `decision` ENUM('APPROVE', 'REJECT', 'CONDITIONAL') NOT NULL,
    `score` DOUBLE NULL,
    `reasons` JSON NULL,
    `conditions` JSON NULL,
    `rulesVersion` VARCHAR(191) NULL,
    `ruleResults` JSON NULL,
    `externalChecks` JSON NULL,
    `isManualReview` BOOLEAN NOT NULL DEFAULT false,
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `underwriting_decisions_tenantId_idx`(`tenantId`),
    INDEX `underwriting_decisions_prequalificationId_idx`(`prequalificationId`),
    INDEX `underwriting_decisions_decision_idx`(`decision`),
    INDEX `underwriting_decisions_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `underwriting_decisions` ADD CONSTRAINT `underwriting_decisions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `underwriting_decisions` ADD CONSTRAINT `underwriting_decisions_prequalificationId_fkey` FOREIGN KEY (`prequalificationId`) REFERENCES `prequalifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
