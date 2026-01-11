/*
  Warnings:

  - You are about to drop the column `action` on the `permissions` table. All the data in the column will be lost.
  - You are about to drop the column `resource` on the `permissions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[path,tenantId]` on the table `permissions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,tenantId]` on the table `roles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `path` to the `permissions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `permissions_name_key` ON `permissions`;

-- DropIndex
DROP INDEX `permissions_resource_action_key` ON `permissions`;

-- DropIndex
DROP INDEX `permissions_resource_idx` ON `permissions`;

-- DropIndex
DROP INDEX `roles_name_key` ON `roles`;

-- AlterTable
ALTER TABLE `permissions` DROP COLUMN `action`,
    DROP COLUMN `resource`,
    ADD COLUMN `effect` ENUM('ALLOW', 'DENY') NOT NULL DEFAULT 'ALLOW',
    ADD COLUMN `isSystem` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `methods` JSON NOT NULL,
    ADD COLUMN `path` VARCHAR(191) NOT NULL,
    ADD COLUMN `tenantId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `roles` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `isSystem` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `tenantId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `tenant_memberships` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tenant_memberships_tenantId_idx`(`tenantId`),
    INDEX `tenant_memberships_userId_idx`(`userId`),
    UNIQUE INDEX `tenant_memberships_userId_tenantId_key`(`userId`, `tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `permissions_tenantId_idx` ON `permissions`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `permissions_path_tenantId_key` ON `permissions`(`path`, `tenantId`);

-- CreateIndex
CREATE INDEX `roles_tenantId_idx` ON `roles`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `roles_name_tenantId_key` ON `roles`(`name`, `tenantId`);

-- AddForeignKey
ALTER TABLE `roles` ADD CONSTRAINT `roles_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permissions` ADD CONSTRAINT `permissions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
