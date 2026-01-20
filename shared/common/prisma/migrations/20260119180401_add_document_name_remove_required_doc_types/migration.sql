/*
  Warnings:

  - You are about to drop the column `requiredDocumentTypes` on the `documentation_plans` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `documentation_plan_steps` ADD COLUMN `documentName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `documentation_plans` DROP COLUMN `requiredDocumentTypes`;

-- AlterTable
ALTER TABLE `documentation_steps` ADD COLUMN `documentName` VARCHAR(191) NULL;
