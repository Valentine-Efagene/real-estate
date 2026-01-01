import * as Handlebars from 'handlebars';
import * as path from 'path';
import { FileSystemHelper } from './FileSystemHelper';

export class UtilHelper {
    public static readonly constants = {
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

    public static removeNullishProperties<T extends object>(obj: T): Partial<T> {
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

    public static buildTemplateName(templateName: string) {
        return templateName;
    }

    private static initialized = false;

    private static initHandlebarsHelpers() {
        if (this.initialized) return;
        this.initialized = true;

        Handlebars.registerHelper('debug', function (optionalValue) {
            console.log("DEBUG:", optionalValue);
            return '';
        });
    }

    public static async compileTemplate(template: string, data: Record<string, unknown>) {
        const compiledTemplate = Handlebars.compile(template);
        return compiledTemplate(data);
    }

    public static async checkTemplateFileExists(module: string, fileName: string): Promise<boolean> {
        try {
            const filePath = path.join(module, fileName);
            return FileSystemHelper.checkFileExists(filePath);
        } catch (error) {
            console.log(error);
            return false;
        }
    }
}
