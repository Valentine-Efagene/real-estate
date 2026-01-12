-- Safe Migration: Rename Contract to Application
-- This migration uses RENAME TABLE and RENAME COLUMN to preserve data

-- Step 1: Update enum values in approval_requests
ALTER TABLE `approval_requests` MODIFY `type` ENUM('PROPERTY_TRANSFER', 'PROPERTY_UPDATE', 'USER_WORKFLOW', 'CREDIT_CHECK', 'CONTRACT_TERMINATION', 'APPLICATION_TERMINATION', 'REFUND_APPROVAL') NOT NULL;
UPDATE `approval_requests` SET `type` = 'APPLICATION_TERMINATION' WHERE `type` = 'CONTRACT_TERMINATION';
ALTER TABLE `approval_requests` MODIFY `type` ENUM('PROPERTY_TRANSFER', 'PROPERTY_UPDATE', 'USER_WORKFLOW', 'CREDIT_CHECK', 'APPLICATION_TERMINATION', 'REFUND_APPROVAL') NOT NULL;

-- Step 2: Update enum values in document_requirement_rules
ALTER TABLE `document_requirement_rules` MODIFY `context` ENUM('CONTRACT_PHASE', 'APPLICATION_PHASE', 'PAYMENT_METHOD_CHANGE') NOT NULL;
UPDATE `document_requirement_rules` SET `context` = 'APPLICATION_PHASE' WHERE `context` = 'CONTRACT_PHASE';
ALTER TABLE `document_requirement_rules` MODIFY `context` ENUM('APPLICATION_PHASE', 'PAYMENT_METHOD_CHANGE') NOT NULL;

-- Step 3: Drop existing foreign keys that reference contract tables
-- contracts table foreign keys
ALTER TABLE `contracts` DROP FOREIGN KEY `contracts_tenantId_fkey`;
ALTER TABLE `contracts` DROP FOREIGN KEY `contracts_propertyUnitId_fkey`;
ALTER TABLE `contracts` DROP FOREIGN KEY `contracts_buyerId_fkey`;
ALTER TABLE `contracts` DROP FOREIGN KEY `contracts_sellerId_fkey`;
ALTER TABLE `contracts` DROP FOREIGN KEY `contracts_paymentMethodId_fkey`;
ALTER TABLE `contracts` DROP FOREIGN KEY `contracts_currentPhaseId_fkey`;
ALTER TABLE `contracts` DROP FOREIGN KEY `contracts_transferredFromId_fkey`;

-- contract_phases foreign keys
ALTER TABLE `contract_phases` DROP FOREIGN KEY `contract_phases_contractId_fkey`;

-- contract_events foreign keys
ALTER TABLE `contract_events` DROP FOREIGN KEY `contract_events_contractId_fkey`;

-- contract_payments foreign keys
ALTER TABLE `contract_payments` DROP FOREIGN KEY `contract_payments_contractId_fkey`;
ALTER TABLE `contract_payments` DROP FOREIGN KEY `contract_payments_phaseId_fkey`;
ALTER TABLE `contract_payments` DROP FOREIGN KEY `contract_payments_installmentId_fkey`;
ALTER TABLE `contract_payments` DROP FOREIGN KEY `contract_payments_payerId_fkey`;

-- contract_documents foreign keys
ALTER TABLE `contract_documents` DROP FOREIGN KEY `contract_documents_contractId_fkey`;
ALTER TABLE `contract_documents` DROP FOREIGN KEY `contract_documents_uploadedById_fkey`;

-- contract_refunds foreign keys
ALTER TABLE `contract_refunds` DROP FOREIGN KEY `contract_refunds_tenantId_fkey`;
ALTER TABLE `contract_refunds` DROP FOREIGN KEY `contract_refunds_contractId_fkey`;
ALTER TABLE `contract_refunds` DROP FOREIGN KEY `contract_refunds_requestedById_fkey`;
ALTER TABLE `contract_refunds` DROP FOREIGN KEY `contract_refunds_approvedById_fkey`;
ALTER TABLE `contract_refunds` DROP FOREIGN KEY `contract_refunds_processedById_fkey`;

-- contract_terminations foreign keys
ALTER TABLE `contract_terminations` DROP FOREIGN KEY `contract_terminations_contractId_fkey`;
ALTER TABLE `contract_terminations` DROP FOREIGN KEY `contract_terminations_tenantId_fkey`;
ALTER TABLE `contract_terminations` DROP FOREIGN KEY `contract_terminations_initiatorId_fkey`;
ALTER TABLE `contract_terminations` DROP FOREIGN KEY `contract_terminations_reviewedBy_fkey`;

