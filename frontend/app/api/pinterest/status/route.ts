import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy Next.js -> Strapi
 * GET /api/pinterest/status
 */
export async function GET(request: NextRequest) {
  try {
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

    // Transmettre les cookies de session
    const cookies = request.headers.get('cookie') || '';

    const response = await axios.get(`${strapiUrl}/api/pinterest/status`, {
      headers: {
        Cookie: cookies,
      },
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
