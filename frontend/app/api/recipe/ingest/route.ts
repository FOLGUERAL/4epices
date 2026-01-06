import { NextRequest, NextResponse } from 'next/server';
import { parseRecipeText } from '@/lib/parseRecipeText';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fonction pour obtenir l'URL Strapi
function getStrapiUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
  }
  return process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
}

// Fonction pour obtenir le token API Strapi
function getStrapiApiToken(): string | null {
  return process.env.STRAPI_API_TOKEN || null;
}

/**
 * Upload une image vers Strapi
 */
async function uploadImageToStrapi(imageFile: File): Promise<number | null> {
  try {
    const strapiUrl = getStrapiUrl();
    const apiToken = getStrapiApiToken();
    
    const formData = new FormData();
    formData.append('files', imageFile);

    const headers: HeadersInit = {};
    if (apiToken) {
      headers['Authorization'] = `Bearer ${apiToken}`;
    }

    const response = await fetch(`${strapiUrl}/api/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erreur upload image:', errorText);
      return null;
    }

    const data = await response.json();
    if (data && data.length > 0) {
      return data[0].id;
    }

    return null;
  } catch (error) {
    console.error('Erreur lors de l\'upload de l\'image:', error);
    return null;
  }
}

/**
 * Créer une recette dans Strapi
 */
async function createRecipeInStrapi(parsedRecipe: ReturnType<typeof parseRecipeText>, imageId: number | null): Promise<{ slug: string } | null> {
  try {
    const strapiUrl = getStrapiUrl();
    const apiToken = getStrapiApiToken();
    
    // Vérifier que le token est configuré
    if (!apiToken) {
      throw new Error('STRAPI_API_TOKEN non configuré. Veuillez configurer le token API dans les variables d\'environnement.');
    }
    
    // Convertir les étapes en HTML (richtext)
    const etapesHtml = parsedRecipe.etapes
      .map((etape, index) => `<p><strong>Étape ${index + 1} :</strong> ${etape}</p>`)
      .join('\n');

    // Préparer les données pour Strapi
    const recipeData: any = {
      data: {
        titre: parsedRecipe.titre,
        description: parsedRecipe.description || parsedRecipe.titre,
        ingredients: parsedRecipe.ingredients, // JSON array
        etapes: etapesHtml, // RichText (HTML)
        tempsPreparation: parsedRecipe.tempsPreparation,
        tempsCuisson: parsedRecipe.tempsCuisson,
        nombrePersonnes: parsedRecipe.nombrePersonnes || 4,
        difficulte: parsedRecipe.difficulte || 'facile',
        publishedAt: new Date().toISOString(), // Publier immédiatement
      },
    };

    // Si on a une image, l'ajouter
    if (imageId) {
      recipeData.data.imagePrincipale = imageId;
    }

    // Créer la recette avec authentification
    const response = await fetch(`${strapiUrl}/api/recettes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify(recipeData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erreur création recette:', errorText);
      
      // Messages d'erreur plus explicites
      if (response.status === 401 || response.status === 403) {
        throw new Error('Erreur d\'authentification Strapi. Vérifiez votre token API.');
      }
      
      throw new Error(`Erreur Strapi: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.data && result.data.attributes) {
      return { slug: result.data.attributes.slug };
    }

    return null;
  } catch (error) {
    console.error('Erreur lors de la création de la recette:', error);
    throw error;
  }
}

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

    // Parser le texte pour extraire les informations structurées
    let parsedRecipe;
    if (text?.trim()) {
      parsedRecipe = parseRecipeText(text.trim());
    } else {
      // Si pas de texte, créer une recette basique
      parsedRecipe = {
        titre: 'Recette sans titre',
        description: 'Recette créée depuis une image',
        ingredients: [],
        etapes: [],
        nombrePersonnes: 4,
        difficulte: 'facile' as const,
      };
    }

    // Uploader l'image si présente
    let imageId: number | null = null;
    if (image) {
      imageId = await uploadImageToStrapi(image);
      if (!imageId) {
        console.warn('Impossible d\'uploader l\'image, création de la recette sans image');
      }
    }

    // Créer la recette dans Strapi
    const result = await createRecipeInStrapi(parsedRecipe, imageId);

    if (!result) {
      return NextResponse.json(
        { success: false, message: 'Impossible de créer la recette dans Strapi' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Recette créée avec succès',
      slug: result.slug,
      data: {
        titre: parsedRecipe.titre,
        hasImage: !!imageId,
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
