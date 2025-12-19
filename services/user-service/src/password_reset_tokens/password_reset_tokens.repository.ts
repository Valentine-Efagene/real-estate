import { Repository } from 'typeorm';
import { PasswordResetToken } from './password_reset_tokens.entity';

export class PasswordResetTokenRepository extends Repository<PasswordResetToken> {
  // ...
}
