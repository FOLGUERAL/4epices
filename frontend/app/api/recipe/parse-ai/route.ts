import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fonction pour obtenir la clé API OpenAI
function getOpenAIApiKey(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

/**
 * Route API pour parser une recette dictée avec l'IA
 * 
 * Reçoit :
 * - text: Le texte dicté de la recette
 * 
 * Retourne :
 * - success: boolean
 * - data?: ParsedRecipe (si succès)
 * - message?: string (si erreur)
 */
export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || !text.trim()) {
      return NextResponse.json(
        { success: false, message: 'Texte requis' },
        { status: 400 }
      );
    }

    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'OPENAI_API_KEY non configurée' },
        { status: 500 }
      );
    }

    const prompt = `Tu es un chef cuisinier professionnel et un rédacteur culinaire SEO.

À partir de la dictée suivante, génère une recette STRUCTURÉE au format JSON strict.

Règles ABSOLUES :
- Retourne UNIQUEMENT du JSON valide
- Pas de texte autour
- Pas de commentaires
- Champs obligatoires même si estimés

Structure JSON EXACTE (correspondant au schéma Strapi) :

{
  "titre": string (max 255 caractères, obligatoire),
  "description": string (texte, obligatoire),
  "ingredients": [
    string | { "quantite": string, "ingredient": string }
  ] (array JSON, obligatoire),
  "etapes": string[] (sera converti en HTML richtext, obligatoire),
  "tempsPreparation": number (minutes, optionnel, null si inconnu),
  "tempsCuisson": number (minutes, optionnel, null si inconnu),
  "nombrePersonnes": number (optionnel, défaut 4),
  "difficulte": "facile" | "moyen" | "difficile" (optionnel, défaut "facile"),
  "categories": string[] (noms de catégories, optionnel, ex: ["Plat principal", "Dessert"]),
  "tags": string[] (noms de tags, optionnel, ex: ["rapide", "végétarien"])
}

Notes importantes :
- Les ingrédients peuvent être des strings simples ("200g de farine") ou des objets {"quantite": "200g", "ingredient": "farine"}
- Les étapes sont un array de strings, chaque string est une étape de préparation
- Les catégories et tags sont des noms (strings), ils seront associés automatiquement
- Si une information n'est pas mentionnée, utilise null pour les nombres ou des valeurs par défaut

Dictée :

"""
${text.trim()}
"""`;

    // Appeler OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // Utiliser 3.5-turbo pour éviter les rate limits (gpt-4o-mini a seulement 3 RPM en gratuit)
        messages: [
          {
            role: 'system',
            content: 'Tu es un assistant qui retourne uniquement du JSON valide, sans aucun texte supplémentaire.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Plus bas pour plus de cohérence
        response_format: { type: 'json_object' }, // Force le format JSON
        max_retries: 2, // Réessayer en cas d'erreur
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Erreur inconnue' } }));
      console.error('Erreur OpenAI API:', error);
      return NextResponse.json(
        { success: false, message: error.error?.message || 'Erreur lors de l\'appel à l\'IA' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { success: false, message: 'Aucune réponse de l\'IA' },
        { status: 500 }
      );
    }

    // Parser le JSON retourné
    let parsedRecipe;
    try {
      // Nettoyer le contenu (enlever les markdown code blocks si présents)
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      parsedRecipe = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Erreur parsing JSON:', parseError);
      console.error('Contenu reçu:', content);
      return NextResponse.json(
        { success: false, message: 'Réponse de l\'IA invalide (JSON invalide)' },
        { status: 500 }
      );
    }

    // Valider la structure
    if (!parsedRecipe.titre || !parsedRecipe.ingredients || !parsedRecipe.etapes) {
      return NextResponse.json(
        { success: false, message: 'Structure JSON incomplète' },
        { status: 500 }
      );
    }

    // Normaliser les ingrédients (peuvent être strings ou objets {quantite, ingredient})
    const normalizedIngredients = parsedRecipe.ingredients.map((ing: any) => {
      if (typeof ing === 'string') {
        // Si c'est une string, la garder telle quelle (format accepté par Strapi)
        return ing;
      }
      // Si c'est un objet, le garder au format {quantite, ingredient}
      return {
        quantite: ing.quantite || ing.quantity || '',
        ingredient: ing.ingredient || ing.nom || String(ing),
      };
    });

    // Normaliser les étapes
    const normalizedEtapes = Array.isArray(parsedRecipe.etapes)
      ? parsedRecipe.etapes
      : [String(parsedRecipe.etapes)];

    // Normaliser la difficulté
    const difficulte = ['facile', 'moyen', 'difficile'].includes(parsedRecipe.difficulte)
      ? parsedRecipe.difficulte
      : 'facile';

    // Normaliser les catégories (array de noms)
    const categories = Array.isArray(parsedRecipe.categories) 
      ? parsedRecipe.categories 
      : (parsedRecipe.categorie ? [parsedRecipe.categorie] : []);

    // Normaliser les tags (array de noms)
    const tags = Array.isArray(parsedRecipe.tags) ? parsedRecipe.tags : [];

    const normalizedRecipe = {
      titre: String(parsedRecipe.titre),
      description: String(parsedRecipe.description || parsedRecipe.titre),
      ingredients: normalizedIngredients,
      etapes: normalizedEtapes,
      tempsPreparation: parsedRecipe.tempsPreparation ? Number(parsedRecipe.tempsPreparation) : null,
      tempsCuisson: parsedRecipe.tempsCuisson ? Number(parsedRecipe.tempsCuisson) : null,
      nombrePersonnes: Number(parsedRecipe.nombrePersonnes) || 4,
      difficulte: difficulte as 'facile' | 'moyen' | 'difficile',
      categories: categories.map((c: any) => String(c)), // Noms de catégories
      tags: tags.map((t: any) => String(t)), // Noms de tags
    };

    return NextResponse.json({
      success: true,
      data: normalizedRecipe,
    });
  } catch (error) {
    console.error('[API /recipe/parse-ai] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

