import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { Status } from '../common.type';

export function IsCommentRequiredIfDeclined(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isCommentRequiredIfDeclined',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(comment: any, args: ValidationArguments) {
          const obj = args.object as any;
          if (obj.status === Status.DECLINED) {
            return typeof comment === 'string' && comment.trim().length > 0;
          }
          return true; // valid otherwise
        },
        defaultMessage(args: ValidationArguments) {
          return `Comment is required when status is DECLINED.`;
        },
      },
    });
  };
}
