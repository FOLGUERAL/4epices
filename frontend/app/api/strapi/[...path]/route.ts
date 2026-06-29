import { NextRequest, NextResponse } from 'next/server';

const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://127.0.0.1:1337';

async function proxyToStrapi(request: NextRequest, path: string) {
  const url = new URL(request.url);
  const targetUrl = new URL(`${STRAPI_URL}/${path}`);
  targetUrl.search = url.search;

  const headers = new Headers(request.headers);
  headers.delete('host');

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') || 'application/json';
  const responseBody = await response.text();

  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      'content-type': contentType,
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
