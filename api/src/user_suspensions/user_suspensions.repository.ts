import { Repository } from 'typeorm';
import { UserSuspension } from './user_suspensions.entity';

export class UserSuspensionRepository extends Repository<UserSuspension> {
  // ...
}
