import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route API pour publier une recette sur Pinterest
 * Cette route appelle l'API Strapi avec le token d'admin
 */
export async function POST(request: NextRequest) {
  try {
    const { recetteId } = await request.json();

    if (!recetteId) {
      return NextResponse.json(
        { success: false, message: 'ID de recette requis' },
        { status: 400 }
      );
    }

    const strapiUrl = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
    const strapiApiToken = process.env.STRAPI_API_TOKEN;

    if (!strapiApiToken) {
      return NextResponse.json(
        { success: false, message: 'STRAPI_API_TOKEN non configuré' },
        { status: 500 }
      );
    }

    // Appeler l'API Strapi pour publier sur Pinterest
    const response = await fetch(`${strapiUrl}/api/recettes/${recetteId}/publish-pinterest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${strapiApiToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      return NextResponse.json(
        { success: false, message: error.message || 'Erreur lors de la publication Pinterest' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      message: 'Recette publiée sur Pinterest avec succès',
      data: data,
    });
  } catch (error) {
    console.error('Erreur lors de la publication Pinterest:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur inconnue',
      },
      { status: 500 }
    );
  }
}

