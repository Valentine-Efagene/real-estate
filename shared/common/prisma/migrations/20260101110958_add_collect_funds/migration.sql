-- AlterTable
ALTER TABLE `contract_phases` ADD COLUMN `collectFunds` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `payment_plans` ADD COLUMN `collectFunds` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `property_payment_method_phases` ADD COLUMN `collectFunds` BOOLEAN NULL;
