import { Repository } from 'typeorm';
import { Wallet } from './wallet.entity';

export class MortgageRepository extends Repository<Wallet> {
  // ...
}
