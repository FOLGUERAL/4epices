import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId est requis' },
        { status: 400 }
      );
    }

    // Même logique que les autres routes Pinterest
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

    // Encoder le taskId pour l'URL (au cas où il contiendrait des caractères spéciaux)
    const encodedTaskId = encodeURIComponent(taskId);

    const response = await axios.delete(
      `${strapiUrl}/api/pinterest/queue/${encodedTaskId}`,
      {
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
