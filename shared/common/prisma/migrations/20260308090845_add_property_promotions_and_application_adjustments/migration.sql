-- CreateTable
CREATE TABLE `property_promotions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `discountType` ENUM('PERCENTAGE', 'FIXED_AMOUNT') NOT NULL,
    `discountValue` DOUBLE NOT NULL,
    `maxDiscount` DOUBLE NULL,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `property_promotions_tenantId_idx`(`tenantId`),
    INDEX `property_promotions_propertyId_idx`(`propertyId`),
    INDEX `property_promotions_variantId_idx`(`variantId`),
    INDEX `property_promotions_isActive_idx`(`isActive`),
    INDEX `property_promotions_startsAt_idx`(`startsAt`),
    INDEX `property_promotions_endsAt_idx`(`endsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_adjustments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NULL,
    `installmentId` VARCHAR(191) NULL,
    `type` ENUM('PROMO_DISCOUNT', 'THIRD_PARTY_CREDIT', 'WAIVER', 'MANUAL_ADJUSTMENT', 'SURCHARGE', 'CORRECTION') NOT NULL,
    `direction` ENUM('REDUCTION', 'ADDITION') NOT NULL DEFAULT 'REDUCTION',
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'APPLIED', 'REVERSED') NOT NULL DEFAULT 'PENDING',
    `amount` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'NGN',
    `sourceType` ENUM('MANUAL', 'PROMO', 'RSA_PFA', 'BANK_DIRECT', 'SYSTEM') NOT NULL DEFAULT 'MANUAL',
    `sourceOrganizationId` VARCHAR(191) NULL,
    `sourceReference` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `metadata` JSON NULL,
    `createdById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `appliedAt` DATETIME(3) NULL,
    `reversedAt` DATETIME(3) NULL,
    `reversalReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `application_adjustments_tenantId_idx`(`tenantId`),
    INDEX `application_adjustments_applicationId_idx`(`applicationId`),
    INDEX `application_adjustments_phaseId_idx`(`phaseId`),
    INDEX `application_adjustments_installmentId_idx`(`installmentId`),
    INDEX `application_adjustments_status_idx`(`status`),
    INDEX `application_adjustments_type_idx`(`type`),
    INDEX `application_adjustments_sourceReference_idx`(`sourceReference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `property_promotions` ADD CONSTRAINT `property_promotions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_promotions` ADD CONSTRAINT `property_promotions_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_promotions` ADD CONSTRAINT `property_promotions_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `property_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_adjustments` ADD CONSTRAINT `application_adjustments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_adjustments` ADD CONSTRAINT `application_adjustments_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_adjustments` ADD CONSTRAINT `application_adjustments_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `application_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_adjustments` ADD CONSTRAINT `application_adjustments_installmentId_fkey` FOREIGN KEY (`installmentId`) REFERENCES `payment_installments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_adjustments` ADD CONSTRAINT `application_adjustments_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
