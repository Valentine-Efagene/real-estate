-- AlterTable
ALTER TABLE `documentation_phases` ADD COLUMN `documentationPlanId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `property_payment_method_phases` ADD COLUMN `documentationPlanId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `documentation_plans` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `requiredDocumentTypes` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `documentation_plans_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `documentation_plans_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentation_plan_steps` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `stepType` ENUM('UPLOAD', 'REVIEW', 'SIGNATURE', 'APPROVAL', 'EXTERNAL_CHECK', 'WAIT', 'GENERATE_DOCUMENT', 'PRE_APPROVAL', 'UNDERWRITING') NOT NULL,
    `order` INTEGER NOT NULL,
    `documentType` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `documentation_plan_steps_planId_idx`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `property_payment_method_phases_documentationPlanId_idx` ON `property_payment_method_phases`(`documentationPlanId`);

-- AddForeignKey
ALTER TABLE `documentation_plans` ADD CONSTRAINT `documentation_plans_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_plan_steps` ADD CONSTRAINT `documentation_plan_steps_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `documentation_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_phases` ADD CONSTRAINT `property_payment_method_phases_documentationPlanId_fkey` FOREIGN KEY (`documentationPlanId`) REFERENCES `documentation_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_phases` ADD CONSTRAINT `documentation_phases_documentationPlanId_fkey` FOREIGN KEY (`documentationPlanId`) REFERENCES `documentation_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
