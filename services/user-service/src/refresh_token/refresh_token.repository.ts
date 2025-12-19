import { Repository } from 'typeorm';
import { RefreshToken } from './refresh_token.entity';

export class RefreshTokenRepository extends Repository<RefreshToken> {
  // ...
}
