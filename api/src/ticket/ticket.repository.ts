import { Repository } from 'typeorm';
import { Ticket } from './ticket.entity';

export class UserRepository extends Repository<Ticket> {
  // ...
}
