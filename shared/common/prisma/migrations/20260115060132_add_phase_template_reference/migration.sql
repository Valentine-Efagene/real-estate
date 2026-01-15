-- AlterTable
ALTER TABLE `application_phases` ADD COLUMN `phaseTemplateId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `application_phases_phaseTemplateId_idx` ON `application_phases`(`phaseTemplateId`);

-- AddForeignKey
ALTER TABLE `application_phases` ADD CONSTRAINT `application_phases_phaseTemplateId_fkey` FOREIGN KEY (`phaseTemplateId`) REFERENCES `property_payment_method_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
