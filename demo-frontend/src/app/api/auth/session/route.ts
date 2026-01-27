import { NextRequest, NextResponse } from 'next/server';
import { decodeJwt } from 'jose';
import type { JwtPayload } from '@/lib/auth/types';

const COOKIE_NAME = 'qshelter_access_token';

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get(COOKIE_NAME)?.value;

    if (!accessToken) {
      return NextResponse.json({ user: null });
    }

    const payload = decodeJwt(accessToken) as unknown as JwtPayload;

    // Check if token is expired
    if (payload.exp * 1000 < Date.now()) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        userId: payload.sub,
        email: payload.email,
        roles: payload.roles,
        tenantId: payload.tenantId,
        expiresAt: payload.exp * 1000,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
