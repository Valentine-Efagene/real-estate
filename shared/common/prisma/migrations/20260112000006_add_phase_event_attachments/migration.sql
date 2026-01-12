-- CreateTable
CREATE TABLE `phase_event_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `trigger` ENUM('ON_ACTIVATE', 'ON_COMPLETE', 'ON_CANCEL', 'ON_PAYMENT_RECEIVED', 'ON_ALL_PAYMENTS_RECEIVED') NOT NULL,
    `handlerId` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `phase_event_attachments_phaseId_idx`(`phaseId`),
    INDEX `phase_event_attachments_handlerId_idx`(`handlerId`),
    UNIQUE INDEX `phase_event_attachments_phaseId_handlerId_trigger_key`(`phaseId`, `handlerId`, `trigger`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `phase_event_attachments` ADD CONSTRAINT `phase_event_attachments_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `property_payment_method_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phase_event_attachments` ADD CONSTRAINT `phase_event_attachments_handlerId_fkey` FOREIGN KEY (`handlerId`) REFERENCES `event_handlers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