-- contract_installments foreign keys
ALTER TABLE `contract_installments` DROP FOREIGN KEY `contract_installments_paymentPhaseId_fkey`;

-- other tables referencing contracts
ALTER TABLE `offer_letters` DROP FOREIGN KEY `offer_letters_contractId_fkey`;
ALTER TABLE `payment_method_change_requests` DROP FOREIGN KEY `payment_method_change_requests_contractId_fkey`;
ALTER TABLE `property_transfer_requests` DROP FOREIGN KEY `property_transfer_requests_sourceContractId_fkey`;
ALTER TABLE `property_transfer_requests` DROP FOREIGN KEY `property_transfer_requests_targetContractId_fkey`;

-- questionnaire_phases, documentation_phases, payment_phases reference contract_phases
ALTER TABLE `questionnaire_phases` DROP FOREIGN KEY `questionnaire_phases_phaseId_fkey`;
ALTER TABLE `documentation_phases` DROP FOREIGN KEY `documentation_phases_phaseId_fkey`;
ALTER TABLE `payment_phases` DROP FOREIGN KEY `payment_phases_phaseId_fkey`;

-- Step 4: Rename tables
RENAME TABLE `contracts` TO `applications`;
RENAME TABLE `contract_phases` TO `application_phases`;
RENAME TABLE `contract_events` TO `application_events`;
RENAME TABLE `contract_payments` TO `application_payments`;
RENAME TABLE `contract_documents` TO `application_documents`;
RENAME TABLE `contract_refunds` TO `application_refunds`;
RENAME TABLE `contract_terminations` TO `application_terminations`;
RENAME TABLE `contract_installments` TO `payment_installments`;

-- Step 5: Rename columns in applications table
ALTER TABLE `applications` CHANGE `contractNumber` `applicationNumber` VARCHAR(191) NOT NULL;
ALTER TABLE `applications` CHANGE `contractType` `applicationType` VARCHAR(191) NOT NULL;

-- Step 6: Rename columns in related tables (contractId -> applicationId)
ALTER TABLE `application_phases` CHANGE `contractId` `applicationId` VARCHAR(191) NOT NULL;
ALTER TABLE `application_events` CHANGE `contractId` `applicationId` VARCHAR(191) NOT NULL;
ALTER TABLE `application_payments` CHANGE `contractId` `applicationId` VARCHAR(191) NOT NULL;
ALTER TABLE `application_documents` CHANGE `contractId` `applicationId` VARCHAR(191) NOT NULL;
ALTER TABLE `application_refunds` CHANGE `contractId` `applicationId` VARCHAR(191) NOT NULL;
ALTER TABLE `application_terminations` CHANGE `contractId` `applicationId` VARCHAR(191) NOT NULL;

-- Rename columns in other tables that reference contracts
ALTER TABLE `offer_letters` CHANGE `contractId` `applicationId` VARCHAR(191) NOT NULL;
ALTER TABLE `payment_method_change_requests` CHANGE `contractId` `applicationId` VARCHAR(191) NOT NULL;
ALTER TABLE `property_transfer_requests` CHANGE `sourceContractId` `sourceApplicationId` VARCHAR(191) NOT NULL;
ALTER TABLE `property_transfer_requests` CHANGE `targetContractId` `targetApplicationId` VARCHAR(191) NULL;

-- Step 7: Update enum for application_events.eventType
-- First add new values, then update, then remove old values
ALTER TABLE `application_events` MODIFY `eventType` ENUM(
  'CONTRACT_CREATED', 'CONTRACT_STATE_CHANGED',
  'APPLICATION_CREATED', 'APPLICATION_STATE_CHANGED',
  'PHASE_ACTIVATED', 'PHASE_COMPLETED', 'STEP_COMPLETED', 'STEP_REJECTED',
  'DOCUMENT_SUBMITTED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED',
  'PAYMENT_INITIATED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'INSTALLMENTS_GENERATED',
  'CONTRACT_SIGNED', 'CONTRACT_TERMINATED', 'CONTRACT_TRANSFERRED',
  'APPLICATION_SIGNED', 'APPLICATION_TERMINATED', 'APPLICATION_TRANSFERRED',
  'UNDERWRITING_COMPLETED', 'OFFER_LETTER_GENERATED'
) NOT NULL;

