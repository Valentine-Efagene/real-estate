-- AlterTable
ALTER TABLE `contract_documents` MODIFY `status` ENUM('DRAFT', 'PENDING', 'PENDING_SIGNATURE', 'SENT', 'VIEWED', 'SIGNED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE `document_templates` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `htmlTemplate` TEXT NOT NULL,
    `cssStyles` TEXT NULL,
    `mergeFields` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_templates_tenantId_idx`(`tenantId`),
    INDEX `document_templates_code_idx`(`code`),
    UNIQUE INDEX `document_templates_tenantId_code_version_key`(`tenantId`, `code`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offer_letters` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `letterNumber` VARCHAR(191) NOT NULL,
    `type` ENUM('PROVISIONAL', 'FINAL') NOT NULL,
    `status` ENUM('DRAFT', 'GENERATED', 'SENT', 'VIEWED', 'SIGNED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `htmlContent` TEXT NULL,
    `pdfUrl` VARCHAR(191) NULL,
    `pdfKey` VARCHAR(191) NULL,
    `mergeData` JSON NULL,
    `sentAt` DATETIME(3) NULL,
    `viewedAt` DATETIME(3) NULL,
    `signedAt` DATETIME(3) NULL,
    `signatureIp` VARCHAR(191) NULL,
    `signatureData` JSON NULL,
    `expiresAt` DATETIME(3) NULL,
    `expiredAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` VARCHAR(191) NULL,
    `generatedById` VARCHAR(191) NULL,
    `sentById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `offer_letters_letterNumber_key`(`letterNumber`),
    INDEX `offer_letters_tenantId_idx`(`tenantId`),
    INDEX `offer_letters_contractId_idx`(`contractId`),
    INDEX `offer_letters_type_idx`(`type`),
    INDEX `offer_letters_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `document_templates` ADD CONSTRAINT `document_templates_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_letters` ADD CONSTRAINT `offer_letters_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_letters` ADD CONSTRAINT `offer_letters_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_letters` ADD CONSTRAINT `offer_letters_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `document_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_letters` ADD CONSTRAINT `offer_letters_generatedById_fkey` FOREIGN KEY (`generatedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_letters` ADD CONSTRAINT `offer_letters_sentById_fkey` FOREIGN KEY (`sentById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
