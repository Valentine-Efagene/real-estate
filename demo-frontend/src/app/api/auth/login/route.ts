import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { decodeJwt } from 'jose';
import type { JwtPayload } from '@/lib/auth/types';

const COOKIE_NAME = 'qshelter_access_token';
const REFRESH_COOKIE_NAME = 'qshelter_refresh_token';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Call backend login endpoint
    const response = await fetch(`${env.userServiceUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return NextResponse.json(
        { success: false, message: data.error?.message || 'Login failed' },
        { status: response.status }
      );
    }

    const { accessToken, refreshToken, expiresIn } = data.data;

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

    // Set httpOnly cookies
    res.cookies.set(COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expiresIn, // 15 minutes
    });

    res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
