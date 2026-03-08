import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fonction pour obtenir la clé API OpenAI
function getOpenAIApiKey(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

// Fonction pour obtenir l'URL Ollama
function getOllamaUrl(): string {
  return process.env.OLLAMA_URL || 'http://localhost:11434';
}

// Fonction pour obtenir le modèle Ollama
function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL || 'llama3.2:3b';
}

// Fonction pour déterminer quel provider utiliser
function getProvider(): 'ollama' | 'openai' | null {
  const provider = process.env.AI_PROVIDER?.toLowerCase() || 'ollama';
  
  if (provider === 'ollama') {
    return 'ollama';
  } else if (provider === 'openai' && getOpenAIApiKey()) {
    return 'openai';
  }
  
  // Fallback : essayer Ollama d'abord, puis OpenAI
  return null;
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

    // Déterminer le provider à utiliser
    const provider = getProvider();
    
    // Si aucun provider disponible, retourner une erreur
    if (!provider && !getOpenAIApiKey()) {
      return NextResponse.json(
        { success: false, message: 'Aucun provider IA configuré (Ollama ou OpenAI requis)' },
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

    // Appeler le provider approprié (Ollama ou OpenAI)
    let content: string;
    let usedProvider: string;

    try {
      if (provider === 'ollama' || (!provider && getOllamaUrl())) {
        // Essayer Ollama d'abord
        usedProvider = 'ollama';
        content = await callOllama(prompt);
      } else {
        // Utiliser OpenAI
        usedProvider = 'openai';
        content = await callOpenAI(prompt);
      }
    } catch (error: any) {
      // Si Ollama échoue et qu'on a OpenAI en fallback, essayer OpenAI
      if (usedProvider === 'ollama' && getOpenAIApiKey()) {
        console.warn('[API /recipe/parse-ai] Ollama a échoué, fallback vers OpenAI:', error.message);
        try {
          usedProvider = 'openai';
          content = await callOpenAI(prompt);
        } catch (fallbackError: any) {
          return NextResponse.json(
            { 
              success: false, 
              message: `Erreur avec Ollama et OpenAI: ${fallbackError.message || 'Erreur inconnue'}`,
              errorType: 'provider_error'
            },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { 
            success: false, 
            message: error.message || 'Erreur lors de l\'appel à l\'IA',
            errorType: 'provider_error'
          },
          { status: 500 }
        );
      }
    }

    console.log(`[API /recipe/parse-ai] Réponse reçue de ${usedProvider}`);

    if (!content || !content.trim()) {
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

/**
 * Appeler Ollama API
 */
async function callOllama(prompt: string): Promise<string> {
  const ollamaUrl = getOllamaUrl();
  const model = getOllamaModel();
  
  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'Tu es un assistant qui retourne uniquement du JSON valide, sans aucun texte supplémentaire. Réponds UNIQUEMENT avec du JSON, rien d\'autre.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      stream: false,
      options: {
        temperature: 0.3, // Plus bas pour plus de cohérence
        num_predict: 2000, // Limiter la longueur de la réponse
      },
    }),
    // Timeout de 60 secondes pour Ollama (peut être plus lent)
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Erreur inconnue');
    throw new Error(`Ollama API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.message?.content;

  if (!content) {
    throw new Error('Aucune réponse de Ollama');
  }

  return content;
}

/**
 * Appeler OpenAI API
 */
async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY non configurée');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
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
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Erreur inconnue' } }));
    console.error('Erreur OpenAI API:', error);
    
    const errorMessage = error.error?.message || '';
    if (errorMessage.includes('quota') || errorMessage.includes('billing') || response.status === 429) {
      throw new Error('QUOTA_EXCEEDED');
    }
    
    throw new Error(errorMessage || 'Erreur lors de l\'appel à OpenAI');
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('Aucune réponse de OpenAI');
  }

  return content;
}
