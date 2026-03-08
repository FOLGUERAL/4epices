import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy Next.js -> Strapi
 * POST /api/pinterest/share
 * Body: { recetteId, boardId, title?, description? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recetteId, boardId, title, description } = body;

    if (!recetteId || !boardId) {
      return NextResponse.json(
        { success: false, message: 'recetteId et boardId sont requis' },
        { status: 400 }
      );
    }

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

    const cookies = request.headers.get('cookie') || '';

    const response = await axios.post(
      `${strapiUrl}/api/pinterest/share`,
      { recetteId, boardId, title, description },
      {
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookies,
        },
        timeout: 30_000,
      }
    );

    return NextResponse.json(response.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status || 500;
    const data = error?.response?.data;

    return NextResponse.json(
      {
        success: false,
        message: data?.message || error?.message || 'Erreur serveur',
        error: data,
      },
      { status }
    );
  }
}
