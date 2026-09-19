import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';

function resolveStrapiUrl(): string {
  let strapiUrl =
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
  if (
    strapiUrl.includes('backend:1337') &&
    process.env.NEXT_PUBLIC_STRAPI_URL &&
    process.env.NEXT_PUBLIC_STRAPI_URL.includes('https://')
  ) {
    strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL;
  }
  return strapiUrl.replace(/\/$/, '');
}

async function proxyToStrapi(
  request: NextRequest,
  id: string,
  method: 'PUT' | 'DELETE',
  body?: unknown
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const token = process.env.STRAPI_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'STRAPI_API_TOKEN non configuré côté serveur' },
      { status: 500 }
    );
  }

  const strapiUrl = resolveStrapiUrl();
  const url = `${strapiUrl}/api/avis-recettes/${encodeURIComponent(id)}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: method === 'PUT' && body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { error: 'Réponse Strapi invalide', raw: text.slice(0, 500) },
      { status: 502 }
    );
  }

  return NextResponse.json(json, { status: res.status });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    return proxyToStrapi(request, params.id, 'PUT', body);
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return proxyToStrapi(request, params.id, 'DELETE');
}
