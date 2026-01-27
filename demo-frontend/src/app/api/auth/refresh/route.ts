import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { decodeJwt } from 'jose';
import type { JwtPayload } from '@/lib/auth/types';

const COOKIE_NAME = 'qshelter_access_token';
const REFRESH_COOKIE_NAME = 'qshelter_refresh_token';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, message: 'No refresh token' },
        { status: 401 }
      );
    }

    // Call backend refresh endpoint
    const response = await fetch(`${env.userServiceUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      // Clear cookies on refresh failure
      const res = NextResponse.json(
        { success: false, message: 'Session expired' },
        { status: 401 }
      );
      res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
      res.cookies.set(REFRESH_COOKIE_NAME, '', { maxAge: 0, path: '/' });
      return res;
    }

    const { accessToken, refreshToken: newRefreshToken, expiresIn } = data.data;

    // Decode JWT to get user info
    const payload = decodeJwt(accessToken) as unknown as JwtPayload;

    // Create response with user session
    const res = NextResponse.json({
      success: true,
      user: {
        userId: payload.sub,
        email: payload.email,
        roles: payload.roles,
        tenantId: payload.tenantId,
        expiresAt: payload.exp * 1000,
      },
    });

    // Set new httpOnly cookies
    res.cookies.set(COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expiresIn,
    });

    // Rotate refresh token if provided
    if (newRefreshToken) {
      res.cookies.set(REFRESH_COOKIE_NAME, newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return res;
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
