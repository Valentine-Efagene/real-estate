-- AlterTable
ALTER TABLE `property_payment_method_phases` ADD COLUMN `questionnairePlanId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `questionnaire_phases` ADD COLUMN `passed` BOOLEAN NULL,
    ADD COLUMN `passingScore` INTEGER NULL,
    ADD COLUMN `questionnairePlanId` VARCHAR(191) NULL,
    ADD COLUMN `scoredAt` DATETIME(3) NULL,
    ADD COLUMN `totalScore` INTEGER NULL;

-- CreateTable
CREATE TABLE `questionnaire_plans` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `passingScore` INTEGER NULL,
    `scoringStrategy` ENUM('SUM', 'AVERAGE', 'WEIGHTED_SUM', 'MIN_ALL', 'CUSTOM') NOT NULL DEFAULT 'SUM',
    `autoDecisionEnabled` BOOLEAN NOT NULL DEFAULT false,
    `estimatedMinutes` INTEGER NULL,
    `category` ENUM('PREQUALIFICATION', 'AFFORDABILITY', 'PROPERTY_INTENT', 'RISK_ASSESSMENT', 'COMPLIANCE', 'CUSTOM') NOT NULL DEFAULT 'PREQUALIFICATION',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `questionnaire_plans_tenantId_idx`(`tenantId`),
    INDEX `questionnaire_plans_category_idx`(`category`),
    UNIQUE INDEX `questionnaire_plans_tenantId_name_version_key`(`tenantId`, `name`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questionnaire_plan_questions` (
    `id` VARCHAR(191) NOT NULL,
    `questionnairePlanId` VARCHAR(191) NOT NULL,
    `questionKey` VARCHAR(191) NOT NULL,
    `questionText` TEXT NOT NULL,
    `helpText` TEXT NULL,
    `questionType` ENUM('TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'SELECT', 'MULTI_SELECT', 'RADIO', 'CHECKBOX', 'FILE_UPLOAD', 'PHONE', 'EMAIL', 'ADDRESS', 'PERCENTAGE', 'YEARS_MONTHS') NOT NULL,
    `order` INTEGER NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `validationRules` JSON NULL,
    `options` JSON NULL,
    `scoreWeight` INTEGER NOT NULL DEFAULT 1,
    `scoringRules` JSON NULL,
    `showIf` JSON NULL,
    `category` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `questionnaire_plan_questions_questionnairePlanId_idx`(`questionnairePlanId`),
    UNIQUE INDEX `questionnaire_plan_questions_questionnairePlanId_questionKey_key`(`questionnairePlanId`, `questionKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `property_payment_method_phases_questionnairePlanId_idx` ON `property_payment_method_phases`(`questionnairePlanId`);

-- CreateIndex
CREATE INDEX `questionnaire_phases_questionnairePlanId_idx` ON `questionnaire_phases`(`questionnairePlanId`);

-- AddForeignKey
ALTER TABLE `questionnaire_plans` ADD CONSTRAINT `questionnaire_plans_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_plan_questions` ADD CONSTRAINT `questionnaire_plan_questions_questionnairePlanId_fkey` FOREIGN KEY (`questionnairePlanId`) REFERENCES `questionnaire_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_phases` ADD CONSTRAINT `property_payment_method_phases_questionnairePlanId_fkey` FOREIGN KEY (`questionnairePlanId`) REFERENCES `questionnaire_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_phases` ADD CONSTRAINT `questionnaire_phases_questionnairePlanId_fkey` FOREIGN KEY (`questionnairePlanId`) REFERENCES `questionnaire_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
