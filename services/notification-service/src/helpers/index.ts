/**
 * Helpers module - centralized exports for all helper functions
 * 
 * Usage:
 *   import { formatNaira, templatePathMap, loadFile } from '../helpers';
 */

// Data helpers - template mappings
export {
    templatePathMap,
    templateTitle,
    getDynamicTemplates,
    isDynamicTemplate,
    getTemplatePath,
    getTemplateTitle,
} from './data';

// Filesystem helpers
export {
    getFilePath,
    checkFileExists,
    loadFile,
    loadFileWithFullPath,
    loadTemplate,
    clearTemplateCache,
    splitFilePath,
    listHtmlFilesInTemplates,
    listTemplateFilesByExtension,
    getTemplatesRoot,
} from './filesystem';

// Format helpers - number, date, currency formatting
export {
    formatNaira,
    formatDate,
    formatDateTime,
    formatShortDate,
    formatIsoDate,
    formatNumber,
    formatPercent,
    formatPhoneNumber,
    formatFileSize,
    formatDuration,
} from './format';

// Utility helpers - templates, constants
export {
    constants,
    removeNullishProperties,
    buildTemplateName,
    compileTemplate,
    compileWithLayout,
    checkTemplateFileExists,
    loadAndCompileTemplate,
} from './utils';

// Response helpers
export { createResponse, type StandardApiResponse } from './response';
