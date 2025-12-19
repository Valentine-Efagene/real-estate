import { Repository } from 'typeorm';
import { Transaction } from './transaction.entity';

export class MortgageRepository extends Repository<Transaction> {
  // ...
}
