import { NextRequest, NextResponse } from 'next/server';

const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://127.0.0.1:1337';

async function proxyToStrapi(request: NextRequest, path: string) {
  const url = new URL(request.url);
  const targetUrl = new URL(`${STRAPI_URL}/${path}`);
  targetUrl.search = url.search;

  const headers = new Headers();
  const requestContentType = request.headers.get('content-type');
  const authorization = request.headers.get('authorization');

  if (requestContentType) headers.set('content-type', requestContentType);
  if (authorization) headers.set('authorization', authorization);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.text() : undefined;

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
    cache: 'no-store',
  });

  const responseContentType = response.headers.get('content-type') || 'application/json';
  const responseBody = await response.text();

  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      'content-type': responseContentType,
      'cache-control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyToStrapi(request, `api/${params.path.join('/')}`);
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyToStrapi(request, `api/${params.path.join('/')}`);
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyToStrapi(request, `api/${params.path.join('/')}`);
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyToStrapi(request, `api/${params.path.join('/')}`);
}
