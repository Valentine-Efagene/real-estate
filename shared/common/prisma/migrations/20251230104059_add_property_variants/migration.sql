/*
  Warnings:

  - You are about to drop the column `paymentPlanId` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `propertyId` on the `contracts` table. All the data in the column will be lost.
  - You are about to drop the column `buyerId` on the `payment_plans` table. All the data in the column will be lost.
  - You are about to drop the column `downPaymentAmount` on the `payment_plans` table. All the data in the column will be lost.
  - You are about to drop the column `downPaymentPaid` on the `payment_plans` table. All the data in the column will be lost.
  - You are about to drop the column `interestRate` on the `payment_plans` table. All the data in the column will be lost.
  - You are about to drop the column `planType` on the `payment_plans` table. All the data in the column will be lost.
  - You are about to drop the column `principalAmount` on the `payment_plans` table. All the data in the column will be lost.
  - You are about to drop the column `propertyId` on the `payment_plans` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `payment_plans` table. All the data in the column will be lost.
  - You are about to drop the column `stateMetadata` on the `payment_plans` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `payment_plans` table. All the data in the column will be lost.
  - You are about to drop the column `totalInterest` on the `payment_plans` table. All the data in the column will be lost.
  - You are about to drop the column `area` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `nBathrooms` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `nBedrooms` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `nParkingSpots` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the `mortgage_documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mortgage_downpayment_installments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mortgage_downpayment_payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mortgage_downpayment_plans` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mortgage_steps` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mortgage_transition_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mortgage_transitions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mortgage_types` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mortgages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_installments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_schedules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `payment_plans` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `propertyUnitId` to the `contracts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `contracts` table without a default value. This is not possible if the table is not empty.
  - Made the column `buyerId` on table `contracts` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `numberOfInstallments` to the `payment_plans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentFrequency` to the `payment_plans` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `contracts` DROP FOREIGN KEY `contracts_buyerId_fkey`;

-- DropForeignKey
ALTER TABLE `contracts` DROP FOREIGN KEY `contracts_paymentPlanId_fkey`;

-- DropForeignKey
ALTER TABLE `contracts` DROP FOREIGN KEY `contracts_propertyId_fkey`;

-- DropForeignKey
ALTER TABLE `mortgage_documents` DROP FOREIGN KEY `mortgage_documents_mortgageId_fkey`;

-- DropForeignKey
ALTER TABLE `mortgage_downpayment_installments` DROP FOREIGN KEY `mortgage_downpayment_installments_planId_fkey`;

-- DropForeignKey
ALTER TABLE `mortgage_downpayment_payments` DROP FOREIGN KEY `mortgage_downpayment_payments_planId_fkey`;

-- DropForeignKey
ALTER TABLE `mortgage_steps` DROP FOREIGN KEY `mortgage_steps_mortgageId_fkey`;

-- DropForeignKey
ALTER TABLE `mortgage_transition_events` DROP FOREIGN KEY `mortgage_transition_events_mortgageId_fkey`;

-- DropForeignKey
ALTER TABLE `mortgage_transitions` DROP FOREIGN KEY `mortgage_transitions_mortgageId_fkey`;

-- DropForeignKey
ALTER TABLE `mortgages` DROP FOREIGN KEY `mortgages_borrowerId_fkey`;

-- DropForeignKey
ALTER TABLE `mortgages` DROP FOREIGN KEY `mortgages_downpaymentPlanId_fkey`;

-- DropForeignKey
ALTER TABLE `mortgages` DROP FOREIGN KEY `mortgages_mortgageTypeId_fkey`;

-- DropForeignKey
ALTER TABLE `mortgages` DROP FOREIGN KEY `mortgages_propertyId_fkey`;

-- DropForeignKey
ALTER TABLE `payment_installments` DROP FOREIGN KEY `payment_installments_scheduleId_fkey`;

-- DropForeignKey
ALTER TABLE `payment_plans` DROP FOREIGN KEY `payment_plans_buyerId_fkey`;

-- DropForeignKey
ALTER TABLE `payment_plans` DROP FOREIGN KEY `payment_plans_propertyId_fkey`;

-- DropForeignKey
ALTER TABLE `payment_schedules` DROP FOREIGN KEY `payment_schedules_planId_fkey`;

-- DropForeignKey
ALTER TABLE `payments` DROP FOREIGN KEY `payments_installmentId_fkey`;

-- DropForeignKey
ALTER TABLE `payments` DROP FOREIGN KEY `payments_payerId_fkey`;

-- DropForeignKey
ALTER TABLE `payments` DROP FOREIGN KEY `payments_planId_fkey`;

-- DropForeignKey
ALTER TABLE `payments` DROP FOREIGN KEY `payments_scheduleId_fkey`;

-- DropIndex
DROP INDEX `contracts_paymentPlanId_key` ON `contracts`;

-- DropIndex
DROP INDEX `contracts_propertyId_idx` ON `contracts`;

-- DropIndex
DROP INDEX `payment_plans_buyerId_idx` ON `payment_plans`;

-- DropIndex
DROP INDEX `payment_plans_propertyId_idx` ON `payment_plans`;

-- DropIndex
DROP INDEX `payment_plans_state_idx` ON `payment_plans`;

-- AlterTable
ALTER TABLE `amenities` ADD COLUMN `category` VARCHAR(191) NULL,
    ADD COLUMN `icon` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `contract_documents` ADD COLUMN `phaseId` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `stepId` VARCHAR(191) NULL,
    ADD COLUMN `uploadedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `contracts` DROP COLUMN `paymentPlanId`,
    DROP COLUMN `propertyId`,
    ADD COLUMN `currentPhaseId` VARCHAR(191) NULL,
    ADD COLUMN `downPayment` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `downPaymentPaid` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `interestRate` DOUBLE NULL,
    ADD COLUMN `lastReminderSentAt` DATETIME(3) NULL,
    ADD COLUMN `nextPaymentDueDate` DATETIME(3) NULL,
    ADD COLUMN `paymentMethodId` VARCHAR(191) NULL,
    ADD COLUMN `periodicPayment` DOUBLE NULL,
    ADD COLUMN `principal` DOUBLE NULL,
    ADD COLUMN `propertyUnitId` VARCHAR(191) NOT NULL,
    ADD COLUMN `state` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN `termMonths` INTEGER NULL,
    ADD COLUMN `totalAmount` DOUBLE NOT NULL,
    ADD COLUMN `totalInterestPaid` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `totalPaidToDate` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `buyerId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `payment_plans` DROP COLUMN `buyerId`,
    DROP COLUMN `downPaymentAmount`,
    DROP COLUMN `downPaymentPaid`,
    DROP COLUMN `interestRate`,
    DROP COLUMN `planType`,
    DROP COLUMN `principalAmount`,
    DROP COLUMN `propertyId`,
    DROP COLUMN `state`,
    DROP COLUMN `stateMetadata`,
    DROP COLUMN `totalAmount`,
    DROP COLUMN `totalInterest`,
    ADD COLUMN `calculateInterestDaily` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `customFrequencyDays` INTEGER NULL,
    ADD COLUMN `gracePeriodDays` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `numberOfInstallments` INTEGER NOT NULL,
    ADD COLUMN `paymentFrequency` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `properties` DROP COLUMN `area`,
    DROP COLUMN `nBathrooms`,
    DROP COLUMN `nBedrooms`,
    DROP COLUMN `nParkingSpots`,
    DROP COLUMN `price`;

-- DropTable
DROP TABLE `mortgage_documents`;

-- DropTable
DROP TABLE `mortgage_downpayment_installments`;

-- DropTable
DROP TABLE `mortgage_downpayment_payments`;

-- DropTable
DROP TABLE `mortgage_downpayment_plans`;

-- DropTable
DROP TABLE `mortgage_steps`;

-- DropTable
DROP TABLE `mortgage_transition_events`;

-- DropTable
DROP TABLE `mortgage_transitions`;

-- DropTable
DROP TABLE `mortgage_types`;

-- DropTable
DROP TABLE `mortgages`;

-- DropTable
DROP TABLE `payment_installments`;

-- DropTable
DROP TABLE `payment_schedules`;

-- DropTable
DROP TABLE `payments`;

-- CreateTable
CREATE TABLE `property_variants` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `nBedrooms` INTEGER NULL,
    `nBathrooms` INTEGER NULL,
    `nParkingSpots` INTEGER NULL,
    `area` DOUBLE NULL,
    `price` DOUBLE NOT NULL,
    `pricePerSqm` DOUBLE NULL,
    `totalUnits` INTEGER NOT NULL DEFAULT 1,
    `availableUnits` INTEGER NOT NULL DEFAULT 1,
    `reservedUnits` INTEGER NOT NULL DEFAULT 0,
    `soldUnits` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'AVAILABLE',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `property_variants_propertyId_idx`(`propertyId`),
    INDEX `property_variants_status_idx`(`status`),
    INDEX `property_variants_price_idx`(`price`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_variant_amenities` (
    `variantId` VARCHAR(191) NOT NULL,
    `amenityId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`variantId`, `amenityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_variant_media` (
    `id` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `caption` VARCHAR(191) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `property_variant_media_variantId_idx`(`variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_units` (
    `id` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `unitNumber` VARCHAR(191) NOT NULL,
    `floorNumber` INTEGER NULL,
    `blockName` VARCHAR(191) NULL,
    `priceOverride` DOUBLE NULL,
    `areaOverride` DOUBLE NULL,
    `notes` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'AVAILABLE',
    `reservedAt` DATETIME(3) NULL,
    `reservedUntil` DATETIME(3) NULL,
    `reservedById` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `property_units_variantId_idx`(`variantId`),
    INDEX `property_units_status_idx`(`status`),
    UNIQUE INDEX `property_units_variantId_unitNumber_key`(`variantId`, `unitNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_payment_methods` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `allowEarlyPayoff` BOOLEAN NOT NULL DEFAULT true,
    `earlyPayoffPenaltyRate` DOUBLE NULL,
    `autoActivatePhases` BOOLEAN NOT NULL DEFAULT true,
    `requiresManualApproval` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_payment_method_links` (
    `propertyId` VARCHAR(191) NOT NULL,
    `paymentMethodId` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`propertyId`, `paymentMethodId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_payment_method_phases` (
    `id` VARCHAR(191) NOT NULL,
    `paymentMethodId` VARCHAR(191) NOT NULL,
    `paymentPlanId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `phaseCategory` VARCHAR(191) NOT NULL,
    `phaseType` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `interestRate` DOUBLE NULL,
    `percentOfPrice` DOUBLE NULL,
    `requiresPreviousPhaseCompletion` BOOLEAN NOT NULL DEFAULT true,
    `minimumCompletionPercentage` DOUBLE NULL,
    `requiredDocumentTypes` VARCHAR(191) NULL,
    `stepDefinitions` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `property_payment_method_phases_paymentMethodId_idx`(`paymentMethodId`),
    INDEX `property_payment_method_phases_paymentPlanId_idx`(`paymentPlanId`),
    INDEX `property_payment_method_phases_phaseCategory_idx`(`phaseCategory`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_phases` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `paymentPlanId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `phaseCategory` VARCHAR(191) NOT NULL,
    `phaseType` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `totalAmount` DOUBLE NULL,
    `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    `remainingAmount` DOUBLE NULL,
    `interestRate` DOUBLE NULL,
    `dueDate` DATETIME(3) NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `activatedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `requiresPreviousPhaseCompletion` BOOLEAN NOT NULL DEFAULT true,
    `minimumCompletionPercentage` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `contract_phases_contractId_idx`(`contractId`),
    INDEX `contract_phases_paymentPlanId_idx`(`paymentPlanId`),
    INDEX `contract_phases_phaseCategory_idx`(`phaseCategory`),
    INDEX `contract_phases_status_idx`(`status`),
    INDEX `contract_phases_order_idx`(`order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_phase_steps` (
    `id` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `stepType` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `assigneeId` VARCHAR(191) NULL,
    `requiredDocumentTypes` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `contract_phase_steps_phaseId_idx`(`phaseId`),
    INDEX `contract_phase_steps_status_idx`(`status`),
    INDEX `contract_phase_steps_order_idx`(`order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_phase_step_approvals` (
    `id` VARCHAR(191) NOT NULL,
    `stepId` VARCHAR(191) NOT NULL,
    `approverId` VARCHAR(191) NULL,
    `decision` VARCHAR(191) NOT NULL,
    `comment` TEXT NULL,
    `decidedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_phase_step_approvals_stepId_idx`(`stepId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_installments` (
    `id` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `installmentNumber` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `principalAmount` DOUBLE NOT NULL DEFAULT 0,
    `interestAmount` DOUBLE NOT NULL DEFAULT 0,
    `dueDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    `paidDate` DATETIME(3) NULL,
    `lateFee` DOUBLE NOT NULL DEFAULT 0,
    `lateFeeWaived` BOOLEAN NOT NULL DEFAULT false,
    `gracePeriodDays` INTEGER NOT NULL DEFAULT 0,
    `gracePeriodEndDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `contract_installments_phaseId_idx`(`phaseId`),
    INDEX `contract_installments_dueDate_idx`(`dueDate`),
    INDEX `contract_installments_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_payments` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NULL,
    `installmentId` VARCHAR(191) NULL,
    `payerId` VARCHAR(191) NULL,
    `amount` DOUBLE NOT NULL,
    `principalAmount` DOUBLE NOT NULL DEFAULT 0,
    `interestAmount` DOUBLE NOT NULL DEFAULT 0,
    `lateFeeAmount` DOUBLE NOT NULL DEFAULT 0,
    `paymentMethod` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'INITIATED',
    `reference` VARCHAR(191) NULL,
    `gatewayResponse` TEXT NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contract_payments_reference_key`(`reference`),
    INDEX `contract_payments_contractId_idx`(`contractId`),
    INDEX `contract_payments_phaseId_idx`(`phaseId`),
    INDEX `contract_payments_installmentId_idx`(`installmentId`),
    INDEX `contract_payments_payerId_idx`(`payerId`),
    INDEX `contract_payments_status_idx`(`status`),
    INDEX `contract_payments_reference_idx`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_transitions` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `fromState` VARCHAR(191) NOT NULL,
    `toState` VARCHAR(191) NOT NULL,
    `trigger` VARCHAR(191) NOT NULL,
    `metadata` TEXT NULL,
    `transitionedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_transitions_contractId_idx`(`contractId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_events` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `data` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_events_contractId_idx`(`contractId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `domain_events` (
    `id` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `aggregateType` VARCHAR(191) NOT NULL,
    `aggregateId` VARCHAR(191) NOT NULL,
    `queueName` VARCHAR(191) NOT NULL,
    `payload` TEXT NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actorId` VARCHAR(191) NULL,
    `actorRole` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `processedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `failureCount` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `nextRetryAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `domain_events_status_nextRetryAt_idx`(`status`, `nextRetryAt`),
    INDEX `domain_events_eventType_idx`(`eventType`),
    INDEX `domain_events_aggregateType_aggregateId_idx`(`aggregateType`, `aggregateId`),
    INDEX `domain_events_queueName_idx`(`queueName`),
    INDEX `domain_events_occurredAt_idx`(`occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `amenities_category_idx` ON `amenities`(`category`);

-- CreateIndex
CREATE INDEX `contract_documents_phaseId_idx` ON `contract_documents`(`phaseId`);

-- CreateIndex
CREATE INDEX `contract_documents_stepId_idx` ON `contract_documents`(`stepId`);

-- CreateIndex
CREATE INDEX `contract_documents_type_idx` ON `contract_documents`(`type`);

-- CreateIndex
CREATE INDEX `contract_documents_status_idx` ON `contract_documents`(`status`);

-- CreateIndex
CREATE INDEX `contracts_propertyUnitId_idx` ON `contracts`(`propertyUnitId`);

-- CreateIndex
CREATE INDEX `contracts_paymentMethodId_idx` ON `contracts`(`paymentMethodId`);

-- CreateIndex
CREATE INDEX `contracts_state_idx` ON `contracts`(`state`);

-- CreateIndex
CREATE UNIQUE INDEX `payment_plans_name_key` ON `payment_plans`(`name`);

-- CreateIndex
CREATE INDEX `properties_status_idx` ON `properties`(`status`);

-- AddForeignKey
ALTER TABLE `property_variants` ADD CONSTRAINT `property_variants_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_variant_amenities` ADD CONSTRAINT `property_variant_amenities_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `property_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_variant_amenities` ADD CONSTRAINT `property_variant_amenities_amenityId_fkey` FOREIGN KEY (`amenityId`) REFERENCES `amenities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_variant_media` ADD CONSTRAINT `property_variant_media_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `property_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_units` ADD CONSTRAINT `property_units_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `property_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_links` ADD CONSTRAINT `property_payment_method_links_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_links` ADD CONSTRAINT `property_payment_method_links_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_phases` ADD CONSTRAINT `property_payment_method_phases_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_phases` ADD CONSTRAINT `property_payment_method_phases_paymentPlanId_fkey` FOREIGN KEY (`paymentPlanId`) REFERENCES `payment_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_propertyUnitId_fkey` FOREIGN KEY (`propertyUnitId`) REFERENCES `property_units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_buyerId_fkey` FOREIGN KEY (`buyerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_phases` ADD CONSTRAINT `contract_phases_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_phases` ADD CONSTRAINT `contract_phases_paymentPlanId_fkey` FOREIGN KEY (`paymentPlanId`) REFERENCES `payment_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_phase_steps` ADD CONSTRAINT `contract_phase_steps_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `contract_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_phase_steps` ADD CONSTRAINT `contract_phase_steps_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_phase_step_approvals` ADD CONSTRAINT `contract_phase_step_approvals_stepId_fkey` FOREIGN KEY (`stepId`) REFERENCES `contract_phase_steps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_phase_step_approvals` ADD CONSTRAINT `contract_phase_step_approvals_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_installments` ADD CONSTRAINT `contract_installments_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `contract_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_payments` ADD CONSTRAINT `contract_payments_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_payments` ADD CONSTRAINT `contract_payments_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `contract_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_payments` ADD CONSTRAINT `contract_payments_installmentId_fkey` FOREIGN KEY (`installmentId`) REFERENCES `contract_installments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_payments` ADD CONSTRAINT `contract_payments_payerId_fkey` FOREIGN KEY (`payerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_documents` ADD CONSTRAINT `contract_documents_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_transitions` ADD CONSTRAINT `contract_transitions_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_events` ADD CONSTRAINT `contract_events_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
