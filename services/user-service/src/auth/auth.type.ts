import { User } from '@valentine-efagene/qshelter-common';

/**
 * @sub User ID
 * @identifier User email
 */
export type IAccessTokenPayload = {
  sub: number;
  identifier: string;
  roles: string[]
};

export type IJwtConfig = {
  secret: string;
  expiresIn: string;
};

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IAuthTokensAndUser extends IAuthTokens {
  user: Omit<User, 'password'>
}

export interface IGoogleAuthProfileParsed {
  email: string
  firstName: string
  lastName: string
  avatar: string
}