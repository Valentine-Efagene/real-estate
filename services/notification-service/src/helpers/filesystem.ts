import { readFileSync, readdirSync, statSync } from 'fs';
import { access, constants } from 'fs/promises';
import { join, dirname, basename, extname, normalize, relative } from 'path';

/** Root directory for templates */
// In Lambda, __dirname is /var/task/dist, templates are at /var/task/dist/templates
const TEMPLATES_ROOT = join(__dirname, 'templates/');

// Template cache for frequently accessed templates
const templateCache = new Map<string, string>();

/**
 * Get the full file path for a template file
 */
export function getFilePath(fileName: string): string {
    return join(TEMPLATES_ROOT, fileName);
}

/**
 * Check if a file exists in the templates directory
 */
export async function checkFileExists(fileName: string): Promise<boolean> {
    const filePath = join(TEMPLATES_ROOT, fileName);
    try {
        await access(filePath, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Load file content by full path
 * Uses caching for repeated reads of the same file
 */
export function loadFileWithFullPath(filePath: string, useCache = false): string {
    if (useCache) {
        const cached = templateCache.get(filePath);
        if (cached) return cached;
    }

    const content = readFileSync(filePath, 'utf-8');

    if (useCache) {
        templateCache.set(filePath, content);
    }

    return content;
}

/**
 * Load file content relative to templates directory
 */
export function loadFile(fileName: string, useCache = false): string {
    const filePath = join(TEMPLATES_ROOT, fileName);
    return loadFileWithFullPath(filePath, useCache);
}

/**
 * Load a template file (alias for loadFile with caching enabled)
 */
export function loadTemplate(fileName: string): string {
    return loadFile(fileName, true);
}

/**
 * Clear the template cache
 * Useful for development or when templates are updated
 */
export function clearTemplateCache(): void {
    templateCache.clear();
}

/**
 * Split a file path into its components
 */
export function splitFilePath(filePath: string): {
    folderArray: string[];
    folderPath: string;
    fileName: string;
    extension: string;
} {
    const normalizedPath = normalize(filePath).replace(/\\/g, '/');
    const fileName = basename(normalizedPath);
    const directoryPath = dirname(normalizedPath);
    const extension = extname(fileName);
    const folderArray = directoryPath.split('/');

    return {
        folderArray,
        folderPath: folderArray.join('/'),
        fileName,
        extension,
    };
}

/**
 * List all template files (.hbs) in the templates directory recursively
 */
export function listHtmlFilesInTemplates(): string[] {
    const templateFiles: string[] = [];

    function getFilesRecursively(dir: string): void {
        try {
            const entries = readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(dir, entry.name);

                if (entry.isDirectory()) {
                    getFilesRecursively(fullPath);
                } else if (entry.name.endsWith('.hbs')) {
                    templateFiles.push(relative(TEMPLATES_ROOT, fullPath));
                }
            }
        } catch (error) {
            console.error('Error reading directory:', error);
            throw error;
        }
    }

    getFilesRecursively(TEMPLATES_ROOT);
    return templateFiles;
}

/**
 * List all files with a specific extension in templates directory
 */
export function listTemplateFilesByExtension(extension: string): string[] {
    const files: string[] = [];
    const ext = extension.startsWith('.') ? extension : `.${extension}`;

    function getFilesRecursively(dir: string): void {
        try {
            const entries = readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(dir, entry.name);

                if (entry.isDirectory()) {
                    getFilesRecursively(fullPath);
                } else if (entry.name.endsWith(ext)) {
                    files.push(relative(TEMPLATES_ROOT, fullPath));
                }
            }
        } catch (error) {
            console.error('Error reading directory:', error);
            throw error;
        }
    }

    getFilesRecursively(TEMPLATES_ROOT);
    return files;
}

/**
 * Get the templates root directory path
 */
export function getTemplatesRoot(): string {
    return TEMPLATES_ROOT;
}
