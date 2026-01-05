/*
  Warnings:

  - You are about to drop the column `createdAt` on the `contract_events` table. All the data in the column will be lost.
  - You are about to drop the column `event` on the `contract_events` table. All the data in the column will be lost.
  - You are about to alter the column `data` on the `contract_events` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Json`.
  - You are about to drop the `contract_transitions` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `eventType` to the `contract_events` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `contract_transitions` DROP FOREIGN KEY `contract_transitions_contractId_fkey`;

-- AlterTable
ALTER TABLE `contract_events` DROP COLUMN `createdAt`,
    DROP COLUMN `event`,
    ADD COLUMN `actorId` VARCHAR(191) NULL,
    ADD COLUMN `actorType` VARCHAR(191) NULL,
    ADD COLUMN `eventGroup` VARCHAR(191) NULL,
    ADD COLUMN `eventType` VARCHAR(191) NOT NULL,
    ADD COLUMN `fromState` VARCHAR(191) NULL,
    ADD COLUMN `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `toState` VARCHAR(191) NULL,
    ADD COLUMN `trigger` VARCHAR(191) NULL,
    MODIFY `data` JSON NULL;

-- DropTable
DROP TABLE `contract_transitions`;

-- CreateIndex
CREATE INDEX `contract_events_eventType_idx` ON `contract_events`(`eventType`);

-- CreateIndex
CREATE INDEX `contract_events_eventGroup_idx` ON `contract_events`(`eventGroup`);

-- CreateIndex
CREATE INDEX `contract_events_occurredAt_idx` ON `contract_events`(`occurredAt`);
