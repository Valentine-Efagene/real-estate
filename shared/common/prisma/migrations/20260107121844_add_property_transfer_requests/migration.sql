/*
  Warnings:

  - A unique constraint covering the columns `[transferredFromId]` on the table `contracts` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `contracts` ADD COLUMN `transferredFromId` VARCHAR(191) NULL,
    MODIFY `status` ENUM('DRAFT', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED', 'TRANSFERRED') NOT NULL DEFAULT 'DRAFT',
    MODIFY `state` ENUM('DRAFT', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED', 'TRANSFERRED') NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE `property_transfer_requests` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `sourceContractId` VARCHAR(191) NOT NULL,
    `targetPropertyUnitId` VARCHAR(191) NOT NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `reason` TEXT NULL,
    `reviewNotes` TEXT NULL,
    `priceAdjustmentHandling` VARCHAR(191) NULL,
    `sourceTotalAmount` DOUBLE NULL,
    `targetTotalAmount` DOUBLE NULL,
    `priceAdjustment` DOUBLE NULL,
    `paymentsMigrated` INTEGER NULL,
    `targetContractId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `property_transfer_requests_tenantId_idx`(`tenantId`),
    INDEX `property_transfer_requests_sourceContractId_idx`(`sourceContractId`),
    INDEX `property_transfer_requests_targetPropertyUnitId_idx`(`targetPropertyUnitId`),
    INDEX `property_transfer_requests_requestedById_idx`(`requestedById`),
    INDEX `property_transfer_requests_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `contracts_transferredFromId_key` ON `contracts`(`transferredFromId`);

-- AddForeignKey
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_transferredFromId_fkey` FOREIGN KEY (`transferredFromId`) REFERENCES `contracts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_transfer_requests` ADD CONSTRAINT `property_transfer_requests_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_transfer_requests` ADD CONSTRAINT `property_transfer_requests_sourceContractId_fkey` FOREIGN KEY (`sourceContractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_transfer_requests` ADD CONSTRAINT `property_transfer_requests_targetPropertyUnitId_fkey` FOREIGN KEY (`targetPropertyUnitId`) REFERENCES `property_units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_transfer_requests` ADD CONSTRAINT `property_transfer_requests_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_transfer_requests` ADD CONSTRAINT `property_transfer_requests_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_transfer_requests` ADD CONSTRAINT `property_transfer_requests_targetContractId_fkey` FOREIGN KEY (`targetContractId`) REFERENCES `contracts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
