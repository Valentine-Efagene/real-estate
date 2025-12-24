import { PasswordResetToken } from '@valentine-efagene/qshelter-common';
import { Repository } from 'typeorm';

export class PasswordResetTokenRepository extends Repository<PasswordResetToken> {
  // ...
}
