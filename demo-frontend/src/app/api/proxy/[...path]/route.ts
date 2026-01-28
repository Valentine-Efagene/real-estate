import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { decodeJwt } from 'jose';
import type { JwtPayload } from '@/lib/auth/types';

const COOKIE_NAME = 'qshelter_access_token';
const REFRESH_COOKIE_NAME = 'qshelter_refresh_token';

// Map service names to their URLs
const serviceUrls: Record<string, string> = {
  user: env.userServiceUrl,
  users: env.userServiceUrl, // Alias for user service
  property: env.propertyServiceUrl,
  mortgage: env.mortgageServiceUrl,
  documents: env.documentsServiceUrl,
  payment: env.paymentServiceUrl,
  uploader: env.uploaderServiceUrl,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params, 'PUT');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params, 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params, 'DELETE');
}

async function handleProxy(
  request: NextRequest,
  params: { path: string[] },
  method: string
) {
  const [service, ...pathParts] = params.path;
  const backendUrl = serviceUrls[service];

  if (!backendUrl) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_SERVICE', message: `Unknown service: ${service}` } },
      { status: 400 }
    );
  }

  const endpoint = '/' + pathParts.join('/');
  const url = new URL(endpoint, backendUrl);

  // Forward query params
  const searchParams = request.nextUrl.searchParams;
  searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  // Forward the request body for non-GET requests
  let body: string | undefined;
  if (method !== 'GET') {
    try {
      const text = await request.text();
      if (text) {
        body = text;
      }
    } catch {
      // No body
    }
  }

  // Get access token from httpOnly cookie
  let accessToken = request.cookies.get(COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  // Make the request with current token
  let response = await makeBackendRequest(url.toString(), method, accessToken, body);

  // If we got a 401 and have a refresh token, try to refresh and retry
  if (response.status === 401 && refreshToken) {
    console.log('[Proxy] Got 401, attempting token refresh...');

    const refreshResult = await attemptTokenRefresh(refreshToken);

    if (refreshResult.success && refreshResult.accessToken) {
      console.log('[Proxy] Token refresh successful, retrying request...');
      accessToken = refreshResult.accessToken;

      // Retry the request with the new token
      response = await makeBackendRequest(url.toString(), method, accessToken, body);

      // Return response with new cookies
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error(`[Proxy] Non-JSON response from ${url}:`, text.substring(0, 200));
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_RESPONSE', message: text.substring(0, 200) } },
          { status: response.status }
        );
      }

      const res = NextResponse.json(data, { status: response.status });

      // Set the new tokens in cookies
      res.cookies.set(COOKIE_NAME, refreshResult.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: refreshResult.expiresIn || 900, // 15 minutes default
      });

      if (refreshResult.newRefreshToken) {
        res.cookies.set(REFRESH_COOKIE_NAME, refreshResult.newRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
      }

      return res;
    } else {
      console.log('[Proxy] Token refresh failed, clearing cookies');
      // Refresh failed - clear cookies and return 401
      const res = NextResponse.json(
        { success: false, error: { code: 'SESSION_EXPIRED', message: 'Your session has expired. Please log in again.' } },
        { status: 401 }
      );
      res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
      res.cookies.set(REFRESH_COOKIE_NAME, '', { maxAge: 0, path: '/' });
      return res;
    }
  }

  // No refresh needed, return the response as-is
  try {
    const text = await response.text();

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`[Proxy] Non-JSON response from ${url}:`, text.substring(0, 200));
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_RESPONSE', message: text.substring(0, 200) } },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`Proxy error (${method} ${url}):`, error);
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message: 'Backend request failed' } },
      { status: 502 }
    );
  }
}

/**
 * Make a request to the backend with the given token
 */
async function makeBackendRequest(
  url: string,
  method: string,
  accessToken: string | undefined,
  body: string | undefined
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  console.log(`[Proxy] ${method} ${url}`);

  return fetch(url, {
    method,
    headers,
    body,
  });
}

/**
 * Attempt to refresh the access token using the refresh token
 */
async function attemptTokenRefresh(refreshToken: string): Promise<{
  success: boolean;
  accessToken?: string;
  newRefreshToken?: string;
  expiresIn?: number;
}> {
  try {
    const response = await fetch(`${env.userServiceUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false };
    }

    return {
      success: true,
      accessToken: data.data.accessToken,
      newRefreshToken: data.data.refreshToken,
      expiresIn: data.data.expiresIn,
    };
  } catch (error) {
    console.error('[Proxy] Token refresh error:', error);
    return { success: false };
  }
}
