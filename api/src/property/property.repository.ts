import { Repository } from 'typeorm';
import { Property } from './property.entity';

export class UserRepository extends Repository<Property> {
  // ...
}
