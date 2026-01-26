/*
  Warnings:

  - You are about to drop the column `role` on the `application_organizations` table. All the data in the column will be lost.
  - You are about to drop the column `reviewParty` on the `approval_stage_progress` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `approval_stages` table. All the data in the column will be lost.
  - You are about to drop the column `reviewParty` on the `approval_stages` table. All the data in the column will be lost.
  - You are about to drop the column `reviewParty` on the `document_approvals` table. All the data in the column will be lost.
  - You are about to drop the column `reviewParty` on the `document_reviews` table. All the data in the column will be lost.
  - You are about to drop the column `approvalLimit` on the `organization_members` table. All the data in the column will be lost.
  - You are about to drop the column `canApprove` on the `organization_members` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `organization_members` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `organizations` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[applicationId,assignedAsTypeId]` on the table `application_organizations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[documentId,organizationId]` on the table `document_reviews` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `assignedAsTypeId` to the `application_organizations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationTypeId` to the `approval_stage_progress` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationTypeId` to the `approval_stages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationTypeId` to the `document_approvals` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `application_organizations` DROP FOREIGN KEY `application_organizations_applicationId_fkey`;

-- DropForeignKey
ALTER TABLE `document_reviews` DROP FOREIGN KEY `document_reviews_documentId_fkey`;

-- DropIndex
DROP INDEX `application_organizations_applicationId_organizationId_role_key` ON `application_organizations`;

-- DropIndex
DROP INDEX `application_organizations_role_idx` ON `application_organizations`;

-- DropIndex
DROP INDEX `document_reviews_documentId_reviewParty_organizationId_key` ON `document_reviews`;

-- DropIndex
DROP INDEX `document_reviews_reviewParty_idx` ON `document_reviews`;

-- DropIndex
DROP INDEX `organization_members_role_idx` ON `organization_members`;

-- DropIndex
DROP INDEX `organizations_type_idx` ON `organizations`;

-- AlterTable
ALTER TABLE `application_organizations` DROP COLUMN `role`,
    ADD COLUMN `assignedAsTypeId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `approval_stage_progress` DROP COLUMN `reviewParty`,
    ADD COLUMN `organizationTypeId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `approval_stages` DROP COLUMN `organizationId`,
    DROP COLUMN `reviewParty`,
    ADD COLUMN `organizationTypeId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `document_approvals` DROP COLUMN `reviewParty`,
    ADD COLUMN `organizationTypeId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `document_reviews` DROP COLUMN `reviewParty`,
    ADD COLUMN `organizationTypeId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `organization_members` DROP COLUMN `approvalLimit`,
    DROP COLUMN `canApprove`,
    DROP COLUMN `role`,
    ADD COLUMN `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `organizations` DROP COLUMN `type`;

-- CreateTable
CREATE TABLE `organization_types` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isSystemType` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `organization_types_tenantId_idx`(`tenantId`),
    INDEX `organization_types_code_idx`(`code`),
    UNIQUE INDEX `organization_types_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_type_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `typeId` VARCHAR(191) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `organization_type_assignments_organizationId_idx`(`organizationId`),
    INDEX `organization_type_assignments_typeId_idx`(`typeId`),
    UNIQUE INDEX `organization_type_assignments_organizationId_typeId_key`(`organizationId`, `typeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `application_organizations_assignedAsTypeId_idx` ON `application_organizations`(`assignedAsTypeId`);

-- CreateIndex
CREATE UNIQUE INDEX `application_organizations_applicationId_assignedAsTypeId_key` ON `application_organizations`(`applicationId`, `assignedAsTypeId`);

-- CreateIndex
CREATE INDEX `approval_stages_organizationTypeId_idx` ON `approval_stages`(`organizationTypeId`);

-- CreateIndex
CREATE INDEX `document_approvals_organizationTypeId_idx` ON `document_approvals`(`organizationTypeId`);

-- CreateIndex
CREATE INDEX `document_reviews_organizationId_idx` ON `document_reviews`(`organizationId`);

-- CreateIndex
CREATE INDEX `document_reviews_organizationTypeId_idx` ON `document_reviews`(`organizationTypeId`);

-- CreateIndex
CREATE UNIQUE INDEX `document_reviews_documentId_organizationId_key` ON `document_reviews`(`documentId`, `organizationId`);

-- AddForeignKey
ALTER TABLE `organization_types` ADD CONSTRAINT `organization_types_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_type_assignments` ADD CONSTRAINT `organization_type_assignments_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_type_assignments` ADD CONSTRAINT `organization_type_assignments_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `organization_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_stages` ADD CONSTRAINT `approval_stages_organizationTypeId_fkey` FOREIGN KEY (`organizationTypeId`) REFERENCES `organization_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_organizations` ADD CONSTRAINT `application_organizations_assignedAsTypeId_fkey` FOREIGN KEY (`assignedAsTypeId`) REFERENCES `organization_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_organizationTypeId_fkey` FOREIGN KEY (`organizationTypeId`) REFERENCES `organization_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_stage_progress` ADD CONSTRAINT `approval_stage_progress_organizationTypeId_fkey` FOREIGN KEY (`organizationTypeId`) REFERENCES `organization_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_approvals` ADD CONSTRAINT `document_approvals_organizationTypeId_fkey` FOREIGN KEY (`organizationTypeId`) REFERENCES `organization_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
