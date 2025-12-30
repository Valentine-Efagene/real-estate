import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/**
 * Custom validator to ensure the value is a valid number before transformation.
 */
export function IsNaira(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'isNairaFormat',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: any, args: ValidationArguments) {
                    const nairaRegex = /^₦\d{1,3}(,\d{3})*(\.\d{2})?$/;
                    return nairaRegex.test(value);
                },
                defaultMessage(args: ValidationArguments) {
                    return `${args.property} must be a number`;
                },
            },
        });
    };
}
