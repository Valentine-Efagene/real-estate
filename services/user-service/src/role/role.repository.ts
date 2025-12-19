import { Repository } from 'typeorm';
import { Role } from './role.entity';

export class RoleRepository extends Repository<Role> {
  // ...
}
