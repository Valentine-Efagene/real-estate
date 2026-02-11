/*
  Warnings:

  - You are about to drop the column `onboardingMethodId` on the `organization_onboardings` table. All the data in the column will be lost.
  - You are about to drop the column `onboardingMethodId` on the `organization_types` table. All the data in the column will be lost.
  - You are about to drop the `onboarding_method_phases` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `onboarding_methods` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `onboardingFlowId` to the `organization_onboardings` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `onboarding_method_phases` DROP FOREIGN KEY `onboarding_method_phases_documentationPlanId_fkey`;

-- DropForeignKey
ALTER TABLE `onboarding_method_phases` DROP FOREIGN KEY `onboarding_method_phases_gatePlanId_fkey`;

-- DropForeignKey
ALTER TABLE `onboarding_method_phases` DROP FOREIGN KEY `onboarding_method_phases_onboardingMethodId_fkey`;

-- DropForeignKey
ALTER TABLE `onboarding_method_phases` DROP FOREIGN KEY `onboarding_method_phases_questionnairePlanId_fkey`;

-- DropForeignKey
ALTER TABLE `onboarding_method_phases` DROP FOREIGN KEY `onboarding_method_phases_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `onboarding_methods` DROP FOREIGN KEY `onboarding_methods_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `onboarding_phases` DROP FOREIGN KEY `onboarding_phases_phaseTemplateId_fkey`;

-- DropForeignKey
ALTER TABLE `organization_onboardings` DROP FOREIGN KEY `organization_onboardings_onboardingMethodId_fkey`;

-- DropForeignKey
ALTER TABLE `organization_types` DROP FOREIGN KEY `organization_types_onboardingMethodId_fkey`;

-- DropIndex
DROP INDEX `organization_onboardings_onboardingMethodId_idx` ON `organization_onboardings`;

-- DropIndex
DROP INDEX `organization_types_onboardingMethodId_idx` ON `organization_types`;

-- AlterTable
ALTER TABLE `organization_onboardings` DROP COLUMN `onboardingMethodId`,
    ADD COLUMN `onboardingFlowId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `organization_types` DROP COLUMN `onboardingMethodId`,
    ADD COLUMN `onboardingFlowId` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `onboarding_method_phases`;

-- DropTable
DROP TABLE `onboarding_methods`;

-- CreateTable
CREATE TABLE `onboarding_flows` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `autoActivatePhases` BOOLEAN NOT NULL DEFAULT true,
    `expiresInDays` INTEGER NULL DEFAULT 30,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `onboarding_flows_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `onboarding_flows_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_flow_phases` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `onboardingFlowId` VARCHAR(191) NOT NULL,
    `questionnairePlanId` VARCHAR(191) NULL,
    `documentationPlanId` VARCHAR(191) NULL,
    `gatePlanId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `phaseCategory` ENUM('QUESTIONNAIRE', 'DOCUMENTATION', 'PAYMENT', 'GATE') NOT NULL,
    `phaseType` ENUM('PRE_APPROVAL', 'UNDERWRITING', 'KYC', 'VERIFICATION', 'DOWNPAYMENT', 'MORTGAGE', 'BALLOON', 'APPROVAL_GATE', 'ORG_KYB', 'ORG_VERIFICATION', 'CUSTOM') NOT NULL,
    `order` INTEGER NOT NULL,
    `requiresPreviousPhaseCompletion` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `onboarding_flow_phases_tenantId_idx`(`tenantId`),
    INDEX `onboarding_flow_phases_onboardingFlowId_idx`(`onboardingFlowId`),
    INDEX `onboarding_flow_phases_questionnairePlanId_idx`(`questionnairePlanId`),
    INDEX `onboarding_flow_phases_documentationPlanId_idx`(`documentationPlanId`),
    INDEX `onboarding_flow_phases_gatePlanId_idx`(`gatePlanId`),
    INDEX `onboarding_flow_phases_phaseCategory_idx`(`phaseCategory`),
    UNIQUE INDEX `onboarding_flow_phases_onboardingFlowId_order_key`(`onboardingFlowId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `organization_onboardings_onboardingFlowId_idx` ON `organization_onboardings`(`onboardingFlowId`);

-- CreateIndex
CREATE INDEX `organization_types_onboardingFlowId_idx` ON `organization_types`(`onboardingFlowId`);

-- AddForeignKey
ALTER TABLE `organization_types` ADD CONSTRAINT `organization_types_onboardingFlowId_fkey` FOREIGN KEY (`onboardingFlowId`) REFERENCES `onboarding_flows`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_flows` ADD CONSTRAINT `onboarding_flows_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_flow_phases` ADD CONSTRAINT `onboarding_flow_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_flow_phases` ADD CONSTRAINT `onboarding_flow_phases_onboardingFlowId_fkey` FOREIGN KEY (`onboardingFlowId`) REFERENCES `onboarding_flows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_flow_phases` ADD CONSTRAINT `onboarding_flow_phases_questionnairePlanId_fkey` FOREIGN KEY (`questionnairePlanId`) REFERENCES `questionnaire_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_flow_phases` ADD CONSTRAINT `onboarding_flow_phases_documentationPlanId_fkey` FOREIGN KEY (`documentationPlanId`) REFERENCES `documentation_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_flow_phases` ADD CONSTRAINT `onboarding_flow_phases_gatePlanId_fkey` FOREIGN KEY (`gatePlanId`) REFERENCES `gate_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_onboardings` ADD CONSTRAINT `organization_onboardings_onboardingFlowId_fkey` FOREIGN KEY (`onboardingFlowId`) REFERENCES `onboarding_flows`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_phases` ADD CONSTRAINT `onboarding_phases_phaseTemplateId_fkey` FOREIGN KEY (`phaseTemplateId`) REFERENCES `onboarding_flow_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
