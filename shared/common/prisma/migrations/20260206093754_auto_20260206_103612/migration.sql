-- AlterTable
ALTER TABLE `application_organizations` ADD COLUMN `assignedStaffId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `application_organizations` ADD CONSTRAINT `application_organizations_assignedStaffId_fkey` FOREIGN KEY (`assignedStaffId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
