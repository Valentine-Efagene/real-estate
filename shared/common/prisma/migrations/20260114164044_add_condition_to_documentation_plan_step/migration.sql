-- AlterTable
ALTER TABLE `documentation_plan_steps` ADD COLUMN `allowedMimeTypes` VARCHAR(191) NULL,
    ADD COLUMN `condition` JSON NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `expiryDays` INTEGER NULL,
    ADD COLUMN `isRequired` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `maxFiles` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `maxSizeBytes` INTEGER NULL,
    ADD COLUMN `minFiles` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `requiresManualReview` BOOLEAN NOT NULL DEFAULT false;
