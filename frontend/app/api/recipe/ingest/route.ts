import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route API pour ingérer une recette créée via dictée vocale et/ou photo
 * 
 * Reçoit :
 * - text: Le texte dicté de la recette
 * - image: Une image (optionnelle)
 * 
 * Retourne :
 * - success: boolean
 * - message: string
 * - slug?: string (si la recette a été créée)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const text = formData.get('text') as string | null;
    const image = formData.get('image') as File | null;

    // Vérifier qu'on a au moins du texte ou une image
    if (!text?.trim() && !image) {
      return NextResponse.json(
        { success: false, message: 'Texte ou image requis' },
        { status: 400 }
      );
    }

    // Log pour debug (à retirer en production si nécessaire)
    console.log('[API /recipe/ingest] Texte reçu:', text?.substring(0, 100));
    console.log('[API /recipe/ingest] Image reçue:', image ? `${image.name} (${image.size} bytes)` : 'aucune');

    // TODO: Intégrer avec Strapi pour créer la recette
    // Pour l'instant, on retourne juste un succès
    // 
    // Exemple d'intégration future :
    // 1. Si image : uploader vers Strapi
    // 2. Parser le texte pour extraire titre, ingrédients, étapes
    // 3. Créer la recette via l'API Strapi
    // 4. Retourner le slug de la recette créée

    // Simulation d'une création réussie
    const mockSlug = 'recette-temporaire-' + Date.now();

    return NextResponse.json({
      success: true,
      message: 'Recette reçue avec succès',
      slug: mockSlug,
      data: {
        text: text?.trim(),
        hasImage: !!image,
        imageName: image?.name,
      },
    });
  } catch (error) {
    console.error('[API /recipe/ingest] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

