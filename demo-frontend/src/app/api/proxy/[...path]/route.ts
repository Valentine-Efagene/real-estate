import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

const COOKIE_NAME = 'qshelter_access_token';

// Map service names to their URLs
const serviceUrls: Record<string, string> = {
  user: env.userServiceUrl,
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

  // Get access token from httpOnly cookie
  const accessToken = request.cookies.get(COOKIE_NAME)?.value;

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

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

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body,
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`Proxy error (${method} ${url}):`, error);
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message: 'Backend request failed' } },
      { status: 502 }
    );
  }
}
