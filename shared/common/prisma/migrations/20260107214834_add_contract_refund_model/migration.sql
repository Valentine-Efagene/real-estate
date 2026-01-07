/*
  Warnings:

  - You are about to alter the column `actorType` on the `contract_events` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(15))`.
  - You are about to alter the column `eventGroup` on the `contract_events` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(14))`.
  - You are about to alter the column `eventType` on the `contract_events` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(13))`.
  - You are about to alter the column `refundStatus` on the `contract_terminations` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(34))` to `Enum(EnumId(27))`.

*/
-- AlterTable
ALTER TABLE `contract_events` MODIFY `actorType` ENUM('USER', 'SYSTEM', 'WEBHOOK', 'ADMIN') NULL,
    MODIFY `eventGroup` ENUM('STATE_CHANGE', 'PAYMENT', 'DOCUMENT', 'NOTIFICATION', 'WORKFLOW') NULL,
    MODIFY `eventType` ENUM('CONTRACT_CREATED', 'CONTRACT_STATE_CHANGED', 'PHASE_ACTIVATED', 'PHASE_COMPLETED', 'STEP_COMPLETED', 'STEP_REJECTED', 'DOCUMENT_SUBMITTED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'PAYMENT_INITIATED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'INSTALLMENTS_GENERATED', 'CONTRACT_SIGNED', 'CONTRACT_TERMINATED', 'CONTRACT_TRANSFERRED', 'UNDERWRITING_COMPLETED', 'OFFER_LETTER_GENERATED') NOT NULL;

-- AlterTable
ALTER TABLE `contract_terminations` MODIFY `refundStatus` ENUM('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE `contract_refunds` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `requestedById` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NULL,
    `processedById` VARCHAR(191) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `referenceNumber` VARCHAR(191) NULL,
    `recipientName` VARCHAR(191) NULL,
    `recipientAccount` VARCHAR(191) NULL,
    `recipientBank` VARCHAR(191) NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approvedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `processedAt` DATETIME(3) NULL,
    `approvalNotes` TEXT NULL,
    `rejectionNotes` TEXT NULL,
    `processingNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `contract_refunds_contractId_idx`(`contractId`),
    INDEX `contract_refunds_status_idx`(`status`),
    INDEX `contract_refunds_tenantId_idx`(`tenantId`),
    INDEX `contract_refunds_requestedById_idx`(`requestedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `contract_refunds` ADD CONSTRAINT `contract_refunds_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_refunds` ADD CONSTRAINT `contract_refunds_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_refunds` ADD CONSTRAINT `contract_refunds_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_refunds` ADD CONSTRAINT `contract_refunds_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_refunds` ADD CONSTRAINT `contract_refunds_processedById_fkey` FOREIGN KEY (`processedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
