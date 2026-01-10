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

    // En production, utiliser l'URL publique de l'API Strapi
    // En développement, utiliser l'URL interne Docker ou localhost
    // Priorité : STRAPI_URL > NEXT_PUBLIC_STRAPI_URL > localhost
    let strapiUrl = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
    
    // Si STRAPI_URL pointe vers l'URL interne Docker (backend:1337) et que nous avons une URL publique,
    // utiliser l'URL publique en production (plus fiable)
    if (strapiUrl.includes('backend:1337') && process.env.NEXT_PUBLIC_STRAPI_URL && process.env.NEXT_PUBLIC_STRAPI_URL.includes('https://')) {
      strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL;
      console.log(`Utilisation de l'URL publique Strapi: ${strapiUrl}`);
    }
    
    const strapiApiToken = process.env.STRAPI_API_TOKEN;

    if (!strapiApiToken) {
      console.error('STRAPI_API_TOKEN n\'est pas configuré dans les variables d\'environnement');
      return NextResponse.json(
        { success: false, message: 'STRAPI_API_TOKEN non configuré. Veuillez configurer cette variable dans docker-compose.yml ou .env.local' },
        { status: 500 }
      );
    }

    console.log(`Tentative de publication Pinterest pour la recette ${recetteId} avec l'URL Strapi: ${strapiUrl}`);

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

