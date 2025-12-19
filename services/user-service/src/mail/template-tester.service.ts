import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import EmailHelper from '../common/helpers/EmailHelper';

@Injectable()
export class TemplateTesterService {
    private readonly outputDir = path.resolve(__dirname, '../../test_output/emails');

    constructor() {
        // Ensure output dir exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async generateEmailHtml(templatePath: string, variables: Record<string, any>, outputFileName: string): Promise<string> {
        const header = await EmailHelper.compileTemplate(`partials/header.hbs`, variables)
        const footer = await EmailHelper.compileTemplate(`partials/footer.hbs`, variables)
        const body = await EmailHelper.compileTemplate(`${templatePath}.hbs`, variables)

        // We need to use this one, because the original layout expects a partial
        const completeHtml = await EmailHelper.compileTemplate(`layouts/test-layout.hbs`, {
            ...variables,
            header,
            footer,
            body
        })

        try {
            // Write to file
            const outputPath = path.join(this.outputDir, `${outputFileName}.html`);
            fs.writeFileSync(outputPath, completeHtml, 'utf-8');

            return outputPath;
        } catch (error) {
            throw new Error(`Failed to generate HTML: ${error.message}`);
        }
    }
}
