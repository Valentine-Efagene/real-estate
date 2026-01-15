-- AlterTable
ALTER TABLE `applications` ADD COLUMN `supersededAt` DATETIME(3) NULL,
    ADD COLUMN `supersededById` VARCHAR(191) NULL,
    MODIFY `status` ENUM('DRAFT', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED', 'TRANSFERRED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `event_handlers` MODIFY `handlerType` ENUM('SEND_EMAIL', 'SEND_SMS', 'SEND_PUSH', 'CALL_WEBHOOK', 'ADVANCE_WORKFLOW', 'RUN_AUTOMATION', 'LOCK_UNIT') NOT NULL;

-- AlterTable
ALTER TABLE `property_payment_method_phases` ADD COLUMN `lockUnitOnComplete` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `applications_supersededById_idx` ON `applications`(`supersededById`);

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_supersededById_fkey` FOREIGN KEY (`supersededById`) REFERENCES `applications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
