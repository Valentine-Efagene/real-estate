-- AlterTable
ALTER TABLE `documentation_phases` ADD COLUMN `sourceQuestionnairePhaseId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `documentation_steps` ADD COLUMN `condition` JSON NULL;

-- CreateIndex
CREATE INDEX `documentation_phases_sourceQuestionnairePhaseId_idx` ON `documentation_phases`(`sourceQuestionnairePhaseId`);

-- AddForeignKey
ALTER TABLE `documentation_phases` ADD CONSTRAINT `documentation_phases_sourceQuestionnairePhaseId_fkey` FOREIGN KEY (`sourceQuestionnairePhaseId`) REFERENCES `questionnaire_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
