import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import { backendAdminHeaders } from '@/lib/backend-auth';
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

/** Publie immédiatement une tâche de la queue Instagram (bouton « Publier maintenant » de l'admin). */
export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { taskId } = params;
    const response = await axios.post(
      `${getStrapiUrl()}/api/instagram/queue/${encodeURIComponent(taskId)}/publish`,
      {},
      // Deux appels Graph API (création du media container puis publication) : marge large
      { headers: backendAdminHeaders(), timeout: 90_000 }
    );
    return NextResponse.json(response.data, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.response?.data?.error || error?.response?.data || error?.message || 'Erreur serveur' },
      { status: error?.response?.status || 500 }
    );
  }
}
