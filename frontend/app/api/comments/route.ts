import { NextRequest, NextResponse } from 'next/server';

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || process.env.STRAPI_URL || 'http://localhost:1337';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    
    const url = queryString 
      ? `${STRAPI_URL}/api/comments?${queryString}`
      : `${STRAPI_URL}/api/comments`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // Si l'endpoint n'existe pas (404), retourner un tableau vide
      if (response.status === 404) {
        return NextResponse.json({ data: [] });
      }
      const error = await response.json().catch(() => ({ message: 'Erreur serveur' }));
      return NextResponse.json(
        { error: error.message || 'Erreur lors de la récupération des commentaires' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Erreur API comments:', error);
    // Retourner un tableau vide si le système de commentaires n'existe pas encore
    return NextResponse.json({ data: [] });
  }
}
