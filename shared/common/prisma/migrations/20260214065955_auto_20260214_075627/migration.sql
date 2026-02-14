/*
  Warnings:

  - You are about to drop the column `qualificationFlowId` on the `property_payment_methods` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `property_payment_methods` DROP FOREIGN KEY `property_payment_methods_qualificationFlowId_fkey`;

-- DropIndex
DROP INDEX `property_payment_methods_qualificationFlowId_idx` ON `property_payment_methods`;

-- AlterTable
ALTER TABLE `property_payment_methods` DROP COLUMN `qualificationFlowId`;

-- CreateTable
CREATE TABLE `payment_method_qualification_configs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `paymentMethodId` VARCHAR(191) NOT NULL,
    `organizationTypeId` VARCHAR(191) NOT NULL,
    `qualificationFlowId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_method_qualification_configs_tenantId_idx`(`tenantId`),
    INDEX `payment_method_qualification_configs_paymentMethodId_idx`(`paymentMethodId`),
    INDEX `payment_method_qualification_configs_organizationTypeId_idx`(`organizationTypeId`),
    INDEX `payment_method_qualification_configs_qualificationFlowId_idx`(`qualificationFlowId`),
    UNIQUE INDEX `payment_method_qualification_configs_paymentMethodId_organiz_key`(`paymentMethodId`, `organizationTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_document_waivers` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `organizationPaymentMethodId` VARCHAR(191) NOT NULL,
    `documentDefinitionId` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `waivedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `organization_document_waivers_tenantId_idx`(`tenantId`),
    INDEX `organization_document_waivers_organizationPaymentMethodId_idx`(`organizationPaymentMethodId`),
    INDEX `organization_document_waivers_documentDefinitionId_idx`(`documentDefinitionId`),
    UNIQUE INDEX `organization_document_waivers_organizationPaymentMethodId_do_key`(`organizationPaymentMethodId`, `documentDefinitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payment_method_qualification_configs` ADD CONSTRAINT `payment_method_qualification_configs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_qualification_configs` ADD CONSTRAINT `payment_method_qualification_configs_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_qualification_configs` ADD CONSTRAINT `payment_method_qualification_configs_organizationTypeId_fkey` FOREIGN KEY (`organizationTypeId`) REFERENCES `organization_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_qualification_configs` ADD CONSTRAINT `payment_method_qualification_configs_qualificationFlowId_fkey` FOREIGN KEY (`qualificationFlowId`) REFERENCES `qualification_flows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_document_waivers` ADD CONSTRAINT `organization_document_waivers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_document_waivers` ADD CONSTRAINT `organization_document_waivers_organizationPaymentMethodId_fkey` FOREIGN KEY (`organizationPaymentMethodId`) REFERENCES `organization_payment_methods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_document_waivers` ADD CONSTRAINT `organization_document_waivers_documentDefinitionId_fkey` FOREIGN KEY (`documentDefinitionId`) REFERENCES `document_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_document_waivers` ADD CONSTRAINT `organization_document_waivers_waivedById_fkey` FOREIGN KEY (`waivedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
