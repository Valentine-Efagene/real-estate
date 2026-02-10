/*
  Warnings:

  - A unique constraint covering the columns `[onboardingPhaseId]` on the table `documentation_phases` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[onboardingPhaseId]` on the table `questionnaire_phases` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `application_documents` MODIFY `expectedUploader` ENUM('CUSTOMER', 'LENDER', 'DEVELOPER', 'LEGAL', 'INSURER', 'PLATFORM', 'ORGANIZATION_ONBOARDER') NULL;

-- AlterTable
ALTER TABLE `application_phases` MODIFY `phaseCategory` ENUM('QUESTIONNAIRE', 'DOCUMENTATION', 'PAYMENT', 'GATE') NOT NULL,
    MODIFY `phaseType` ENUM('PRE_APPROVAL', 'UNDERWRITING', 'KYC', 'VERIFICATION', 'DOWNPAYMENT', 'MORTGAGE', 'BALLOON', 'APPROVAL_GATE', 'ORG_KYB', 'ORG_VERIFICATION', 'CUSTOM') NOT NULL;

-- AlterTable
ALTER TABLE `document_definitions` MODIFY `uploadedBy` ENUM('CUSTOMER', 'LENDER', 'DEVELOPER', 'LEGAL', 'INSURER', 'PLATFORM', 'ORGANIZATION_ONBOARDER') NOT NULL DEFAULT 'CUSTOMER';

-- AlterTable
ALTER TABLE `documentation_phases` ADD COLUMN `onboardingPhaseId` VARCHAR(191) NULL,
    MODIFY `phaseId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `organization_invitations` ADD COLUMN `isOnboarder` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `organization_types` ADD COLUMN `onboardingMethodId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `property_payment_method_phases` ADD COLUMN `gatePlanId` VARCHAR(191) NULL,
    MODIFY `phaseCategory` ENUM('QUESTIONNAIRE', 'DOCUMENTATION', 'PAYMENT', 'GATE') NOT NULL,
    MODIFY `phaseType` ENUM('PRE_APPROVAL', 'UNDERWRITING', 'KYC', 'VERIFICATION', 'DOWNPAYMENT', 'MORTGAGE', 'BALLOON', 'APPROVAL_GATE', 'ORG_KYB', 'ORG_VERIFICATION', 'CUSTOM') NOT NULL;

-- AlterTable
ALTER TABLE `questionnaire_phases` ADD COLUMN `onboardingPhaseId` VARCHAR(191) NULL,
    MODIFY `phaseId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `questionnaire_plan_questions` MODIFY `category` ENUM('ELIGIBILITY', 'EMPLOYMENT', 'INCOME', 'AFFORDABILITY', 'EXPENSES', 'APPLICATION_TYPE', 'PERSONAL', 'PREFERENCES', 'PROPERTY', 'CREDIT', 'ASSETS', 'CUSTOM', 'CONTACTS', 'ORGANIZATION', 'COMPLIANCE', 'KYB') NULL;

-- CreateTable
CREATE TABLE `onboarding_methods` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `autoActivatePhases` BOOLEAN NOT NULL DEFAULT true,
    `expiresInDays` INTEGER NULL DEFAULT 30,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `onboarding_methods_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `onboarding_methods_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_method_phases` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `onboardingMethodId` VARCHAR(191) NOT NULL,
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

    INDEX `onboarding_method_phases_tenantId_idx`(`tenantId`),
    INDEX `onboarding_method_phases_onboardingMethodId_idx`(`onboardingMethodId`),
    INDEX `onboarding_method_phases_questionnairePlanId_idx`(`questionnairePlanId`),
    INDEX `onboarding_method_phases_documentationPlanId_idx`(`documentationPlanId`),
    INDEX `onboarding_method_phases_gatePlanId_idx`(`gatePlanId`),
    INDEX `onboarding_method_phases_phaseCategory_idx`(`phaseCategory`),
    UNIQUE INDEX `onboarding_method_phases_onboardingMethodId_order_key`(`onboardingMethodId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_onboardings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `onboardingMethodId` VARCHAR(191) NOT NULL,
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

    UNIQUE INDEX `organization_onboardings_organizationId_key`(`organizationId`),
    UNIQUE INDEX `organization_onboardings_currentPhaseId_key`(`currentPhaseId`),
    INDEX `organization_onboardings_tenantId_idx`(`tenantId`),
    INDEX `organization_onboardings_organizationId_idx`(`organizationId`),
    INDEX `organization_onboardings_onboardingMethodId_idx`(`onboardingMethodId`),
    INDEX `organization_onboardings_assigneeId_idx`(`assigneeId`),
    INDEX `organization_onboardings_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_phases` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `onboardingId` VARCHAR(191) NOT NULL,
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

    INDEX `onboarding_phases_tenantId_idx`(`tenantId`),
    INDEX `onboarding_phases_onboardingId_idx`(`onboardingId`),
    INDEX `onboarding_phases_phaseTemplateId_idx`(`phaseTemplateId`),
    INDEX `onboarding_phases_phaseCategory_idx`(`phaseCategory`),
    INDEX `onboarding_phases_status_idx`(`status`),
    UNIQUE INDEX `onboarding_phases_onboardingId_order_key`(`onboardingId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gate_plans` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `requiredApprovals` INTEGER NOT NULL DEFAULT 1,
    `reviewerOrganizationTypeId` VARCHAR(191) NOT NULL,
    `reviewerInstructions` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `gate_plans_tenantId_idx`(`tenantId`),
    INDEX `gate_plans_reviewerOrganizationTypeId_idx`(`reviewerOrganizationTypeId`),
    UNIQUE INDEX `gate_plans_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gate_phases` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `applicationPhaseId` VARCHAR(191) NULL,
    `onboardingPhaseId` VARCHAR(191) NULL,
    `gatePlanId` VARCHAR(191) NULL,
    `requiredApprovals` INTEGER NOT NULL DEFAULT 1,
    `reviewerOrganizationTypeId` VARCHAR(191) NOT NULL,
    `reviewerInstructions` TEXT NULL,
    `approvalCount` INTEGER NOT NULL DEFAULT 0,
    `rejectionCount` INTEGER NOT NULL DEFAULT 0,
    `rejectionReason` TEXT NULL,
    `gatePlanSnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `gate_phases_applicationPhaseId_key`(`applicationPhaseId`),
    UNIQUE INDEX `gate_phases_onboardingPhaseId_key`(`onboardingPhaseId`),
    INDEX `gate_phases_tenantId_idx`(`tenantId`),
    INDEX `gate_phases_applicationPhaseId_idx`(`applicationPhaseId`),
    INDEX `gate_phases_onboardingPhaseId_idx`(`onboardingPhaseId`),
    INDEX `gate_phases_gatePlanId_idx`(`gatePlanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gate_phase_reviews` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `gatePhaseId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NOT NULL,
    `decision` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'WAIVED', 'REVERTED') NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gate_phase_reviews_tenantId_idx`(`tenantId`),
    INDEX `gate_phase_reviews_gatePhaseId_idx`(`gatePhaseId`),
    INDEX `gate_phase_reviews_reviewerId_idx`(`reviewerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `documentation_phases_onboardingPhaseId_key` ON `documentation_phases`(`onboardingPhaseId`);

-- CreateIndex
CREATE INDEX `documentation_phases_onboardingPhaseId_idx` ON `documentation_phases`(`onboardingPhaseId`);

-- CreateIndex
CREATE INDEX `organization_types_onboardingMethodId_idx` ON `organization_types`(`onboardingMethodId`);

-- CreateIndex
CREATE INDEX `property_payment_method_phases_gatePlanId_idx` ON `property_payment_method_phases`(`gatePlanId`);

-- CreateIndex
CREATE UNIQUE INDEX `questionnaire_phases_onboardingPhaseId_key` ON `questionnaire_phases`(`onboardingPhaseId`);

-- CreateIndex
CREATE INDEX `questionnaire_phases_onboardingPhaseId_idx` ON `questionnaire_phases`(`onboardingPhaseId`);

-- AddForeignKey
ALTER TABLE `organization_types` ADD CONSTRAINT `organization_types_onboardingMethodId_fkey` FOREIGN KEY (`onboardingMethodId`) REFERENCES `onboarding_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_methods` ADD CONSTRAINT `onboarding_methods_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_method_phases` ADD CONSTRAINT `onboarding_method_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_method_phases` ADD CONSTRAINT `onboarding_method_phases_onboardingMethodId_fkey` FOREIGN KEY (`onboardingMethodId`) REFERENCES `onboarding_methods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_method_phases` ADD CONSTRAINT `onboarding_method_phases_questionnairePlanId_fkey` FOREIGN KEY (`questionnairePlanId`) REFERENCES `questionnaire_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_method_phases` ADD CONSTRAINT `onboarding_method_phases_documentationPlanId_fkey` FOREIGN KEY (`documentationPlanId`) REFERENCES `documentation_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_method_phases` ADD CONSTRAINT `onboarding_method_phases_gatePlanId_fkey` FOREIGN KEY (`gatePlanId`) REFERENCES `gate_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_onboardings` ADD CONSTRAINT `organization_onboardings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_onboardings` ADD CONSTRAINT `organization_onboardings_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_onboardings` ADD CONSTRAINT `organization_onboardings_onboardingMethodId_fkey` FOREIGN KEY (`onboardingMethodId`) REFERENCES `onboarding_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_onboardings` ADD CONSTRAINT `organization_onboardings_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_onboardings` ADD CONSTRAINT `organization_onboardings_currentPhaseId_fkey` FOREIGN KEY (`currentPhaseId`) REFERENCES `onboarding_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_onboardings` ADD CONSTRAINT `organization_onboardings_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_phases` ADD CONSTRAINT `onboarding_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_phases` ADD CONSTRAINT `onboarding_phases_onboardingId_fkey` FOREIGN KEY (`onboardingId`) REFERENCES `organization_onboardings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_phases` ADD CONSTRAINT `onboarding_phases_phaseTemplateId_fkey` FOREIGN KEY (`phaseTemplateId`) REFERENCES `onboarding_method_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gate_plans` ADD CONSTRAINT `gate_plans_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gate_plans` ADD CONSTRAINT `gate_plans_reviewerOrganizationTypeId_fkey` FOREIGN KEY (`reviewerOrganizationTypeId`) REFERENCES `organization_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_phases` ADD CONSTRAINT `property_payment_method_phases_gatePlanId_fkey` FOREIGN KEY (`gatePlanId`) REFERENCES `gate_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_phases` ADD CONSTRAINT `questionnaire_phases_onboardingPhaseId_fkey` FOREIGN KEY (`onboardingPhaseId`) REFERENCES `onboarding_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gate_phases` ADD CONSTRAINT `gate_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gate_phases` ADD CONSTRAINT `gate_phases_applicationPhaseId_fkey` FOREIGN KEY (`applicationPhaseId`) REFERENCES `application_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gate_phases` ADD CONSTRAINT `gate_phases_onboardingPhaseId_fkey` FOREIGN KEY (`onboardingPhaseId`) REFERENCES `onboarding_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gate_phases` ADD CONSTRAINT `gate_phases_gatePlanId_fkey` FOREIGN KEY (`gatePlanId`) REFERENCES `gate_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gate_phases` ADD CONSTRAINT `gate_phases_reviewerOrganizationTypeId_fkey` FOREIGN KEY (`reviewerOrganizationTypeId`) REFERENCES `organization_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gate_phase_reviews` ADD CONSTRAINT `gate_phase_reviews_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gate_phase_reviews` ADD CONSTRAINT `gate_phase_reviews_gatePhaseId_fkey` FOREIGN KEY (`gatePhaseId`) REFERENCES `gate_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gate_phase_reviews` ADD CONSTRAINT `gate_phase_reviews_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_phases` ADD CONSTRAINT `documentation_phases_onboardingPhaseId_fkey` FOREIGN KEY (`onboardingPhaseId`) REFERENCES `onboarding_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
