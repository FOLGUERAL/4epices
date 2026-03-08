import axios from 'axios';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy Next.js -> Strapi
 * Permet au frontend d'appeler /api/pinterest/me sans gérer le CORS / URL Strapi côté client.
 */
export async function GET() {
  try {
    // Même logique que /api/publish-pinterest
    let strapiUrl =
      process.env.STRAPI_URL ||
      process.env.NEXT_PUBLIC_STRAPI_URL ||
      'http://localhost:1337';

    if (
      strapiUrl.includes('backend:1337') &&
      process.env.NEXT_PUBLIC_STRAPI_URL &&
      process.env.NEXT_PUBLIC_STRAPI_URL.includes('https://')
    ) {
      strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL;
    }

    const response = await axios.get(`${strapiUrl}/api/pinterest/me`, {
      timeout: 15_000,
    });

    return NextResponse.json(response.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status || 500;
    const data = error?.response?.data;

    return NextResponse.json(
      {
        connected: false,
        error: data || error?.message || 'Erreur serveur',
      },
      { status }
    );
  }
}

