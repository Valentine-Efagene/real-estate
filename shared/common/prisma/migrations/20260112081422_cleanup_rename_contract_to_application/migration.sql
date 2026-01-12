/*
  Warnings:

  - You are about to drop the column `contractSnapshot` on the `application_terminations` table. All the data in the column will be lost.
  - You are about to drop the column `totalContractAmount` on the `application_terminations` table. All the data in the column will be lost.
  - Added the required column `applicationSnapshot` to the `application_terminations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalApplicationAmount` to the `application_terminations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `application_terminations` DROP COLUMN `contractSnapshot`,
    DROP COLUMN `totalContractAmount`,
    ADD COLUMN `applicationSnapshot` JSON NOT NULL,
    ADD COLUMN `totalApplicationAmount` DOUBLE NOT NULL;
