/*
  Warnings:

  - You are about to drop the column `phaseType` on the `application_phases` table. All the data in the column will be lost.
  - You are about to drop the column `phaseType` on the `document_requirement_rules` table. All the data in the column will be lost.
  - You are about to drop the column `phaseType` on the `onboarding_flow_phases` table. All the data in the column will be lost.
  - You are about to drop the column `phaseType` on the `onboarding_phases` table. All the data in the column will be lost.
  - You are about to drop the column `phaseType` on the `property_payment_method_phases` table. All the data in the column will be lost.
  - You are about to drop the column `phaseType` on the `qualification_flow_phases` table. All the data in the column will be lost.
  - You are about to drop the column `phaseType` on the `qualification_phases` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `document_requirement_rules_phaseType_idx` ON `document_requirement_rules`;

-- AlterTable
ALTER TABLE `application_phases` DROP COLUMN `phaseType`;

-- AlterTable
ALTER TABLE `document_requirement_rules` DROP COLUMN `phaseType`;

-- AlterTable
ALTER TABLE `onboarding_flow_phases` DROP COLUMN `phaseType`;

-- AlterTable
ALTER TABLE `onboarding_phases` DROP COLUMN `phaseType`;

-- AlterTable
ALTER TABLE `property_payment_method_phases` DROP COLUMN `phaseType`;

-- AlterTable
ALTER TABLE `qualification_flow_phases` DROP COLUMN `phaseType`;

-- AlterTable
ALTER TABLE `qualification_phases` DROP COLUMN `phaseType`;
