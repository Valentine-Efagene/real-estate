/*
  Warnings:

  - You are about to drop the column `isPublished` on the `properties` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `properties` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(5))`.

*/
-- AlterTable
ALTER TABLE `properties` DROP COLUMN `isPublished`,
    MODIFY `status` ENUM('DRAFT', 'PUBLISHED', 'SOLD_OUT', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT';
