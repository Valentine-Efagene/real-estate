import { PasswordResetToken } from '@valentine-efagene/entities';
import { Repository } from 'typeorm';

export class PasswordResetTokenRepository extends Repository<PasswordResetToken> {
  // ...
}
