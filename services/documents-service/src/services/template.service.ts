import { prisma } from '../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import Handlebars from 'handlebars';
import type {
    CreateTemplateInput,
    UpdateTemplateInput,
    GenerateDocumentInput,
    ListTemplatesInput,
    CreateTemplateVersionInput,
} from '../validators/template.validator';

// Register custom Handlebars helpers
Handlebars.registerHelper('formatCurrency', function (amount: number, currency = 'NGN') {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency,
    }).format(amount || 0);
});

Handlebars.registerHelper('formatDate', function (date: Date | string) {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
});

Handlebars.registerHelper('uppercase', function (str: string) {
    return str ? str.toUpperCase() : '';
});

Handlebars.registerHelper('lowercase', function (str: string) {
    return str ? str.toLowerCase() : '';
});

Handlebars.registerHelper('eq', function (a: any, b: any) {
    return a === b;
});

Handlebars.registerHelper('ne', function (a: any, b: any) {
    return a !== b;
});

Handlebars.registerHelper('currentYear', function () {
    return new Date().getFullYear();
});

Handlebars.registerHelper('currentDate', function () {
    return new Date().toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
});

/**
 * Template service interface
 */
export interface TemplateService {
    create(data: CreateTemplateInput, tenantId: string): Promise<any>;
    findById(id: string): Promise<any>;
    findByCode(code: string, tenantId: string, version?: number): Promise<any>;
    findAll(filters: ListTemplatesInput, tenantId: string): Promise<any[]>;
    update(id: string, data: UpdateTemplateInput): Promise<any>;
    createVersion(id: string, data: CreateTemplateVersionInput): Promise<any>;
    delete(id: string): Promise<{ success: boolean }>;
    generate(data: GenerateDocumentInput, tenantId: string): Promise<{ html: string; mergeData: Record<string, any> }>;
    validateTemplate(htmlTemplate: string): { valid: boolean; error?: string };
    extractMergeFields(htmlTemplate: string): string[];
}

class TemplateServiceImpl implements TemplateService {
    /**
     * Create a new template
     */
    async create(data: CreateTemplateInput, tenantId: string): Promise<any> {
        // Validate template syntax
        const validation = this.validateTemplate(data.htmlTemplate);
        if (!validation.valid) {
            throw new AppError(400, `Invalid template: ${validation.error}`);
        }

        // Check for duplicate code in same tenant
        const existing = await prisma.documentTemplate.findFirst({
            where: {
                tenantId,
                code: data.code,
            },
        });

        if (existing) {
            throw new AppError(400, `Template with code ${data.code} already exists`);
        }

        // If setting as default, unset other defaults for same code
        if (data.isDefault) {
            await prisma.documentTemplate.updateMany({
                where: {
                    tenantId,
                    code: data.code,
                    isDefault: true,
                },
                data: { isDefault: false },
            });
        }

        const template = await prisma.documentTemplate.create({
            data: {
                tenantId,
                name: data.name,
                code: data.code,
                description: data.description,
                htmlTemplate: data.htmlTemplate,
                cssStyles: data.cssStyles,
                mergeFields: data.mergeFields || this.extractMergeFieldsAsJson(data.htmlTemplate),
                version: 1,
                isDefault: data.isDefault ?? true, // First template is default
            },
        });

        return template;
    }

    /**
     * Find template by ID
     */
    async findById(id: string): Promise<any> {
        const template = await prisma.documentTemplate.findUnique({
            where: { id },
        });

        if (!template) {
            throw new AppError(404, 'Template not found');
        }

        return template;
    }

    /**
     * Find template by code (optionally specific version)
     */
    async findByCode(code: string, tenantId: string, version?: number): Promise<any> {
        let template;

        if (version) {
            template = await prisma.documentTemplate.findFirst({
                where: {
                    tenantId,
                    code,
                    version,
                },
            });
        } else {
            // Get the default or latest active version
            template = await prisma.documentTemplate.findFirst({
                where: {
                    tenantId,
                    code,
                    isActive: true,
                    isDefault: true,
                },
            });

            if (!template) {
                // Fallback to latest active version
                template = await prisma.documentTemplate.findFirst({
                    where: {
                        tenantId,
                        code,
                        isActive: true,
                    },
                    orderBy: { version: 'desc' },
                });
            }
        }

        if (!template) {
            throw new AppError(404, `Template with code ${code} not found`);
        }

        return template;
    }

    /**
     * Find all templates for a tenant
     */
    async findAll(filters: ListTemplatesInput, tenantId: string): Promise<any[]> {
        const where: any = { tenantId };

        if (filters.code) {
            where.code = filters.code;
        }

        if (filters.isActive !== undefined) {
            where.isActive = filters.isActive;
        }

        return prisma.documentTemplate.findMany({
            where,
            orderBy: [{ code: 'asc' }, { version: 'desc' }],
        });
    }

