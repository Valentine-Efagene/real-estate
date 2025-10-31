/**
 * @Reference
 * https://github.com/nest-modules/mailer/blob/main/lib/adapters/handlebars.adapter.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { inline } from '@css-inline/css-inline';
import * as glob from 'glob';
import { get } from 'lodash';
import { HelperDeclareSpec } from 'handlebars';
import { MailerOptions, TemplateAdapter } from '@nestjs-modules/mailer';
import { TemplateAdapterConfig } from '@nestjs-modules/mailer/dist/interfaces/template-adapter-config.interface';

export class CustomeHandlebarsAdapter implements TemplateAdapter {
    private precompiledTemplates: {
        [name: string]: handlebars.TemplateDelegate;
    } = {};

    private config: TemplateAdapterConfig = {
        inlineCssOptions: {},
        inlineCssEnabled: true,
    };

    constructor(helpers?: HelperDeclareSpec, config?: TemplateAdapterConfig) {
        handlebars.registerHelper('concat', (...args) => {
            args.pop();
            return args.join('');
        });
        handlebars.registerHelper(helpers || {});
        Object.assign(this.config, config);
    }

    public compile(mail: any, callback: any, mailerOptions: MailerOptions): void {
        // Register layout
        const layoutPath = path.join(__dirname, 'templates/layouts/layout.hbs');
        const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
        handlebars.registerPartial('layout', layoutContent);

        const precompile = (template: any, callback: any, options: any) => {
            const templateBaseDir = get(options, 'dir', '');
            const templateExt = path.extname(template) || '.hbs';
            let templateName = path.basename(template, path.extname(template));
            const templateDir = path.isAbsolute(template)
                ? path.dirname(template)
                : path.join(templateBaseDir, path.dirname(template));
            const templatePath = path.join(templateDir, templateName + templateExt);
            templateName = path
                .relative(templateBaseDir, templatePath)
                .replace(templateExt, '');

            if (!this.precompiledTemplates[templateName]) {
                try {
                    const template = fs.readFileSync(templatePath, 'utf-8');

                    this.precompiledTemplates[templateName] = handlebars.compile(
                        template,
                        get(options, 'options', {}),
                    );
                } catch (err) {
                    return callback(err);
                }
            }

            return {
                templateExt,
                templateName,
                templateDir,
                templatePath,
            };
        };

        const { templateName } = precompile(
            mail.data.template,
            callback,
            mailerOptions.template,
        );

        const runtimeOptions = get(mailerOptions, 'options', {
            partials: false,
            data: {},
        });


        if (runtimeOptions.partials) {
            const partialPath = path
                .join(runtimeOptions.partials.dir, '**', '*.hbs')
                .replace(/\\/g, '/');

            const files = glob.sync(partialPath);

            files.forEach((file) => {
                const { templateName, templatePath } = precompile(
                    file,
                    () => { },
                    runtimeOptions.partials,
                );
                const templateDir = path.relative(
                    runtimeOptions.partials.dir,
                    path.dirname(templatePath),
                );
                handlebars.registerPartial(
                    path.join(templateDir, templateName),
                    fs.readFileSync(templatePath, 'utf-8'),
                );
            });
        }

        const renderedBody = this.precompiledTemplates[templateName](
            mail.data.context,
            {
                ...runtimeOptions,
                partials: this.precompiledTemplates,
            },
        );

        // Render layout using the context + rendered body
        const layoutTemplate = handlebars.compile(layoutContent);

        const rendered = layoutTemplate({
            ...mail.data.context,
            body: renderedBody, // injects into {{{body}}}
        });

        if (this.config.inlineCssEnabled) {
            try {
                mail.data.html = inline(rendered, this.config.inlineCssOptions);
            } catch (e) {
                callback(e);
            }
        } else {
            mail.data.html = rendered;
        }
        return callback();
    }
}