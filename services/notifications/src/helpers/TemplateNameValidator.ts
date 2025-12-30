import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ async: false })
export class MatchAppTemplateTypeConstraint implements ValidatorConstraintInterface {
    validate(value: string, args: ValidationArguments) {
        const [appEnum, templateTypeEnum] = args.constraints;

        // Split the input by underscore
        const [appPart, templatePart] = value.split('_');

        // Check if both parts exist and match the values in the enums
        const isValidApp = Object.values(appEnum).includes(appPart);
        const isValidTemplateType = Object.values(templateTypeEnum).includes(templatePart);

        return isValidApp && isValidTemplateType;
    }

    defaultMessage(args: ValidationArguments) {
        return `appTemplateType must be a combination of App and TemplateType enums, separated by an underscore (e.g., qshelter_mortgageSuccess).`;
    }
}

export function MatchAppTemplateType(appEnum: object, templateTypeEnum: object, validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [appEnum, templateTypeEnum],
            validator: MatchAppTemplateTypeConstraint,
        });
    };
}
