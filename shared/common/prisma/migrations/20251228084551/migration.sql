/*
  Warnings:

  - You are about to drop the column `tokenHash` on the `refresh_tokens` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[jti]` on the table `refresh_tokens` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `refresh_tokens_tokenHash_key` ON `refresh_tokens`;

-- AlterTable
ALTER TABLE `refresh_tokens` DROP COLUMN `tokenHash`,
    ADD COLUMN `jti` VARCHAR(255) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `refresh_tokens_jti_key` ON `refresh_tokens`(`jti`);
