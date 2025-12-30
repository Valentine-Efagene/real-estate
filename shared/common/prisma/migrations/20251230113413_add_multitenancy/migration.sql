/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,name]` on the table `payment_plans` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,name]` on the table `property_payment_methods` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `contracts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `properties` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `property_payment_methods` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `payment_plans_name_key` ON `payment_plans`;

-- AlterTable
ALTER TABLE `contracts` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `payment_plans` ADD COLUMN `tenantId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `properties` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `property_payment_methods` ADD COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `contracts_tenantId_idx` ON `contracts`(`tenantId`);

-- CreateIndex
CREATE INDEX `payment_plans_tenantId_idx` ON `payment_plans`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `payment_plans_tenantId_name_key` ON `payment_plans`(`tenantId`, `name`);

-- CreateIndex
CREATE INDEX `properties_tenantId_idx` ON `properties`(`tenantId`);

-- CreateIndex
CREATE INDEX `property_payment_methods_tenantId_idx` ON `property_payment_methods`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `property_payment_methods_tenantId_name_key` ON `property_payment_methods`(`tenantId`, `name`);

-- AddForeignKey
ALTER TABLE `properties` ADD CONSTRAINT `properties_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_plans` ADD CONSTRAINT `payment_plans_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_methods` ADD CONSTRAINT `property_payment_methods_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
