-- AddForeignKey
ALTER TABLE `application_organizations` ADD CONSTRAINT `application_organizations_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `application_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