UPDATE `application_events` SET `eventType` = 'APPLICATION_CREATED' WHERE `eventType` = 'CONTRACT_CREATED';
UPDATE `application_events` SET `eventType` = 'APPLICATION_STATE_CHANGED' WHERE `eventType` = 'CONTRACT_STATE_CHANGED';
UPDATE `application_events` SET `eventType` = 'APPLICATION_SIGNED' WHERE `eventType` = 'CONTRACT_SIGNED';
UPDATE `application_events` SET `eventType` = 'APPLICATION_TERMINATED' WHERE `eventType` = 'CONTRACT_TERMINATED';
UPDATE `application_events` SET `eventType` = 'APPLICATION_TRANSFERRED' WHERE `eventType` = 'CONTRACT_TRANSFERRED';

ALTER TABLE `application_events` MODIFY `eventType` ENUM(
  'APPLICATION_CREATED', 'APPLICATION_STATE_CHANGED',
  'PHASE_ACTIVATED', 'PHASE_COMPLETED', 'STEP_COMPLETED', 'STEP_REJECTED',
  'DOCUMENT_SUBMITTED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED',
  'PAYMENT_INITIATED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'INSTALLMENTS_GENERATED',
  'APPLICATION_SIGNED', 'APPLICATION_TERMINATED', 'APPLICATION_TRANSFERRED',
  'UNDERWRITING_COMPLETED', 'OFFER_LETTER_GENERATED'
) NOT NULL;

-- Step 8: Drop old indexes
DROP INDEX `contracts_contractNumber_key` ON `applications`;
DROP INDEX `contracts_transferredFromId_key` ON `applications`;
DROP INDEX `contracts_tenantId_idx` ON `applications`;
DROP INDEX `contracts_propertyUnitId_idx` ON `applications`;
DROP INDEX `contracts_buyerId_idx` ON `applications`;
DROP INDEX `contracts_sellerId_idx` ON `applications`;
DROP INDEX `contracts_paymentMethodId_idx` ON `applications`;
DROP INDEX `contracts_status_idx` ON `applications`;
DROP INDEX `contracts_currentPhaseId_idx` ON `applications`;

DROP INDEX `contract_phases_contractId_idx` ON `application_phases`;
DROP INDEX `contract_phases_phaseCategory_idx` ON `application_phases`;
DROP INDEX `contract_phases_status_idx` ON `application_phases`;
DROP INDEX `contract_phases_order_idx` ON `application_phases`;

DROP INDEX `contract_events_contractId_idx` ON `application_events`;
DROP INDEX `contract_events_eventType_idx` ON `application_events`;
DROP INDEX `contract_events_eventGroup_idx` ON `application_events`;
DROP INDEX `contract_events_occurredAt_idx` ON `application_events`;

DROP INDEX `contract_payments_contractId_idx` ON `application_payments`;
DROP INDEX `contract_payments_phaseId_idx` ON `application_payments`;
DROP INDEX `contract_payments_installmentId_idx` ON `application_payments`;
DROP INDEX `contract_payments_payerId_idx` ON `application_payments`;
DROP INDEX `contract_payments_status_idx` ON `application_payments`;
DROP INDEX `contract_payments_reference_key` ON `application_payments`;
DROP INDEX `contract_payments_reference_idx` ON `application_payments`;

DROP INDEX `contract_documents_contractId_idx` ON `application_documents`;
DROP INDEX `contract_documents_phaseId_idx` ON `application_documents`;
DROP INDEX `contract_documents_stepId_idx` ON `application_documents`;
DROP INDEX `contract_documents_type_idx` ON `application_documents`;
DROP INDEX `contract_documents_status_idx` ON `application_documents`;

DROP INDEX `contract_refunds_contractId_idx` ON `application_refunds`;
DROP INDEX `contract_refunds_status_idx` ON `application_refunds`;
DROP INDEX `contract_refunds_tenantId_idx` ON `application_refunds`;
DROP INDEX `contract_refunds_requestedById_idx` ON `application_refunds`;

DROP INDEX `contract_terminations_contractId_idx` ON `application_terminations`;
DROP INDEX `contract_terminations_tenantId_idx` ON `application_terminations`;
DROP INDEX `contract_terminations_status_idx` ON `application_terminations`;
DROP INDEX `contract_terminations_type_idx` ON `application_terminations`;
DROP INDEX `contract_terminations_initiatorId_idx` ON `application_terminations`;
DROP INDEX `contract_terminations_requestedAt_idx` ON `application_terminations`;
DROP INDEX `contract_terminations_requestNumber_key` ON `application_terminations`;
DROP INDEX `contract_terminations_idempotencyKey_key` ON `application_terminations`;

