import {
    AbilityBuilder,
    ExtractSubjectType,
    InferSubjects,
    MongoAbility,
    createMongoAbility,
} from '@casl/ability';
import { User } from "../../user/user.entity";
import { Property } from "../../property/property.entity";
import { Action } from '../casl.enum';
import { Injectable } from '@nestjs/common';
import { RoleName } from '../../role/role.enums';
import { PropertyStatus } from '../../property/property.type';

type Subjects = InferSubjects<typeof Property | typeof User> | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
    createForUser(user: User) {
        const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

        if (user.roles.find((role) => role.name === RoleName.ADMIN)) {
            can(Action.Manage, 'all'); // read-write access to everything
        } else {
            can(Action.Read, 'all'); // read-only access to everything
        }

        can(Action.Update, Property, { userId: user.id });
        cannot(Action.Delete, Property, { status: PropertyStatus.APPROVED });

        return build({
            // Read https://casl.js.org/v6/en/guide/subject-type-detection#use-classes-as-subject-types for details
            detectSubjectType: (item) =>
                item.constructor as ExtractSubjectType<Subjects>,
        });
    }
}
