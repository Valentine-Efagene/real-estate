-- DropForeignKey
ALTER TABLE `offer_letters` DROP FOREIGN KEY `offer_letters_templateId_fkey`;

-- DropIndex
DROP INDEX `offer_letters_templateId_fkey` ON `offer_letters`;

-- AlterTable
ALTER TABLE `offer_letters` MODIFY `templateId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `offer_letters` ADD CONSTRAINT `offer_letters_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `document_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
