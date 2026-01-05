-- AlterTable
ALTER TABLE `contract_phase_steps` ADD COLUMN `actionReason` TEXT NULL,
    ADD COLUMN `lastSubmittedAt` DATETIME(3) NULL,
    ADD COLUMN `submissionCount` INTEGER NOT NULL DEFAULT 0,
    MODIFY `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED', 'NEEDS_RESUBMISSION', 'ACTION_REQUIRED', 'AWAITING_REVIEW') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `contract_phases` ADD COLUMN `currentStepId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `contract_phases_currentStepId_idx` ON `contract_phases`(`currentStepId`);

-- AddForeignKey
ALTER TABLE `contract_phases` ADD CONSTRAINT `contract_phases_currentStepId_fkey` FOREIGN KEY (`currentStepId`) REFERENCES `contract_phase_steps`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
