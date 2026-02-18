import { cookies } from 'next/headers';
import { decodeJwt } from 'jose';
import type { JwtPayload, UserSession } from './types';

const COOKIE_NAME = 'qshelter_access_token';
const REFRESH_COOKIE_NAME = 'qshelter_refresh_token';

/**
 * Get the current user session from cookies (server-side only)
 */
export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_NAME)?.value;

  if (!accessToken) {
    return null;
  }

  try {
    const payload = decodeJwt(accessToken) as unknown as JwtPayload;

    // Check if token is expired
    if (payload.exp * 1000 < Date.now()) {
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles,
      tenantId: payload.tenantId,
      expiresAt: payload.exp * 1000,
    };
  } catch {
    return null;
  }
}

/**
 * Get the access token from cookies (server-side only)
 */
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

/**
 * Get the refresh token from cookies (server-side only)
 */
export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE_NAME)?.value ?? null;
}

/**
 * Cookie options for auth tokens
 */
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export { COOKIE_NAME, REFRESH_COOKIE_NAME };
