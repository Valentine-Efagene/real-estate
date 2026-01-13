/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,key]` on the table `settings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `domain_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `socials` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `wallets` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `settings_key_key` ON `settings`;

-- AlterTable
ALTER TABLE `domain_events` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `settings` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `socials` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `transactions` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `wallets` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `domain_events_tenantId_idx` ON `domain_events`(`tenantId`);

-- CreateIndex
CREATE INDEX `settings_tenantId_idx` ON `settings`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `settings_tenantId_key_key` ON `settings`(`tenantId`, `key`);

-- CreateIndex
CREATE INDEX `socials_tenantId_idx` ON `socials`(`tenantId`);

-- CreateIndex
CREATE INDEX `transactions_tenantId_idx` ON `transactions`(`tenantId`);

-- CreateIndex
CREATE INDEX `wallets_tenantId_idx` ON `wallets`(`tenantId`);

-- AddForeignKey
ALTER TABLE `socials` ADD CONSTRAINT `socials_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallets` ADD CONSTRAINT `wallets_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settings` ADD CONSTRAINT `settings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `domain_events` ADD CONSTRAINT `domain_events_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_blockers` ADD CONSTRAINT `workflow_blockers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
