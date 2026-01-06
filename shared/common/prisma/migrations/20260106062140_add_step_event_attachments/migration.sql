-- CreateTable
CREATE TABLE `step_event_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `stepId` VARCHAR(191) NOT NULL,
    `trigger` ENUM('ON_COMPLETE', 'ON_REJECT', 'ON_SUBMIT', 'ON_RESUBMIT', 'ON_START') NOT NULL,
    `handlerId` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `step_event_attachments_stepId_idx`(`stepId`),
    INDEX `step_event_attachments_handlerId_idx`(`handlerId`),
    UNIQUE INDEX `step_event_attachments_stepId_handlerId_trigger_key`(`stepId`, `handlerId`, `trigger`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `step_event_attachments` ADD CONSTRAINT `step_event_attachments_stepId_fkey` FOREIGN KEY (`stepId`) REFERENCES `payment_method_phase_steps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `step_event_attachments` ADD CONSTRAINT `step_event_attachments_handlerId_fkey` FOREIGN KEY (`handlerId`) REFERENCES `event_handlers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