    /**
     * Update a template
     */
    async update(id: string, data: UpdateTemplateInput): Promise<any> {
        const template = await this.findById(id);

        // Validate new template if provided
        if (data.htmlTemplate) {
            const validation = this.validateTemplate(data.htmlTemplate);
            if (!validation.valid) {
                throw new AppError(400, `Invalid template: ${validation.error}`);
            }
        }

        // If setting as default, unset other defaults for same code
        if (data.isDefault) {
            await prisma.documentTemplate.updateMany({
                where: {
                    tenantId: template.tenantId,
                    code: template.code,
                    isDefault: true,
                    id: { not: id },
                },
                data: { isDefault: false },
            });
        }

        const updated = await prisma.documentTemplate.update({
            where: { id },
            data,
        });

        return updated;
    }

    /**
     * Create a new version of a template
     */
    async createVersion(id: string, data: CreateTemplateVersionInput): Promise<any> {
        const original = await this.findById(id);

        // Validate template syntax
        const validation = this.validateTemplate(data.htmlTemplate);
        if (!validation.valid) {
            throw new AppError(400, `Invalid template: ${validation.error}`);
        }

        // Get the highest version for this code
        const latestVersion = await prisma.documentTemplate.findFirst({
            where: {
                tenantId: original.tenantId,
                code: original.code,
            },
            orderBy: { version: 'desc' },
            select: { version: true },
        });

        const newVersion = (latestVersion?.version || 0) + 1;

        // Create new version
        const newTemplate = await prisma.documentTemplate.create({
            data: {
                tenantId: original.tenantId,
                name: original.name,
                code: original.code,
                description: original.description,
                htmlTemplate: data.htmlTemplate,
                cssStyles: data.cssStyles ?? original.cssStyles,
                mergeFields: data.mergeFields || this.extractMergeFieldsAsJson(data.htmlTemplate),
                version: newVersion,
                isDefault: true, // New version becomes default
                isActive: true,
            },
        });

        // Unset default on old versions
        await prisma.documentTemplate.updateMany({
            where: {
                tenantId: original.tenantId,
                code: original.code,
                id: { not: newTemplate.id },
            },
            data: { isDefault: false },
        });

        return newTemplate;
    }

    /**
     * Delete a template (soft delete by deactivating)
     */
    async delete(id: string): Promise<{ success: boolean }> {
        await this.findById(id);

        await prisma.documentTemplate.update({
            where: { id },
            data: { isActive: false },
        });

        return { success: true };
    }

    /**
     * Generate HTML document from template with merge data
     */
    async generate(
        data: GenerateDocumentInput,
        tenantId: string
    ): Promise<{ html: string; mergeData: Record<string, any> }> {
        let template;

        if (data.templateId) {
            template = await this.findById(data.templateId);
        } else if (data.templateCode) {
            template = await this.findByCode(data.templateCode, tenantId);
        } else {
            throw new AppError(400, 'Either templateId or templateCode must be provided');
        }

        // Compile and render template
        const compiledTemplate = Handlebars.compile(template.htmlTemplate);
        const html = compiledTemplate(data.mergeData);

        // Wrap with CSS if provided
        let fullHtml = html;
        if (template.cssStyles) {
            fullHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>${template.cssStyles}</style>
</head>
<body>
    ${html}
</body>
</html>`;
        }

        return {
            html: fullHtml,
            mergeData: data.mergeData,
        };
    }

    /**
     * Validate Handlebars template syntax
     */
    validateTemplate(htmlTemplate: string): { valid: boolean; error?: string } {
        try {
            Handlebars.compile(htmlTemplate);
            return { valid: true };
        } catch (error: any) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Extract merge field names from template
     */
    extractMergeFields(htmlTemplate: string): string[] {
        const regex = /\{\{([^{}#/]+)\}\}/g;
        const fields = new Set<string>();
        let match;

        while ((match = regex.exec(htmlTemplate)) !== null) {
            const field = match[1].trim();
            // Skip helpers
            if (!field.includes(' ') && !field.startsWith('!')) {
                fields.add(field);
            }
        }

        return Array.from(fields);
    }

    /**
     * Extract merge fields as JSON schema
     */
    private extractMergeFieldsAsJson(htmlTemplate: string): any[] {
        const fieldNames = this.extractMergeFields(htmlTemplate);
        return fieldNames.map((name) => ({
            name,
            type: 'string',
            required: true,
            description: `Merge field: ${name}`,
        }));
    }
}

export const templateService: TemplateService = new TemplateServiceImpl();
