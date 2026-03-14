import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Même logique que /api/pinterest/me
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

    const response = await axios.post(
      `${strapiUrl}/api/pinterest/process-queue`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Cron-Source': 'admin', // Identifier comme appel depuis l'admin
        },
        timeout: 15_000,
      }
    );

    return NextResponse.json(response.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status || 500;
    const data = error?.response?.data;

    return NextResponse.json(
      {
        error: data || error?.message || 'Erreur serveur',
      },
      { status }
    );
  }
}
