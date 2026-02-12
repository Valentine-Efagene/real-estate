/*
  Warnings:

  - A unique constraint covering the columns `[qualificationPhaseId]` on the table `documentation_phases` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[qualificationPhaseId]` on the table `gate_phases` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[qualificationPhaseId]` on the table `questionnaire_phases` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `documentation_phases` ADD COLUMN `qualificationPhaseId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `gate_phases` ADD COLUMN `qualificationPhaseId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `property_payment_methods` ADD COLUMN `qualificationFlowId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `questionnaire_phases` ADD COLUMN `qualificationPhaseId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `qualification_flows` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `autoActivatePhases` BOOLEAN NOT NULL DEFAULT true,
    `expiresInDays` INTEGER NULL DEFAULT 90,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `qualification_flows_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `qualification_flows_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qualification_flow_phases` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `qualificationFlowId` VARCHAR(191) NOT NULL,
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

    INDEX `qualification_flow_phases_tenantId_idx`(`tenantId`),
    INDEX `qualification_flow_phases_qualificationFlowId_idx`(`qualificationFlowId`),
    INDEX `qualification_flow_phases_questionnairePlanId_idx`(`questionnairePlanId`),
    INDEX `qualification_flow_phases_documentationPlanId_idx`(`documentationPlanId`),
    INDEX `qualification_flow_phases_gatePlanId_idx`(`gatePlanId`),
    INDEX `qualification_flow_phases_phaseCategory_idx`(`phaseCategory`),
    UNIQUE INDEX `qualification_flow_phases_qualificationFlowId_order_key`(`qualificationFlowId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_payment_methods` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `paymentMethodId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'QUALIFIED', 'REJECTED', 'SUSPENDED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `qualifiedAt` DATETIME(3) NULL,
    `suspendedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `organization_payment_methods_tenantId_idx`(`tenantId`),
    INDEX `organization_payment_methods_organizationId_idx`(`organizationId`),
    INDEX `organization_payment_methods_paymentMethodId_idx`(`paymentMethodId`),
    INDEX `organization_payment_methods_status_idx`(`status`),
    UNIQUE INDEX `organization_payment_methods_organizationId_paymentMethodId_key`(`organizationId`, `paymentMethodId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_method_qualifications` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `organizationPaymentMethodId` VARCHAR(191) NOT NULL,
    `qualificationFlowId` VARCHAR(191) NOT NULL,
    `templateSnapshot` JSON NULL,
    `assigneeId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `currentPhaseId` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedById` VARCHAR(191) NULL,
    `rejectionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_method_qualifications_organizationPaymentMethodId_key`(`organizationPaymentMethodId`),
    UNIQUE INDEX `payment_method_qualifications_currentPhaseId_key`(`currentPhaseId`),
    INDEX `payment_method_qualifications_tenantId_idx`(`tenantId`),
    INDEX `payment_method_qualifications_organizationPaymentMethodId_idx`(`organizationPaymentMethodId`),
    INDEX `payment_method_qualifications_qualificationFlowId_idx`(`qualificationFlowId`),
    INDEX `payment_method_qualifications_assigneeId_idx`(`assigneeId`),
    INDEX `payment_method_qualifications_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qualification_phases` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `qualificationId` VARCHAR(191) NOT NULL,
    `phaseTemplateId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `phaseCategory` ENUM('QUESTIONNAIRE', 'DOCUMENTATION', 'PAYMENT', 'GATE') NOT NULL,
    `phaseType` ENUM('PRE_APPROVAL', 'UNDERWRITING', 'KYC', 'VERIFICATION', 'DOWNPAYMENT', 'MORTGAGE', 'BALLOON', 'APPROVAL_GATE', 'ORG_KYB', 'ORG_VERIFICATION', 'CUSTOM') NOT NULL,
    `order` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'ACTIVE', 'COMPLETED', 'SKIPPED', 'FAILED', 'SUPERSEDED') NOT NULL DEFAULT 'PENDING',
    `activatedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `requiresPreviousPhaseCompletion` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `qualification_phases_tenantId_idx`(`tenantId`),
    INDEX `qualification_phases_qualificationId_idx`(`qualificationId`),
    INDEX `qualification_phases_phaseTemplateId_idx`(`phaseTemplateId`),
    INDEX `qualification_phases_phaseCategory_idx`(`phaseCategory`),
    INDEX `qualification_phases_status_idx`(`status`),
    UNIQUE INDEX `qualification_phases_qualificationId_order_key`(`qualificationId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `documentation_phases_qualificationPhaseId_key` ON `documentation_phases`(`qualificationPhaseId`);

-- CreateIndex
CREATE INDEX `documentation_phases_qualificationPhaseId_idx` ON `documentation_phases`(`qualificationPhaseId`);

-- CreateIndex
CREATE UNIQUE INDEX `gate_phases_qualificationPhaseId_key` ON `gate_phases`(`qualificationPhaseId`);

-- CreateIndex
CREATE INDEX `gate_phases_qualificationPhaseId_idx` ON `gate_phases`(`qualificationPhaseId`);

-- CreateIndex
CREATE INDEX `property_payment_methods_qualificationFlowId_idx` ON `property_payment_methods`(`qualificationFlowId`);

-- CreateIndex
CREATE UNIQUE INDEX `questionnaire_phases_qualificationPhaseId_key` ON `questionnaire_phases`(`qualificationPhaseId`);

-- CreateIndex
CREATE INDEX `questionnaire_phases_qualificationPhaseId_idx` ON `questionnaire_phases`(`qualificationPhaseId`);

-- AddForeignKey
ALTER TABLE `property_payment_methods` ADD CONSTRAINT `property_payment_methods_qualificationFlowId_fkey` FOREIGN KEY (`qualificationFlowId`) REFERENCES `qualification_flows`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_phases` ADD CONSTRAINT `questionnaire_phases_qualificationPhaseId_fkey` FOREIGN KEY (`qualificationPhaseId`) REFERENCES `qualification_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gate_phases` ADD CONSTRAINT `gate_phases_qualificationPhaseId_fkey` FOREIGN KEY (`qualificationPhaseId`) REFERENCES `qualification_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_phases` ADD CONSTRAINT `documentation_phases_qualificationPhaseId_fkey` FOREIGN KEY (`qualificationPhaseId`) REFERENCES `qualification_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qualification_flows` ADD CONSTRAINT `qualification_flows_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qualification_flow_phases` ADD CONSTRAINT `qualification_flow_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qualification_flow_phases` ADD CONSTRAINT `qualification_flow_phases_qualificationFlowId_fkey` FOREIGN KEY (`qualificationFlowId`) REFERENCES `qualification_flows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qualification_flow_phases` ADD CONSTRAINT `qualification_flow_phases_questionnairePlanId_fkey` FOREIGN KEY (`questionnairePlanId`) REFERENCES `questionnaire_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qualification_flow_phases` ADD CONSTRAINT `qualification_flow_phases_documentationPlanId_fkey` FOREIGN KEY (`documentationPlanId`) REFERENCES `documentation_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qualification_flow_phases` ADD CONSTRAINT `qualification_flow_phases_gatePlanId_fkey` FOREIGN KEY (`gatePlanId`) REFERENCES `gate_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_payment_methods` ADD CONSTRAINT `organization_payment_methods_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_payment_methods` ADD CONSTRAINT `organization_payment_methods_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_payment_methods` ADD CONSTRAINT `organization_payment_methods_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_qualifications` ADD CONSTRAINT `payment_method_qualifications_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_qualifications` ADD CONSTRAINT `payment_method_qualifications_organizationPaymentMethodId_fkey` FOREIGN KEY (`organizationPaymentMethodId`) REFERENCES `organization_payment_methods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_qualifications` ADD CONSTRAINT `payment_method_qualifications_qualificationFlowId_fkey` FOREIGN KEY (`qualificationFlowId`) REFERENCES `qualification_flows`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_qualifications` ADD CONSTRAINT `payment_method_qualifications_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_qualifications` ADD CONSTRAINT `payment_method_qualifications_currentPhaseId_fkey` FOREIGN KEY (`currentPhaseId`) REFERENCES `qualification_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_qualifications` ADD CONSTRAINT `payment_method_qualifications_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qualification_phases` ADD CONSTRAINT `qualification_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qualification_phases` ADD CONSTRAINT `qualification_phases_qualificationId_fkey` FOREIGN KEY (`qualificationId`) REFERENCES `payment_method_qualifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qualification_phases` ADD CONSTRAINT `qualification_phases_phaseTemplateId_fkey` FOREIGN KEY (`phaseTemplateId`) REFERENCES `qualification_flow_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
