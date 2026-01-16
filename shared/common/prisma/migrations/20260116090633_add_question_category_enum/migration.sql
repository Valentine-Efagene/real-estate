/*
  Warnings:

  - You are about to alter the column `category` on the `questionnaire_plan_questions` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(11))`.

*/
-- AlterTable
ALTER TABLE `questionnaire_plan_questions` MODIFY `category` ENUM('ELIGIBILITY', 'EMPLOYMENT', 'INCOME', 'AFFORDABILITY', 'EXPENSES', 'APPLICATION_TYPE', 'PERSONAL', 'PREFERENCES', 'PROPERTY', 'CREDIT', 'ASSETS', 'CUSTOM') NULL;
