-- AlterTable
ALTER TABLE `payment_plans` ADD COLUMN `frequencyMultiplier` INTEGER NOT NULL DEFAULT 1,
    MODIFY `paymentFrequency` ENUM('MONTHLY', 'BIWEEKLY', 'WEEKLY', 'ONE_TIME', 'CUSTOM', 'MINUTE') NOT NULL;
