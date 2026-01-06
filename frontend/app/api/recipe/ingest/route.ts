import { NextRequest, NextResponse } from 'next/server';

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
    
    console.log('[Upload] Début upload image:', {
      fileName: imageFile.name,
      fileSize: imageFile.size,
      fileType: imageFile.type,
      strapiUrl: `${strapiUrl}/api/upload`,
      hasToken: !!apiToken,
    });

    // Vérifier que le fichier est valide
    if (!imageFile || imageFile.size === 0) {
      throw new Error('Le fichier image est vide ou invalide');
    }

    // Convertir le File en Blob puis créer un nouveau File
    // Cela résout les problèmes de compatibilité avec Next.js côté serveur
    const arrayBuffer = await imageFile.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: imageFile.type });
    
    // Créer un nouveau File à partir du Blob
    const fileToUpload = new File([blob], imageFile.name, { 
      type: imageFile.type || 'image/jpeg',
    });
    
    // Utiliser FormData natif (compatible avec fetch dans Next.js)
    const formData = new FormData();
    formData.append('files', fileToUpload);

    const headers: HeadersInit = {};
    if (apiToken) {
      headers['Authorization'] = `Bearer ${apiToken}`;
    }
    // Ne pas définir Content-Type, laissez fetch le faire automatiquement pour FormData

    console.log('[Upload] Envoi de la requête à Strapi...');
    
    const response = await fetch(`${strapiUrl}/api/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    console.log('[Upload] Réponse reçue:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Upload] Erreur upload image - Status:', response.status);
      console.error('[Upload] Erreur upload image - Body:', errorText);
      throw new Error(`Erreur upload Strapi (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    console.log('[Upload] Réponse Strapi:', JSON.stringify(data, null, 2));
    
    if (data && Array.isArray(data) && data.length > 0) {
      const imageId = data[0].id;
      console.log('[Upload] Image uploadée avec succès, ID:', imageId);
      return imageId;
    }

    console.error('[Upload] Format de réponse inattendu:', data);
    return null;
  } catch (error) {
    console.error('[Upload] Erreur lors de l\'upload de l\'image:', error);
    if (error instanceof Error) {
      console.error('[Upload] Message d\'erreur:', error.message);
      console.error('[Upload] Stack:', error.stack);
    }
    throw error; // Propager l'erreur pour qu'elle soit visible
  }
}

/**
 * Trouver ou créer une catégorie par nom
 */
async function findOrCreateCategory(categoryName: string): Promise<number | null> {
  try {
    const strapiUrl = getStrapiUrl();
    const apiToken = getStrapiApiToken();
    
    if (!apiToken) return null;

    // Chercher la catégorie existante
    const searchResponse = await fetch(
      `${strapiUrl}/api/categories?filters[nom][$eq]=${encodeURIComponent(categoryName)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
      }
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.data && searchData.data.length > 0) {
        return searchData.data[0].id;
      }
    }

    // Créer la catégorie si elle n'existe pas
    const createResponse = await fetch(`${strapiUrl}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        data: {
          nom: categoryName,
          publishedAt: new Date().toISOString(),
        },
      }),
    });

    if (createResponse.ok) {
      const createData = await createResponse.json();
      return createData.data?.id || null;
    }

    return null;
  } catch (error) {
    console.error('Erreur lors de la recherche/création de catégorie:', error);
    return null;
  }
}

/**
 * Trouver ou créer un tag par nom
 */
async function findOrCreateTag(tagName: string): Promise<number | null> {
  try {
    const strapiUrl = getStrapiUrl();
    const apiToken = getStrapiApiToken();
    
    if (!apiToken) return null;

    // Chercher le tag existant
    const searchResponse = await fetch(
      `${strapiUrl}/api/tags?filters[nom][$eq]=${encodeURIComponent(tagName)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
      }
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.data && searchData.data.length > 0) {
        return searchData.data[0].id;
      }
    }

    // Créer le tag s'il n'existe pas
    const createResponse = await fetch(`${strapiUrl}/api/tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        data: {
          nom: tagName,
          publishedAt: new Date().toISOString(),
        },
      }),
    });

    if (createResponse.ok) {
      const createData = await createResponse.json();
      return createData.data?.id || null;
    }

    return null;
  } catch (error) {
    console.error('Erreur lors de la recherche/création de tag:', error);
    return null;
  }
}

