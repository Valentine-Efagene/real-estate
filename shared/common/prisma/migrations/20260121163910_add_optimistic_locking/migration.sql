-- DropForeignKey
ALTER TABLE `applications` DROP FOREIGN KEY `applications_propertyUnitId_fkey`;

-- AlterTable
ALTER TABLE `payment_installments` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `payment_phases` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `property_units` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_propertyUnitId_fkey` FOREIGN KEY (`propertyUnitId`) REFERENCES `property_units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
