import * as Handlebars from 'handlebars';
import * as path from 'path';
import * as fs from 'fs';
import { checkFileExists as fsCheckFileExists, loadFileWithFullPath, getTemplatesRoot } from './filesystem';

/**
 * Email template constants loaded from environment variables
 */
export const constants = {
    firstEmail: process.env.FIRST_EMAIL,
    secondEmail: process.env.QSHELTER_INFO_EMAIL,
    thirdEmail: process.env.QSHELTER_EMAIL,
    websiteLink: process.env.WEBSITE_LINK,
    logoUrl: process.env.LOGO_URL,
    firstPhoneLink: process.env.FIRST_PHONE_LINK,
    secondPhoneLink: process.env.SECOND_PHONE_LINK,
    firstPhoneNumber: process.env.FIRST_PHONE_NUMBER,
    secondPhoneNumber: process.env.SECOND_PHONE_NUMBER,
    officeAddress: process.env.OFFICE_ADDRESS,
    facebookLink: process.env.FACEBOOK_LINK,
    facebookLogo: process.env.FACEBOOK_LOGO,
    twitterLink: process.env.TWITTER_LINK,
    twitterLogo: process.env.TWITTER_LOGO,
    instagramLink: process.env.INSTAGRAM_LINK,
    instagramLogo: process.env.INSTAGRAM_LOGO,
    youtubeLink: process.env.YOUTUBE_LINK,
    youtubeLogo: process.env.YOUTUBE_LOGO,
    linkedinLink: process.env.LINKEDIN_LINK,
    linkedinLogo: process.env.LINKEDIN_LOGO,
    firstOfficeAddress: process.env.FIRST_OFFICE_ADDRESS,
    secondOfficeAddress: process.env.SECOND_OFFICE_ADDRESS,
    qshelterLink: process.env.QSHELTER_LINK,
    qshelterLogo: process.env.QSHELTER_LOGO,
    supportPhone: process.env.SUPPORT_PHONE,
    supportEmail: process.env.SUPPORT_EMAIL,
    companyLogo: process.env.COMPANY_LOGO,
    bannerUrl: process.env.BANNER_URL,
    projectName: process.env.PROJECT_NAME,
    poweredBy: process.env.POWERED_BY,
    companySignature: process.env.COMPANY_SIGNATURE,
    year: new Date().getFullYear(),
};

/**
 * Remove null, undefined, and empty string properties from an object
 */
export function removeNullishProperties<T extends object>(obj: T): Partial<T> {
    const result: Partial<T> = {};

    Object.entries(obj).forEach(([key, value]) => {
        if (value != null && value != '') {
            result[key as keyof T] = value;
        }

        if (value == 0) {
            result[key as keyof T] = '0' as never;
        }
    });

    return result;
}

/**
 * Build the template name (currently a passthrough, but can be extended)
 */
export function buildTemplateName(templateName: string): string {
    return templateName;
}

// Handlebars initialization state
let handlebarsInitialized = false;

/**
 * Register custom Handlebars helpers and partials
 */
function initHandlebars(): void {
    if (handlebarsInitialized) return;
    handlebarsInitialized = true;

    // Debug helper
    Handlebars.registerHelper('debug', function (optionalValue) {
        console.log('DEBUG:', optionalValue);
        return '';
    });

    // Register the main layout as a partial
    registerLayoutPartials();
}

/**
 * Register layout templates as partials for use with {{> layout}} syntax
 */
function registerLayoutPartials(): void {
    try {
        const layoutsDir = path.join(__dirname, '../templates/layouts');

        if (fs.existsSync(layoutsDir)) {
            const layoutFiles = fs.readdirSync(layoutsDir).filter(f => f.endsWith('.hbs'));

            for (const file of layoutFiles) {
                const layoutName = path.basename(file, '.hbs');
                const layoutPath = path.join(layoutsDir, file);
                const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
                Handlebars.registerPartial(layoutName, layoutContent);
            }
        }
    } catch (error) {
        console.warn('Could not register layout partials:', error);
    }
}

/**
 * Compile a Handlebars template string with the provided data
 */
export async function compileTemplate(
    template: string,
    data: Record<string, unknown>
): Promise<string> {
    initHandlebars();
    const compiledTemplate = Handlebars.compile(template);
    return compiledTemplate(data);
}

/**
 * Compile a template using a layout
 * The content template is compiled and passed to the layout as {{{body}}}
 */
export async function compileWithLayout(
    contentTemplate: string,
    data: Record<string, unknown>,
    layoutName: string = 'main'
): Promise<string> {
    initHandlebars();

    // First compile the content
    const contentCompiled = Handlebars.compile(contentTemplate);
    const bodyContent = contentCompiled(data);

    // Then compile the layout with the body content
    const layoutPath = path.join(__dirname, '../templates/layouts', `${layoutName}.hbs`);
    const layoutTemplate = fs.readFileSync(layoutPath, 'utf-8');
    const layoutCompiled = Handlebars.compile(layoutTemplate);

    return layoutCompiled({ ...data, body: bodyContent });
}

/**
 * Check if a template file exists
 */
export async function checkTemplateFileExists(
    module: string,
    fileName: string
): Promise<boolean> {
    try {
        const filePath = path.join(module, fileName);
        return fsCheckFileExists(filePath);
    } catch (error) {
        console.error('Error checking template file:', error);
        return false;
    }
}

/**
 * Load a content template and compile it with the main layout
 */
export async function loadAndCompileTemplate(
    templatePath: string,
    data: Record<string, unknown>
): Promise<string> {
    const templatesRoot = getTemplatesRoot();
    const contentPath = templatePath.replace('.html', '.hbs').replace(/^/, 'content/');
    const fullPath = path.join(templatesRoot, contentPath);

    if (fs.existsSync(fullPath)) {
        // New .hbs content template exists, use layout system
        const contentTemplate = loadFileWithFullPath(fullPath, true);
        return compileWithLayout(contentTemplate, data);
    }

    // Fall back to legacy HTML template
    const legacyPath = path.join(templatesRoot, templatePath);
    const template = loadFileWithFullPath(legacyPath);
    return compileTemplate(template, data);
}