/**
 * Créer une recette dans Strapi
 */
async function createRecipeInStrapi(parsedRecipe: any, imageId: number | null): Promise<{ slug: string } | null> {
  try {
    const strapiUrl = getStrapiUrl();
    const apiToken = getStrapiApiToken();
    
    // Vérifier que le token est configuré
    if (!apiToken) {
      throw new Error('STRAPI_API_TOKEN non configuré. Veuillez configurer le token API dans les variables d\'environnement.');
    }
    
    // Les ingrédients peuvent être strings ou objets {quantite, ingredient}
    // On les garde tels quels (Strapi accepte les deux formats dans le champ JSON)
    const ingredientsFormatted = parsedRecipe.ingredients || [];

    // Convertir les étapes en HTML (richtext)
    const etapesHtml = parsedRecipe.etapes
      .map((etape: string, index: number) => `<p><strong>Étape ${index + 1} :</strong> ${etape}</p>`)
      .join('\n');

    // Trouver ou créer les catégories
    const categoryIds: number[] = [];
    if (parsedRecipe.categories && Array.isArray(parsedRecipe.categories)) {
      for (const categoryName of parsedRecipe.categories) {
        if (categoryName && categoryName.trim()) {
          const categoryId = await findOrCreateCategory(categoryName.trim());
          if (categoryId) {
            categoryIds.push(categoryId);
          }
        }
      }
    }

    // Trouver ou créer les tags
    const tagIds: number[] = [];
    if (parsedRecipe.tags && Array.isArray(parsedRecipe.tags)) {
      for (const tagName of parsedRecipe.tags) {
        if (tagName && tagName.trim()) {
          const tagId = await findOrCreateTag(tagName.trim());
          if (tagId) {
            tagIds.push(tagId);
          }
        }
      }
    }

    // Générer un slug à partir du titre (Strapi le génère normalement, mais on l'aide)
    const generateSlug = (title: string): string => {
      return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
        .replace(/[^a-z0-9]+/g, '-') // Remplacer les caractères spéciaux par des tirets
        .replace(/^-+|-+$/g, '') // Enlever les tirets en début/fin
        .substring(0, 100); // Limiter la longueur
    };

    // Préparer les données pour Strapi (format exact du schéma)
    const recipeData: any = {
      data: {
        titre: parsedRecipe.titre,
        slug: generateSlug(parsedRecipe.titre), // Générer le slug explicitement
        description: parsedRecipe.description || parsedRecipe.titre,
        ingredients: ingredientsFormatted, // JSON array (strings ou objets {quantite, ingredient})
        etapes: etapesHtml, // RichText (HTML)
        tempsPreparation: parsedRecipe.tempsPreparation || null,
        tempsCuisson: parsedRecipe.tempsCuisson || null,
        nombrePersonnes: parsedRecipe.nombrePersonnes || 4,
        difficulte: parsedRecipe.difficulte || 'facile',
        publishedAt: new Date().toISOString(), // Publier immédiatement
      },
    };

    // Si on a une image, l'ajouter
    // Note: imagePrincipale est required dans le schéma Strapi
    // Si l'upload a échoué et qu'on n'a pas d'image, on ne peut pas créer la recette
    if (imageId) {
      recipeData.data.imagePrincipale = imageId;
    } else {
      // Si pas d'image et qu'on essaie de créer une recette, c'est une erreur
      // car imagePrincipale est required
      console.warn('[CreateRecipe] Aucune image fournie, mais imagePrincipale est required');
    }

    // Ajouter les relations (catégories et tags) - Strapi attend des arrays d'IDs
    if (categoryIds.length > 0) {
      recipeData.data.categories = categoryIds;
    }
    if (tagIds.length > 0) {
      recipeData.data.tags = tagIds;
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
  console.log('[Ingest] Début de la requête POST');
  try {
    const formData = await request.formData();
    const text = formData.get('text') as string | null;
    const image = formData.get('image') as File | null;

    console.log('[Ingest] Données reçues:', {
      hasText: !!text?.trim(),
      textLength: text?.length || 0,
      hasImage: !!image,
      imageName: image?.name,
      imageSize: image?.size,
      imageType: image?.type,
    });

    // Vérifier qu'on a au moins du texte ou une image
    if (!text?.trim() && !image) {
      console.error('[Ingest] Erreur: Texte ou image requis');
      return NextResponse.json(
        { success: false, message: 'Texte ou image requis' },
        { status: 400 }
      );
    }

    // Parser le texte avec l'IA
    let parsedRecipe;
    if (text?.trim()) {
      try {
        // Appeler directement la fonction POST de l'API parse-ai (évite les problèmes SSL/fetch)
        const { POST: parseAIPost } = await import('@/app/api/recipe/parse-ai/route');
        const parseRequest = new NextRequest(new URL('/api/recipe/parse-ai', request.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: text.trim() }),
        });
        
        const parseResponse = await parseAIPost(parseRequest);

        if (parseResponse.ok) {
          const parseResult = await parseResponse.json();
          if (parseResult.success && parseResult.data) {
            parsedRecipe = parseResult.data;
          } else {
            throw new Error(parseResult.message || 'Erreur lors du parsing IA');
          }
        } else {
          const error = await parseResponse.json().catch(() => ({ message: 'Erreur parsing IA' }));
          throw new Error(error.message || 'Erreur lors du parsing IA');
        }
      } catch (error) {
        console.error('Erreur parsing IA, fallback sur parser local:', error);
        // Fallback sur le parser local si l'IA échoue
        try {
          const { parseRecipeText } = await import('@/lib/parseRecipeText');
          const localParsed = parseRecipeText(text.trim());
          // Adapter au format attendu
          parsedRecipe = {
            titre: localParsed.titre,
            description: localParsed.description,
            ingredients: localParsed.ingredients,
            etapes: localParsed.etapes,
            tempsPreparation: localParsed.tempsPreparation,
            tempsCuisson: localParsed.tempsCuisson,
            nombrePersonnes: localParsed.nombrePersonnes || 4,
            difficulte: localParsed.difficulte || 'facile',
            categories: [],
            tags: [],
          };
        } catch (fallbackError) {
          console.error('Erreur parser local:', fallbackError);
          throw new Error('Impossible de parser la recette');
        }
      }
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
      console.log('[Ingest] Upload de l\'image...', {
        name: image.name,
        size: image.size,
        type: image.type,
      });
      try {
        imageId = await uploadImageToStrapi(image);
        if (!imageId) {
          console.warn('[Ingest] Impossible d\'uploader l\'image, création de la recette sans image');
        } else {
          console.log('[Ingest] Image uploadée avec succès, ID:', imageId);
        }
      } catch (uploadError) {
        console.error('[Ingest] Erreur lors de l\'upload de l\'image:', uploadError);
        // Si l'image est requise, on échoue
        // Sinon, on continue sans image
        if (image.size > 0) {
          throw new Error(`Erreur lors de l'upload de l'image: ${uploadError instanceof Error ? uploadError.message : 'Erreur inconnue'}`);
        }
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
    console.error('[Ingest] Erreur globale:', error);
    if (error instanceof Error) {
      console.error('[Ingest] Message:', error.message);
      console.error('[Ingest] Stack:', error.stack);
    }
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur inconnue',
      },
      { status: 500 }
    );
  }
}