DROP INDEX `contract_installments_paymentPhaseId_idx` ON `payment_installments`;
DROP INDEX `contract_installments_dueDate_idx` ON `payment_installments`;
DROP INDEX `contract_installments_status_idx` ON `payment_installments`;

DROP INDEX `offer_letters_contractId_idx` ON `offer_letters`;
DROP INDEX `payment_method_change_requests_contractId_idx` ON `payment_method_change_requests`;
DROP INDEX `property_transfer_requests_sourceContractId_idx` ON `property_transfer_requests`;
DROP INDEX `property_transfer_requests_targetContractId_fkey` ON `property_transfer_requests`;

-- Step 9: Create new indexes with new names
CREATE UNIQUE INDEX `applications_applicationNumber_key` ON `applications`(`applicationNumber`);
CREATE UNIQUE INDEX `applications_transferredFromId_key` ON `applications`(`transferredFromId`);
CREATE INDEX `applications_tenantId_idx` ON `applications`(`tenantId`);
CREATE INDEX `applications_propertyUnitId_idx` ON `applications`(`propertyUnitId`);
CREATE INDEX `applications_buyerId_idx` ON `applications`(`buyerId`);
CREATE INDEX `applications_sellerId_idx` ON `applications`(`sellerId`);
CREATE INDEX `applications_paymentMethodId_idx` ON `applications`(`paymentMethodId`);
CREATE INDEX `applications_status_idx` ON `applications`(`status`);
CREATE INDEX `applications_currentPhaseId_idx` ON `applications`(`currentPhaseId`);

CREATE INDEX `application_phases_applicationId_idx` ON `application_phases`(`applicationId`);
CREATE INDEX `application_phases_phaseCategory_idx` ON `application_phases`(`phaseCategory`);
CREATE INDEX `application_phases_status_idx` ON `application_phases`(`status`);
CREATE INDEX `application_phases_order_idx` ON `application_phases`(`order`);

CREATE INDEX `application_events_applicationId_idx` ON `application_events`(`applicationId`);
CREATE INDEX `application_events_eventType_idx` ON `application_events`(`eventType`);
CREATE INDEX `application_events_eventGroup_idx` ON `application_events`(`eventGroup`);
CREATE INDEX `application_events_occurredAt_idx` ON `application_events`(`occurredAt`);

CREATE INDEX `application_payments_applicationId_idx` ON `application_payments`(`applicationId`);
CREATE INDEX `application_payments_phaseId_idx` ON `application_payments`(`phaseId`);
CREATE INDEX `application_payments_installmentId_idx` ON `application_payments`(`installmentId`);
CREATE INDEX `application_payments_payerId_idx` ON `application_payments`(`payerId`);
CREATE INDEX `application_payments_status_idx` ON `application_payments`(`status`);
CREATE UNIQUE INDEX `application_payments_reference_key` ON `application_payments`(`reference`);
CREATE INDEX `application_payments_reference_idx` ON `application_payments`(`reference`);

CREATE INDEX `application_documents_applicationId_idx` ON `application_documents`(`applicationId`);
CREATE INDEX `application_documents_phaseId_idx` ON `application_documents`(`phaseId`);
CREATE INDEX `application_documents_stepId_idx` ON `application_documents`(`stepId`);
CREATE INDEX `application_documents_type_idx` ON `application_documents`(`type`);
CREATE INDEX `application_documents_status_idx` ON `application_documents`(`status`);

CREATE INDEX `application_refunds_applicationId_idx` ON `application_refunds`(`applicationId`);
CREATE INDEX `application_refunds_status_idx` ON `application_refunds`(`status`);
CREATE INDEX `application_refunds_tenantId_idx` ON `application_refunds`(`tenantId`);
CREATE INDEX `application_refunds_requestedById_idx` ON `application_refunds`(`requestedById`);

CREATE INDEX `application_terminations_applicationId_idx` ON `application_terminations`(`applicationId`);
CREATE INDEX `application_terminations_tenantId_idx` ON `application_terminations`(`tenantId`);
CREATE INDEX `application_terminations_status_idx` ON `application_terminations`(`status`);
CREATE INDEX `application_terminations_type_idx` ON `application_terminations`(`type`);
CREATE INDEX `application_terminations_initiatorId_idx` ON `application_terminations`(`initiatorId`);
CREATE INDEX `application_terminations_requestedAt_idx` ON `application_terminations`(`requestedAt`);
CREATE UNIQUE INDEX `application_terminations_requestNumber_key` ON `application_terminations`(`requestNumber`);
CREATE UNIQUE INDEX `application_terminations_idempotencyKey_key` ON `application_terminations`(`idempotencyKey`);

