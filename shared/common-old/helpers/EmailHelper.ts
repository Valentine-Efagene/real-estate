
import * as Handlebars from 'handlebars';
import { FileSystemHelper } from "./FileSystemHelper";

export default class EmailHelper {
    public static async compileStringTemplate(rawTemplate: string, variables: Record<string, any>): Promise<string> {
        try {
            // Compile it with Handlebars
            const compiled = Handlebars.compile(rawTemplate);

            const html = compiled(variables);

            return html;
        } catch (error) {
            throw new Error(`Failed to generate HTML: ${error.message}`);
        }
    }

    public static async compileTemplate(templatePath: string, variables: Record<string, any>): Promise<string> {
        try {
            // Load the raw template
            const rawTemplate = FileSystemHelper.loadFile(templatePath);

            // Compile it with Handlebars
            const compiled = Handlebars.compile(rawTemplate);

            if (templatePath.includes('layout')) {
                console.log({ compiled, variables })
            }

            const html = compiled(variables);

            return html;
        } catch (error) {
            throw new Error(`Failed to generate HTML: ${error.message}`);
        }
    }
}