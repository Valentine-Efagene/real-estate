/*
  Warnings:

  - The values [INTERNAL,WEBHOOK,WORKFLOW,NOTIFICATION,SNS,SCRIPT] on the enum `event_handlers_handlerType` will be removed. If these variants are still used in the database, this will fail.

*/

-- First, migrate existing data to new enum values
-- INTERNAL -> RUN_AUTOMATION (internal service calls are now automations)
-- WEBHOOK -> CALL_WEBHOOK (external API calls)
-- WORKFLOW -> ADVANCE_WORKFLOW (workflow state changes)
-- NOTIFICATION -> SEND_EMAIL (general notifications default to email)
-- SNS -> SEND_EMAIL (SNS was for email notifications)
-- SCRIPT -> RUN_AUTOMATION (custom scripts are automations)

-- Add new enum values first (MySQL requires this approach)
ALTER TABLE `event_handlers` MODIFY `handlerType` ENUM('INTERNAL', 'WEBHOOK', 'WORKFLOW', 'NOTIFICATION', 'SNS', 'SCRIPT', 'SEND_EMAIL', 'SEND_SMS', 'SEND_PUSH', 'CALL_WEBHOOK', 'ADVANCE_WORKFLOW', 'RUN_AUTOMATION') NOT NULL;

-- Migrate data
UPDATE `event_handlers` SET `handlerType` = 'RUN_AUTOMATION' WHERE `handlerType` = 'INTERNAL';
UPDATE `event_handlers` SET `handlerType` = 'CALL_WEBHOOK' WHERE `handlerType` = 'WEBHOOK';
UPDATE `event_handlers` SET `handlerType` = 'ADVANCE_WORKFLOW' WHERE `handlerType` = 'WORKFLOW';
UPDATE `event_handlers` SET `handlerType` = 'SEND_EMAIL' WHERE `handlerType` = 'NOTIFICATION';
UPDATE `event_handlers` SET `handlerType` = 'SEND_EMAIL' WHERE `handlerType` = 'SNS';
UPDATE `event_handlers` SET `handlerType` = 'RUN_AUTOMATION' WHERE `handlerType` = 'SCRIPT';

-- Now remove old enum values
ALTER TABLE `event_handlers` MODIFY `handlerType` ENUM('SEND_EMAIL', 'SEND_SMS', 'SEND_PUSH', 'CALL_WEBHOOK', 'ADVANCE_WORKFLOW', 'RUN_AUTOMATION') NOT NULL;