CREATE INDEX `payment_installments_paymentPhaseId_idx` ON `payment_installments`(`paymentPhaseId`);
CREATE INDEX `payment_installments_dueDate_idx` ON `payment_installments`(`dueDate`);
CREATE INDEX `payment_installments_status_idx` ON `payment_installments`(`status`);

CREATE INDEX `offer_letters_applicationId_idx` ON `offer_letters`(`applicationId`);
CREATE INDEX `payment_method_change_requests_applicationId_idx` ON `payment_method_change_requests`(`applicationId`);
CREATE INDEX `property_transfer_requests_sourceApplicationId_idx` ON `property_transfer_requests`(`sourceApplicationId`);

-- Step 10: Recreate foreign keys with new names
-- applications table
ALTER TABLE `applications` ADD CONSTRAINT `applications_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `applications` ADD CONSTRAINT `applications_propertyUnitId_fkey` FOREIGN KEY (`propertyUnitId`) REFERENCES `property_units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `applications` ADD CONSTRAINT `applications_buyerId_fkey` FOREIGN KEY (`buyerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `applications` ADD CONSTRAINT `applications_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `applications` ADD CONSTRAINT `applications_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `applications` ADD CONSTRAINT `applications_currentPhaseId_fkey` FOREIGN KEY (`currentPhaseId`) REFERENCES `application_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `applications` ADD CONSTRAINT `applications_transferredFromId_fkey` FOREIGN KEY (`transferredFromId`) REFERENCES `applications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- application_phases
ALTER TABLE `application_phases` ADD CONSTRAINT `application_phases_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- questionnaire_phases, documentation_phases, payment_phases
ALTER TABLE `questionnaire_phases` ADD CONSTRAINT `questionnaire_phases_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `application_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `documentation_phases` ADD CONSTRAINT `documentation_phases_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `application_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `payment_phases` ADD CONSTRAINT `payment_phases_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `application_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- application_events
ALTER TABLE `application_events` ADD CONSTRAINT `application_events_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- payment_installments
ALTER TABLE `payment_installments` ADD CONSTRAINT `payment_installments_paymentPhaseId_fkey` FOREIGN KEY (`paymentPhaseId`) REFERENCES `payment_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- application_payments
ALTER TABLE `application_payments` ADD CONSTRAINT `application_payments_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `application_payments` ADD CONSTRAINT `application_payments_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `application_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `application_payments` ADD CONSTRAINT `application_payments_installmentId_fkey` FOREIGN KEY (`installmentId`) REFERENCES `payment_installments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `application_payments` ADD CONSTRAINT `application_payments_payerId_fkey` FOREIGN KEY (`payerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- application_documents
ALTER TABLE `application_documents` ADD CONSTRAINT `application_documents_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `application_documents` ADD CONSTRAINT `application_documents_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- application_refunds
ALTER TABLE `application_refunds` ADD CONSTRAINT `application_refunds_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `application_refunds` ADD CONSTRAINT `application_refunds_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `application_refunds` ADD CONSTRAINT `application_refunds_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `application_refunds` ADD CONSTRAINT `application_refunds_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `application_refunds` ADD CONSTRAINT `application_refunds_processedById_fkey` FOREIGN KEY (`processedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- application_terminations
ALTER TABLE `application_terminations` ADD CONSTRAINT `application_terminations_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `application_terminations` ADD CONSTRAINT `application_terminations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `application_terminations` ADD CONSTRAINT `application_terminations_initiatorId_fkey` FOREIGN KEY (`initiatorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `application_terminations` ADD CONSTRAINT `application_terminations_reviewedBy_fkey` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- offer_letters
ALTER TABLE `offer_letters` ADD CONSTRAINT `offer_letters_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- payment_method_change_requests
ALTER TABLE `payment_method_change_requests` ADD CONSTRAINT `payment_method_change_requests_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- property_transfer_requests
ALTER TABLE `property_transfer_requests` ADD CONSTRAINT `property_transfer_requests_sourceApplicationId_fkey` FOREIGN KEY (`sourceApplicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `property_transfer_requests` ADD CONSTRAINT `property_transfer_requests_targetApplicationId_fkey` FOREIGN KEY (`targetApplicationId`) REFERENCES `applications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
