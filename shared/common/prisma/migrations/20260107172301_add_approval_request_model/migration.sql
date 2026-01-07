-- CreateTable
CREATE TABLE `approval_requests` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `type` ENUM('PROPERTY_TRANSFER', 'PROPERTY_UPDATE', 'USER_WORKFLOW', 'CREDIT_CHECK', 'CONTRACT_TERMINATION', 'REFUND_APPROVAL') NOT NULL,
    `status` ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `payload` JSON NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewNotes` TEXT NULL,
    `decision` ENUM('APPROVED', 'REJECTED', 'REQUEST_CHANGES') NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `approval_requests_tenantId_idx`(`tenantId`),
    INDEX `approval_requests_type_idx`(`type`),
    INDEX `approval_requests_status_idx`(`status`),
    INDEX `approval_requests_priority_idx`(`priority`),
    INDEX `approval_requests_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `approval_requests_requestedById_idx`(`requestedById`),
    INDEX `approval_requests_assigneeId_idx`(`assigneeId`),
    INDEX `approval_requests_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
