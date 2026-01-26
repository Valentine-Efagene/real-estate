-- AlterTable
ALTER TABLE `properties` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `properties_organizationId_idx` ON `properties`(`organizationId`);

-- AddForeignKey
ALTER TABLE `properties` ADD CONSTRAINT `properties_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
