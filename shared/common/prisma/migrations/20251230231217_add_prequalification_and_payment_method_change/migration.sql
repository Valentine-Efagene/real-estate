-- CreateTable
CREATE TABLE `prequalifications` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `paymentMethodId` VARCHAR(191) NOT NULL,
    `answers` JSON NOT NULL,
    `score` DOUBLE NULL,
    `requestedAmount` DOUBLE NULL,
    `monthlyIncome` DOUBLE NULL,
    `monthlyExpenses` DOUBLE NULL,
    `debtToIncomeRatio` DOUBLE NULL,
    `suggestedTermMonths` INTEGER NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'DRAFT',
    `notes` TEXT NULL,
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `contractId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `prequalifications_contractId_key`(`contractId`),
    INDEX `prequalifications_tenantId_idx`(`tenantId`),
    INDEX `prequalifications_userId_idx`(`userId`),
    INDEX `prequalifications_propertyId_idx`(`propertyId`),
    INDEX `prequalifications_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_method_change_requests` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `fromPaymentMethodId` VARCHAR(191) NOT NULL,
    `toPaymentMethodId` VARCHAR(191) NOT NULL,
    `requestorId` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `requiredDocumentTypes` VARCHAR(191) NULL,
    `submittedDocuments` JSON NULL,
    `currentOutstanding` DOUBLE NULL,
    `newTermMonths` INTEGER NULL,
    `newInterestRate` DOUBLE NULL,
    `newMonthlyPayment` DOUBLE NULL,
    `penaltyAmount` DOUBLE NULL,
    `financialImpactNotes` TEXT NULL,
    `status` ENUM('PENDING_DOCUMENTS', 'DOCUMENTS_SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_DOCUMENTS',
    `reviewerId` VARCHAR(191) NULL,
    `reviewNotes` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `executedAt` DATETIME(3) NULL,
    `previousPhaseData` JSON NULL,
    `newPhaseData` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_method_change_requests_tenantId_idx`(`tenantId`),
    INDEX `payment_method_change_requests_contractId_idx`(`contractId`),
    INDEX `payment_method_change_requests_status_idx`(`status`),
    INDEX `payment_method_change_requests_requestorId_idx`(`requestorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_requirement_rules` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `context` ENUM('PREQUALIFICATION', 'CONTRACT_PHASE', 'PAYMENT_METHOD_CHANGE') NOT NULL,
    `paymentMethodId` VARCHAR(191) NULL,
    `phaseType` VARCHAR(191) NULL,
    `fromPaymentMethodId` VARCHAR(191) NULL,
    `toPaymentMethodId` VARCHAR(191) NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NULL,
    `maxSizeBytes` INTEGER NULL,
    `allowedMimeTypes` VARCHAR(191) NULL,
    `expiryDays` INTEGER NULL,
    `requiresManualReview` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_requirement_rules_tenantId_idx`(`tenantId`),
    INDEX `document_requirement_rules_context_idx`(`context`),
    INDEX `document_requirement_rules_paymentMethodId_idx`(`paymentMethodId`),
    INDEX `document_requirement_rules_phaseType_idx`(`phaseType`),
    INDEX `document_requirement_rules_fromPaymentMethodId_toPaymentMeth_idx`(`fromPaymentMethodId`, `toPaymentMethodId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `prequalifications` ADD CONSTRAINT `prequalifications_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prequalifications` ADD CONSTRAINT `prequalifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prequalifications` ADD CONSTRAINT `prequalifications_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prequalifications` ADD CONSTRAINT `prequalifications_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prequalifications` ADD CONSTRAINT `prequalifications_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_change_requests` ADD CONSTRAINT `payment_method_change_requests_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_change_requests` ADD CONSTRAINT `payment_method_change_requests_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_change_requests` ADD CONSTRAINT `payment_method_change_requests_fromPaymentMethodId_fkey` FOREIGN KEY (`fromPaymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_change_requests` ADD CONSTRAINT `payment_method_change_requests_toPaymentMethodId_fkey` FOREIGN KEY (`toPaymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_change_requests` ADD CONSTRAINT `payment_method_change_requests_requestorId_fkey` FOREIGN KEY (`requestorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_change_requests` ADD CONSTRAINT `payment_method_change_requests_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_requirement_rules` ADD CONSTRAINT `document_requirement_rules_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_requirement_rules` ADD CONSTRAINT `document_requirement_rules_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_requirement_rules` ADD CONSTRAINT `document_requirement_rules_fromPaymentMethodId_fkey` FOREIGN KEY (`fromPaymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_requirement_rules` ADD CONSTRAINT `document_requirement_rules_toPaymentMethodId_fkey` FOREIGN KEY (`toPaymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
