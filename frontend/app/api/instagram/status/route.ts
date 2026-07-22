import { NextResponse } from 'next/server';
import axios from 'axios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getStrapiUrl() {
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

  return strapiUrl;
}

export async function GET() {
  try {
    const response = await axios.get(`${getStrapiUrl()}/api/instagram/status`, {
      timeout: 15_000,
    });
    return NextResponse.json(response.data, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { connected: false, error: error?.response?.data || error?.message || 'Erreur serveur' },
      { status: error?.response?.status || 500 }
    );
  }
}
