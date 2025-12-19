import { Repository } from 'typeorm';
import { Social } from './social.entity';

export class UserRepository extends Repository<Social> {
  // ...
}
