-- AlterTable
ALTER TABLE `organization_payment_methods` ADD COLUMN `preferredStaffId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `organization_payment_methods` ADD CONSTRAINT `organization_payment_methods_preferredStaffId_fkey` FOREIGN KEY (`preferredStaffId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
