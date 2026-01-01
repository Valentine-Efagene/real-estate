-- CreateTable
CREATE TABLE `contract_terminations` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `requestNumber` VARCHAR(191) NOT NULL,
    `initiatedBy` ENUM('BUYER', 'SELLER', 'ADMIN', 'SYSTEM') NOT NULL,
    `initiatorId` VARCHAR(191) NULL,
    `type` ENUM('BUYER_WITHDRAWAL', 'SELLER_WITHDRAWAL', 'MUTUAL_AGREEMENT', 'PAYMENT_DEFAULT', 'DOCUMENT_FAILURE', 'FRAUD', 'FORCE_MAJEURE', 'PROPERTY_UNAVAILABLE', 'REGULATORY', 'OTHER') NOT NULL,
    `reason` TEXT NULL,
    `supportingDocs` JSON NULL,
    `status` ENUM('REQUESTED', 'PENDING_REVIEW', 'PENDING_REFUND', 'REFUND_IN_PROGRESS', 'REFUND_COMPLETED', 'COMPLETED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `requiresApproval` BOOLEAN NOT NULL DEFAULT true,
    `autoApproveEligible` BOOLEAN NOT NULL DEFAULT false,
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNotes` TEXT NULL,
    `rejectionReason` TEXT NULL,
    `contractSnapshot` JSON NOT NULL,
    `totalContractAmount` DOUBLE NOT NULL,
    `totalPaidToDate` DOUBLE NOT NULL,
    `outstandingBalance` DOUBLE NOT NULL,
    `refundableAmount` DOUBLE NOT NULL DEFAULT 0,
    `penaltyAmount` DOUBLE NOT NULL DEFAULT 0,
    `forfeitedAmount` DOUBLE NOT NULL DEFAULT 0,
    `adminFeeAmount` DOUBLE NOT NULL DEFAULT 0,
    `netRefundAmount` DOUBLE NOT NULL DEFAULT 0,
    `settlementNotes` TEXT NULL,
    `refundStatus` ENUM('NOT_APPLICABLE', 'PENDING', 'INITIATED', 'PROCESSING', 'PARTIAL_COMPLETED', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'NOT_APPLICABLE',
    `refundReference` VARCHAR(191) NULL,
    `refundMethod` VARCHAR(191) NULL,
    `refundAccountDetails` JSON NULL,
    `refundInitiatedAt` DATETIME(3) NULL,
    `refundCompletedAt` DATETIME(3) NULL,
    `refundFailureReason` TEXT NULL,
    `unitReleasedAt` DATETIME(3) NULL,
    `unitReservedForId` VARCHAR(191) NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approvedAt` DATETIME(3) NULL,
    `executedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contract_terminations_requestNumber_key`(`requestNumber`),
    UNIQUE INDEX `contract_terminations_idempotencyKey_key`(`idempotencyKey`),
    INDEX `contract_terminations_contractId_idx`(`contractId`),
    INDEX `contract_terminations_tenantId_idx`(`tenantId`),
    INDEX `contract_terminations_status_idx`(`status`),
    INDEX `contract_terminations_type_idx`(`type`),
    INDEX `contract_terminations_initiatorId_idx`(`initiatorId`),
    INDEX `contract_terminations_requestedAt_idx`(`requestedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `contract_terminations` ADD CONSTRAINT `contract_terminations_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_terminations` ADD CONSTRAINT `contract_terminations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_terminations` ADD CONSTRAINT `contract_terminations_initiatorId_fkey` FOREIGN KEY (`initiatorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_terminations` ADD CONSTRAINT `contract_terminations_reviewedBy_fkey` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
