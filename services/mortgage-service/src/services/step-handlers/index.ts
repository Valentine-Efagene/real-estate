/**
 * Step Handlers
 * 
 * Each step type can have a handler that executes when the step is activated or completed.
 * This allows for configurable behavior without hardcoding business logic.
 */

export {
    handleGenerateDocumentStep,
    validateGenerateDocumentMetadata,
    type GenerateDocumentMetadata
} from './generate-document.handler';
