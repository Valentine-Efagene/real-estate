-- CreateTable
CREATE TABLE `event_channels` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `event_channels_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `event_channels_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_types` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `payloadSchema` JSON NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `event_types_tenantId_idx`(`tenantId`),
    INDEX `event_types_channelId_idx`(`channelId`),
    UNIQUE INDEX `event_types_tenantId_code_key`(`tenantId`, `code`),
    UNIQUE INDEX `event_types_channelId_code_key`(`channelId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_handlers` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `eventTypeId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `handlerType` ENUM('INTERNAL', 'WEBHOOK', 'WORKFLOW', 'NOTIFICATION', 'SCRIPT') NOT NULL,
    `config` JSON NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `maxRetries` INTEGER NOT NULL DEFAULT 3,
    `retryDelayMs` INTEGER NOT NULL DEFAULT 1000,
    `filterCondition` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `event_handlers_tenantId_idx`(`tenantId`),
    INDEX `event_handlers_eventTypeId_idx`(`eventTypeId`),
    INDEX `event_handlers_handlerType_idx`(`handlerType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_events` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `eventTypeId` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `correlationId` VARCHAR(191) NULL,
    `causationId` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `actorType` ENUM('USER', 'API_KEY', 'SYSTEM', 'WEBHOOK') NOT NULL DEFAULT 'SYSTEM',
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `error` TEXT NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `workflow_events_tenantId_idx`(`tenantId`),
    INDEX `workflow_events_eventTypeId_idx`(`eventTypeId`),
    INDEX `workflow_events_correlationId_idx`(`correlationId`),
    INDEX `workflow_events_causationId_idx`(`causationId`),
    INDEX `workflow_events_status_idx`(`status`),
    INDEX `workflow_events_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_handler_executions` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `handlerId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `attempt` INTEGER NOT NULL DEFAULT 1,
    `input` JSON NULL,
    `output` JSON NULL,
    `error` TEXT NULL,
    `errorCode` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `durationMs` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `event_handler_executions_eventId_idx`(`eventId`),
    INDEX `event_handler_executions_handlerId_idx`(`handlerId`),
    INDEX `event_handler_executions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `event_channels` ADD CONSTRAINT `event_channels_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_types` ADD CONSTRAINT `event_types_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_types` ADD CONSTRAINT `event_types_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `event_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_handlers` ADD CONSTRAINT `event_handlers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_handlers` ADD CONSTRAINT `event_handlers_eventTypeId_fkey` FOREIGN KEY (`eventTypeId`) REFERENCES `event_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_events` ADD CONSTRAINT `workflow_events_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_events` ADD CONSTRAINT `workflow_events_eventTypeId_fkey` FOREIGN KEY (`eventTypeId`) REFERENCES `event_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_handler_executions` ADD CONSTRAINT `event_handler_executions_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `workflow_events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_handler_executions` ADD CONSTRAINT `event_handler_executions_handlerId_fkey` FOREIGN KEY (`handlerId`) REFERENCES `event_handlers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
