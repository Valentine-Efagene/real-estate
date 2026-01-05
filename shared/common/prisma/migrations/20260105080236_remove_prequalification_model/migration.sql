/*
  Warnings:

  - The values [PREQUALIFICATION] on the enum `document_requirement_rules_context` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `prequalifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `underwriting_decisions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `prequalifications` DROP FOREIGN KEY `prequalifications_contractId_fkey`;

-- DropForeignKey
ALTER TABLE `prequalifications` DROP FOREIGN KEY `prequalifications_paymentMethodId_fkey`;

-- DropForeignKey
ALTER TABLE `prequalifications` DROP FOREIGN KEY `prequalifications_propertyId_fkey`;

-- DropForeignKey
ALTER TABLE `prequalifications` DROP FOREIGN KEY `prequalifications_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `prequalifications` DROP FOREIGN KEY `prequalifications_userId_fkey`;

-- DropForeignKey
ALTER TABLE `underwriting_decisions` DROP FOREIGN KEY `underwriting_decisions_prequalificationId_fkey`;

-- DropForeignKey
ALTER TABLE `underwriting_decisions` DROP FOREIGN KEY `underwriting_decisions_tenantId_fkey`;

-- AlterTable
ALTER TABLE `document_requirement_rules` MODIFY `context` ENUM('CONTRACT_PHASE', 'PAYMENT_METHOD_CHANGE') NOT NULL;

-- DropTable
DROP TABLE `prequalifications`;

-- DropTable
DROP TABLE `underwriting_decisions`;
