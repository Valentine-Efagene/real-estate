-- AlterTable
ALTER TABLE `application_documents` ADD COLUMN `replacesDocumentId` VARCHAR(191) NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `documentation_plan_steps` ADD COLUMN `reviewOrder` VARCHAR(191) NULL,
    ADD COLUMN `reviewRequirements` JSON NULL;

-- AlterTable
ALTER TABLE `documentation_steps` ADD COLUMN `reviewOrder` VARCHAR(191) NULL,
    ADD COLUMN `reviewRequirements` JSON NULL;

-- CreateTable
CREATE TABLE `document_reviews` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `reviewParty` ENUM('INTERNAL', 'BANK', 'DEVELOPER', 'LEGAL', 'GOVERNMENT', 'INSURER', 'CUSTOMER') NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `reviewerId` VARCHAR(191) NULL,
    `reviewerName` VARCHAR(191) NULL,
    `decision` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'WAIVED') NOT NULL DEFAULT 'PENDING',
    `comments` TEXT NULL,
    `concerns` JSON NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewOrder` INTEGER NOT NULL DEFAULT 0,
    `parentReviewId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_reviews_tenantId_idx`(`tenantId`),
    INDEX `document_reviews_documentId_idx`(`documentId`),
    INDEX `document_reviews_reviewParty_idx`(`reviewParty`),
    INDEX `document_reviews_decision_idx`(`decision`),
    INDEX `document_reviews_reviewerId_idx`(`reviewerId`),
    INDEX `document_reviews_parentReviewId_idx`(`parentReviewId`),
    UNIQUE INDEX `document_reviews_documentId_reviewParty_organizationId_key`(`documentId`, `reviewParty`, `organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `application_documents_replacesDocumentId_idx` ON `application_documents`(`replacesDocumentId`);

-- AddForeignKey
ALTER TABLE `application_documents` ADD CONSTRAINT `application_documents_replacesDocumentId_fkey` FOREIGN KEY (`replacesDocumentId`) REFERENCES `application_documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `application_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_parentReviewId_fkey` FOREIGN KEY (`parentReviewId`) REFERENCES `document_reviews`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
